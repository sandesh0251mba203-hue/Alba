import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronUp,
  ChevronDown,
  Heart,
  CalendarPlus,
  Compass,
  Play,
  Pause,
  MapPin,
} from 'lucide-react';
import { BENGALURU_REFERENCE_VENUES } from '../data/bengaluruCatalog';
import { useAuth } from '../context/AuthContext';
import {
  fetchUserFavourites,
  saveItineraryToFirestore,
  toggleFavourite,
} from '../services/firestoreService';
import { SafeImage } from '../components/SafeImage';
import { BookingModal } from '../components/BookingModal';
import { Venue } from '../types/alba';

export function VideoDiscoveryPage() {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState('');
  const [bookingVenue, setBookingVenue] = useState<Venue | null>(null);

  const reels = BENGALURU_REFERENCE_VENUES;
  const current = reels[activeIndex];

  useEffect(() => {
    if (!firebaseUser) return;
    fetchUserFavourites(firebaseUser.uid)
      .then((items) => setFavIds(new Set(items.map((i) => i.itemId))))
      .catch(() => {});
  }, [firebaseUser]);

  const goNext = () => setActiveIndex((prev) => (prev + 1) % reels.length);
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + reels.length) % reels.length);

  const handleSaveFav = async () => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      navigate('/auth');
      return;
    }
    const added = await toggleFavourite({
      userId: firebaseUser.uid,
      itemType: 'venue',
      itemId: current.id,
      itemTitle: current.name,
    });
    setFavIds((prev) => {
      const next = new Set(prev);
      if (added) next.add(current.id);
      else next.delete(current.id);
      return next;
    });
    setFeedback(added ? 'Saved to your favourites.' : 'Removed from favourites.');
  };

  const handleAddToItinerary = async () => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      navigate('/auth');
      return;
    }
    const future = new Date();
    future.setDate(future.getDate() + 4);
    const id = await saveItineraryToFirestore({
      ownerId: firebaseUser.uid,
      title: `${current.locality} Group Outing (${current.name})`,
      destination: current.city,
      startingLocation: 'Indiranagar, Bengaluru',
      travelDate: future.toISOString().split('T')[0],
      participantsCount: 6,
      groupType: 'Friends',
      budgetPerPerson: current.weekendPrice + 600,
      estimatedTotalPerPerson: current.weekdayPrice,
      travelMode: 'Cab / Metro',
      summary: `Quick-saved from Alba Video Discovery featuring ${current.name}.`,
      aiGenerated: false,
      aiDisclaimer: 'Curated from Alba Venue Discovery. Verify slot availability before arrival.',
      stops: [
        {
          orderIndex: 0,
          timeSlot: '01:00 PM – 04:00 PM',
          durationMinutes: 180,
          title: current.name,
          category: current.category,
          locality: current.locality,
          description: current.description,
          estimatedCostPerPerson: current.weekdayPrice,
          travelTimeNote: `${current.distanceFromCenterKm} km from MG Road`,
          alternativeOption: 'Explore nearby Indiranagar or Koramangala dining stops.',
          venueId: current.id,
          priceType: 'illustrative',
        },
      ],
    });
    setFeedback(`Added to a new itinerary (${id}). View in My Account → My Itineraries.`);
  };

  return (
    <div className="bg-[#0A1428] min-h-[calc(100vh-4rem)] text-white py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Vertical 9:16 Reel Stage */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[360px] aspect-[9/16] rounded-3xl overflow-hidden border border-slate-700 bg-slate-900">
            <SafeImage
              src={current.imageUrl}
              alt={current.name}
              className={`w-full h-full object-cover transition-transform duration-[4000ms] ease-out ${
                playing ? 'scale-110' : 'scale-100'
              }`}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/35 flex flex-col justify-between p-5">
              <div className="flex items-center justify-between text-xs text-slate-200">
                <span>
                  {current.category} · {current.reelDuration}
                </span>
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? 'Pause preview' : 'Play preview'}
                  className="p-2 rounded-full bg-black/40 hover:bg-black/60"
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-blue-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {current.locality}, {current.city}
                  </p>
                  <h1 className="font-display text-xl font-bold text-white mt-1">
                    {current.name}
                  </h1>
                  <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                    {current.reelTagline}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-300 block">Illustrative Benchmark</span>
                    <span className="font-mono text-base font-bold text-white tabular-nums">
                      ₹{current.weekdayPrice} wkdy · ₹{current.weekendPrice} wknd
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBookingVenue(current)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
                  >
                    Request Slot
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Controls & Venue Actions */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-300">
                Reel {activeIndex + 1} of {reels.length}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mt-1">
                {current.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous venue reel"
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next venue reel"
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            {current.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <span className="text-slate-400 block">Operating Hours</span>
              <span className="font-semibold text-white mt-1 block">{current.operatingHours}</span>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <span className="text-slate-400 block">Distance from MG Road</span>
              <span className="font-mono font-semibold text-white mt-1 block tabular-nums">
                {current.distanceFromCenterKm} km
              </span>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <span className="text-slate-400 block">Price-Lock Status</span>
              <span className="font-semibold text-amber-300 mt-1 block">
                {current.illustrativeOffer ? 'Awaiting Partner Lock' : 'Standard Rate'}
              </span>
            </div>
          </div>

          {feedback && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-200">
              {feedback}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveFav}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2"
            >
              <Heart
                className={`w-4 h-4 ${
                  favIds.has(current.id) ? 'fill-red-500 text-red-500' : ''
                }`}
              />
              {favIds.has(current.id) ? 'Saved' : 'Save to Favourites'}
            </button>

            <button
              type="button"
              onClick={handleAddToItinerary}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2"
            >
              <CalendarPlus className="w-4 h-4" />
              Add to Itinerary
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(`/explore?category=${encodeURIComponent(current.category)}`)
              }
              className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2"
            >
              <Compass className="w-4 h-4" />
              Explore Similar Venues
            </button>
          </div>
        </div>
      </div>

      {bookingVenue && (
        <BookingModal venue={bookingVenue} onClose={() => setBookingVenue(null)} />
      )}
    </div>
  );
}
