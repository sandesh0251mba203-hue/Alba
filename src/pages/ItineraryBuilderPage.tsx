import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  Save,
  Users,
  Clock,
  MapPin,
  Edit3,
  Check,
  AlertCircle,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  generateAiItinerary,
  regenerateItineraryStop,
  GeneratedItineraryResponse,
  GeneratedStop,
} from '../services/aiService';
import {
  saveItineraryToFirestore,
  createGroupTrip,
} from '../services/firestoreService';
import {
  SUPPORTED_CITIES,
  BENGALURU_LOCALITIES,
  BENGALURU_REFERENCE_VENUES,
} from '../data/bengaluruCatalog';
import { BookingModal } from '../components/BookingModal';
import { Venue } from '../types/alba';

const ACTIVITY_PREFS = [
  'Adventure Activities',
  'Go-Karting',
  'Escape Rooms',
  'Rooftop Dining',
  'Specialty Cafes',
  'Scenic / Nature',
  'Amusement Parks',
  'Nightlife',
];

function defaultFutureDate(days = 4) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function ItineraryBuilderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { firebaseUser, albaUser } = useAuth();

  const [destination, setDestination] = useState(searchParams.get('destination') || 'Bengaluru');
  const [startingLocation, setStartingLocation] = useState('Indiranagar, Bengaluru');
  const [travelDate, setTravelDate] = useState(searchParams.get('date') || defaultFutureDate(4));
  const [participantsCount, setParticipantsCount] = useState(
    Number(searchParams.get('participants')) || 6
  );
  const [groupType, setGroupType] = useState<'Friends' | 'Family' | 'Couples' | 'Solo'>(
    (searchParams.get('groupType') as 'Friends' | 'Family' | 'Couples' | 'Solo') || 'Friends'
  );
  const [budgetPerPerson, setBudgetPerPerson] = useState(
    Number(searchParams.get('budget')) || 2000
  );
  const [preferredActivities, setPreferredActivities] = useState<string[]>([
    'Adventure Activities',
    'Rooftop Dining',
    'Scenic / Nature',
  ]);
  const [foodPreferences, setFoodPreferences] = useState('Mixed Veg & Non-Veg · Good Cafe & Dinner');
  const [travelMode, setTravelMode] = useState('Cab / Metro');
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('21:30');
  const [indoorOutdoor, setIndoorOutdoor] = useState('Balanced Mix');
  const [customPrompt, setCustomPrompt] = useState('');

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [itinerary, setItinerary] = useState<GeneratedItineraryResponse | null>(null);
  const [savedItineraryId, setSavedItineraryId] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [bookingVenue, setBookingVenue] = useState<Venue | null>(null);

  const togglePref = (pref: string) => {
    setPreferredActivities((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusMessage('');
    if (!firebaseUser) {
      navigate('/auth');
      return;
    }
    setGenerating(true);
    setSavedItineraryId(null);
    try {
      const result = await generateAiItinerary({
        destination,
        startingLocation,
        travelDate,
        participantsCount,
        groupType,
        budgetPerPerson,
        preferredActivities,
        foodPreferences,
        travelMode,
        startTime,
        endTime,
        indoorOutdoor,
        customPrompt,
      });
      setItinerary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate itinerary.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateStop = async (idx: number) => {
    if (!itinerary) return;
    const stop = itinerary.stops[idx];
    setRegenIdx(idx);
    setError('');
    try {
      const replacement = await regenerateItineraryStop({
        destination,
        currentTitle: stop.title,
        timeSlot: stop.timeSlot,
        budgetPerPerson: stop.estimatedCostPerPerson || Math.round(budgetPerPerson / 4),
        groupType,
      });
      const updatedStops = itinerary.stops.map((s, i) =>
        i === idx ? { ...replacement, orderIndex: idx } : s
      );
      const newTotal = updatedStops.reduce((sum, s) => sum + (Number(s.estimatedCostPerPerson) || 0), 0);
      setItinerary({
        ...itinerary,
        stops: updatedStops,
        estimatedTotalPerPerson: newTotal,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to swap stop.');
    } finally {
      setRegenIdx(null);
    }
  };

  const handleEditStopField = (idx: number, field: keyof GeneratedStop, val: string | number) => {
    if (!itinerary) return;
    const nextStops = itinerary.stops.map((s, i) => (i === idx ? { ...s, [field]: val } : s));
    const nextTotal = nextStops.reduce((acc, s) => acc + (Number(s.estimatedCostPerPerson) || 0), 0);
    setItinerary({
      ...itinerary,
      stops: nextStops,
      estimatedTotalPerPerson: nextTotal,
    });
  };

  const handleSaveToFirestore = async (): Promise<string | null> => {
    if (!itinerary || !firebaseUser) return null;
    if (!firebaseUser.emailVerified) {
      setError('Please verify your email address before saving itineraries to Firestore.');
      return null;
    }
    setSaving(true);
    setError('');
    try {
      const id = await saveItineraryToFirestore({
        ownerId: firebaseUser.uid,
        title: itinerary.title,
        destination,
        startingLocation,
        travelDate,
        participantsCount,
        groupType,
        budgetPerPerson,
        estimatedTotalPerPerson: itinerary.estimatedTotalPerPerson,
        travelMode,
        summary: itinerary.summary,
        aiGenerated: true,
        aiDisclaimer: itinerary.aiDisclaimer,
        stops: itinerary.stops.map((s, idx) => ({
          ...s,
          orderIndex: idx,
          priceType: 'estimated',
        })),
      });
      setSavedItineraryId(id);
      setStatusMessage('Itinerary saved to your Alba account.');
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save itinerary.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleCreateShareableGroup = async () => {
    if (!firebaseUser || !itinerary) return;
    let itinId = savedItineraryId;
    if (!itinId) {
      itinId = await handleSaveToFirestore();
    }
    if (!itinId) return;
    setSaving(true);
    try {
      const { groupId } = await createGroupTrip({
        name: itinerary.title,
        organizerId: firebaseUser.uid,
        organizerName: albaUser?.fullName || firebaseUser.displayName || 'Group Captain',
        destination,
        tripDate: travelDate,
        budgetPerPerson,
        participantLimit: participantsCount,
        itineraryId: itinId,
      });
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create shareable group workspace.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-violet-700">Gemini-Powered Group Concierge</p>
          <h1 className="font-display text-3xl font-bold text-[#0A1428] tracking-tight mt-1">
            AI Group Itinerary Builder
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Generate structured outings tailored to your group size, locality, and per-person budget.
          </p>
        </div>
        {!firebaseUser && (
          <Link
            to="/auth"
            className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg whitespace-nowrap"
          >
            Sign In to Generate & Save
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Form */}
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {SUPPORTED_CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Starting Locality
              </label>
              <select
                value={startingLocation}
                onChange={(e) => setStartingLocation(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {BENGALURU_LOCALITIES.map((loc) => (
                  <option key={loc} value={`${loc}, Bengaluru`}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Travel Date</label>
              <input
                type="date"
                required
                value={travelDate}
                onChange={(e) => setTravelDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guests</label>
              <input
                type="number"
                min={1}
                max={30}
                value={participantsCount}
                onChange={(e) => setParticipantsCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Budget / Person
              </label>
              <input
                type="number"
                min={300}
                step={100}
                value={budgetPerPerson}
                onChange={(e) => setBudgetPerPerson(Math.max(300, Number(e.target.value) || 500))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Group Type</label>
              <select
                value={groupType}
                onChange={(e) =>
                  setGroupType(e.target.value as 'Friends' | 'Family' | 'Couples' | 'Solo')
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Friends">Friends</option>
                <option value="Family">Family</option>
                <option value="Couples">Couples</option>
                <option value="Solo">Solo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Travel Mode</label>
              <select
                value={travelMode}
                onChange={(e) => setTravelMode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option>Cab / Metro</option>
                <option>Self-Drive / Two-Wheelers</option>
                <option>Namma Metro + Walk</option>
                <option>Tempo Traveller (8+)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Setting</label>
              <select
                value={indoorOutdoor}
                onChange={(e) => setIndoorOutdoor(e.target.value)}
                className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option>Balanced Mix</option>
                <option>Mostly Outdoor</option>
                <option>Mostly Indoor</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Preferred Activities
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_PREFS.map((pref) => {
                const active = preferredActivities.includes(pref);
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => togglePref(pref)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                      active
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pref}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Food Preferences
            </label>
            <input
              type="text"
              value={foodPreferences}
              onChange={(e) => setFoodPreferences(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Request (Optional)
            </label>
            <textarea
              rows={2}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Plan a Saturday outing in Bengaluru for six friends with ₹2,000 budget..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={generating}
            className="w-full py-2.5 px-4 bg-[#0A1428] hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Generating Structured Itinerary...' : 'Generate AI Group Itinerary'}
          </button>
        </form>

        {/* Itinerary Output */}
        <div className="lg:col-span-7 space-y-5">
          {!itinerary && !generating && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-violet-700 mx-auto" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Your AI Itinerary Will Appear Here
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Configure your Bengaluru outing parameters and click Generate. You can edit any
                stop, swap individual slots, save to Firestore, or invite friends to vote.
              </p>
            </div>
          )}

          {generating && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 space-y-4">
              <div className="h-6 bg-slate-200 rounded w-2/3 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
              <div className="h-24 bg-slate-100 rounded w-full animate-pulse" />
              <div className="h-24 bg-slate-100 rounded w-full animate-pulse" />
            </div>
          )}

          {itinerary && !generating && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-violet-700">
                      AI-Generated Planning Estimate
                    </p>
                    <h2 className="font-display text-2xl font-bold text-[#0A1428] mt-0.5">
                      {itinerary.title}
                    </h2>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                      {itinerary.summary}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">Est. Spend / Person</p>
                    <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      ₹{Math.round(itinerary.estimatedTotalPerPerson).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      Group Total: ₹
                      {Math.round(itinerary.estimatedTotalPerPerson * participantsCount).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Budget Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-500 block">Activities (Est.)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      ₹{itinerary.budgetBreakdown.activitiesInr}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Dining (Est.)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      ₹{itinerary.budgetBreakdown.diningInr}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Local Travel (Est.)</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      ₹{itinerary.budgetBreakdown.localTravelInr}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Buffer</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      ₹{itinerary.budgetBreakdown.bufferInr}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>{itinerary.aiDisclaimer}</span>
                </div>

                {statusMessage && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                    {statusMessage}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveToFirestore}
                    disabled={saving}
                    className="px-4 py-2 bg-[#0A1428] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savedItineraryId ? 'Saved to Account' : saving ? 'Saving...' : 'Save Itinerary'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateShareableGroup}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Create Group Trip & Invite Link
                  </button>
                </div>
              </div>

              {/* Timeline Stops */}
              <div className="space-y-3">
                {itinerary.stops.map((stop, idx) => {
                  const isEditing = editingIdx === idx;
                  const matchedRefVenue = BENGALURU_REFERENCE_VENUES.find(
                    (v) =>
                      v.category.toLowerCase().includes(stop.category.toLowerCase()) ||
                      v.locality.toLowerCase().includes(stop.locality.toLowerCase())
                  );

                  return (
                    <div
                      key={`${idx}-${stop.timeSlot}`}
                      className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className="font-mono font-semibold text-blue-700">
                            {stop.timeSlot}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {stop.durationMinutes} min
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{stop.category}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingIdx(isEditing ? null : idx)}
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md inline-flex items-center gap-1"
                          >
                            {isEditing ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-700" /> Done
                              </>
                            ) : (
                              <>
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenerateStop(idx)}
                            disabled={regenIdx === idx}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-md inline-flex items-center gap-1"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${regenIdx === idx ? 'animate-spin' : ''}`}
                            />
                            {regenIdx === idx ? 'Swapping...' : 'Swap Stop'}
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2.5">
                          <input
                            type="text"
                            value={stop.title}
                            onChange={(e) => handleEditStopField(idx, 'title', e.target.value)}
                            className="w-full px-3 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={stop.locality}
                              onChange={(e) => handleEditStopField(idx, 'locality', e.target.value)}
                              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                              placeholder="Locality"
                            />
                            <input
                              type="number"
                              value={stop.estimatedCostPerPerson}
                              onChange={(e) =>
                                handleEditStopField(
                                  idx,
                                  'estimatedCostPerPerson',
                                  Number(e.target.value) || 0
                                )
                              }
                              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                              placeholder="Est. Cost (INR)"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={stop.description}
                            onChange={(e) => handleEditStopField(idx, 'description', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="font-display text-base font-bold text-slate-900">
                              {idx + 1}. {stop.title}
                            </h3>
                            <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                              ~₹{stop.estimatedCostPerPerson}/person (Est.)
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{stop.description}</p>
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {stop.locality}
                              </span>
                              <span>·</span>
                              <span>{stop.travelTimeNote}</span>
                            </div>
                            {matchedRefVenue && (
                              <button
                                type="button"
                                onClick={() => setBookingVenue(matchedRefVenue)}
                                className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline"
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                                Request Slot at Similar Venue
                              </button>
                            )}
                          </div>
                          {stop.alternativeOption && (
                            <p className="text-xs text-slate-500">
                              <strong className="text-slate-700">Backup option:</strong>{' '}
                              {stop.alternativeOption}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {bookingVenue && (
        <BookingModal
          venue={bookingVenue}
          defaultParticipants={participantsCount}
          itineraryId={savedItineraryId || undefined}
          onClose={() => setBookingVenue(null)}
        />
      )}
    </div>
  );
}
