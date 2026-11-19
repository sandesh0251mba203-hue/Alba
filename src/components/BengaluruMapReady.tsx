import { useState } from 'react';
import { MapPin, Navigation, Info } from 'lucide-react';
import { Venue } from '../types/alba';

interface BengaluruMapReadyProps {
  venues: Venue[];
  selectedVenueId?: string;
  onSelectVenue?: (venue: Venue) => void;
  stopsOverlay?: Array<{ title: string; locality?: string; orderIndex: number }>;
}

// Bounding box roughly covering Greater Bengaluru + Nandi Hills corridor
const BOUNDS = {
  minLat: 12.66,
  maxLat: 13.42,
  minLng: 77.45,
  maxLng: 77.78,
};

function projectCoords(lat = 12.9716, lng = 77.5946) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 560 + 40;
  const y = 380 - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 320;
  return {
    x: Math.max(36, Math.min(604, x)),
    y: Math.max(36, Math.min(384, y)),
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function BengaluruMapReady({
  venues,
  selectedVenueId,
  onSelectVenue,
  stopsOverlay,
}: BengaluruMapReadyProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeVenue =
    venues.find((v) => v.id === (hoveredId || selectedVenueId)) || venues[0];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-700" />
          <h3 className="text-sm font-semibold text-slate-900">
            Bengaluru Spatial Venue & Route Map
          </h3>
        </div>
        <span className="text-xs text-slate-600 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          Map-ready spatial view (configure Google Maps API key for live traffic & turn-by-turn)
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-[#0A1428] relative p-4">
          <svg
            viewBox="0 0 640 420"
            className="w-full h-72 sm:h-88 rounded-xl bg-slate-900/80 border border-slate-800"
            role="img"
            aria-label="Bengaluru Venue Spatial Map"
          >
            {/* Subtle coordinate grid */}
            <g stroke="rgba(148,163,184,0.12)" strokeWidth="1">
              {[80, 160, 240, 320].map((y) => (
                <line key={`h-${y}`} x1="0" y1={y} x2="640" y2={y} />
              ))}
              {[120, 240, 360, 480].map((x) => (
                <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="420" />
              ))}
            </g>

            {/* MG Road Center Marker */}
            {(() => {
              const center = projectCoords(12.9756, 77.6066);
              return (
                <g>
                  <circle
                    cx={center.x}
                    cy={center.y}
                    r="28"
                    fill="rgba(37, 99, 235, 0.14)"
                    stroke="rgba(59, 130, 246, 0.4)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={center.x + 8}
                    y={center.y + 4}
                    fill="#93C5FD"
                    fontSize="10"
                    fontFamily="DM Sans, sans-serif"
                  >
                    MG Road Core
                  </text>
                </g>
              );
            })()}

            {/* Venue Pins */}
            {venues.map((v, idx) => {
              const pt = projectCoords(v.lat, v.lng);
              const isSelected = activeVenue?.id === v.id;
              return (
                <g
                  key={v.id}
                  onMouseEnter={() => setHoveredId(v.id)}
                  onClick={() => onSelectVenue?.(v)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 11 : 7}
                    fill={isSelected ? '#2563EB' : '#10B981'}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <text
                    x={pt.x}
                    y={pt.y + 3.5}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {idx + 1}
                  </text>
                  <text
                    x={pt.x + 13}
                    y={pt.y + 4}
                    fill={isSelected ? '#FFFFFF' : '#CBD5E1'}
                    fontSize="10"
                    fontWeight={isSelected ? '600' : '400'}
                  >
                    {v.locality}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="p-5 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between">
          {activeVenue ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-blue-700">Selected Map Pin</p>
              <h4 className="text-base font-bold text-slate-900">{activeVenue.name}</h4>
              <p className="text-xs text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {activeVenue.address || `${activeVenue.locality}, ${activeVenue.city}`}
              </p>
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Approx. from MG Road</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {haversineKm(12.9756, 77.6066, activeVenue.lat || 12.97, activeVenue.lng || 77.6)} km
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Weekend Benchmark</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    ₹{activeVenue.weekendPrice}/person
                  </span>
                </div>
              </div>
              {stopsOverlay && stopsOverlay.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Itinerary Stops</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {stopsOverlay.slice(0, 4).map((s) => (
                      <li key={s.orderIndex} className="truncate">
                        {s.orderIndex + 1}. {s.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select a venue pin to inspect locality & distance.</p>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => activeVenue && onSelectVenue?.(activeVenue)}
              disabled={!activeVenue}
              className="w-full py-2 px-4 text-xs font-semibold text-white bg-[#0A1428] hover:bg-blue-700 rounded-lg transition-colors"
            >
              Inspect Venue Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
