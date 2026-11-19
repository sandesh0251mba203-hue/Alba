import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  Clock,
  Heart,
  ShieldCheck,
  X,
  Star,
  CalendarPlus,
} from 'lucide-react';
import {
  BENGALURU_LOCALITIES,
  BENGALURU_REFERENCE_VENUES,
  VENUE_CATEGORIES,
} from '../data/bengaluruCatalog';
import { PriceLockOffer, Review, Venue } from '../types/alba';
import {
  fetchActivePriceLockOffers,
  fetchApprovedVenues,
  fetchUserFavourites,
  fetchVenueReviews,
  toggleFavourite,
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { SafeImage } from '../components/SafeImage';
import { BengaluruMapReady } from '../components/BengaluruMapReady';
import { BookingModal } from '../components/BookingModal';

export function ExploreVenuesPage() {
  const [searchParams] = useSearchParams();
  const { firebaseUser } = useAuth();

  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [locality, setLocality] = useState(searchParams.get('locality') || '');
  const [queryText, setQueryText] = useState(searchParams.get('q') || '');
  const [maxBudget, setMaxBudget] = useState(Number(searchParams.get('budget')) || 5000);

  const [firestoreVenues, setFirestoreVenues] = useState<Venue[]>([]);
  const [offers, setOffers] = useState<PriceLockOffer[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedReviews, setSelectedReviews] = useState<Review[]>([]);
  const [bookingTarget, setBookingTarget] = useState<{
    venue: Venue;
    offer?: PriceLockOffer | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchApprovedVenues(), fetchActivePriceLockOffers()])
      .then(([vList, oList]) => {
        if (!mounted) return;
        setFirestoreVenues(vList);
        setOffers(oList);
        const paramId = searchParams.get('venue');
        if (paramId) {
          const all = [...vList, ...BENGALURU_REFERENCE_VENUES];
          const found = all.find((item) => item.id === paramId);
          if (found) setSelectedVenue(found);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!firebaseUser) {
      setFavIds(new Set());
      return;
    }
    fetchUserFavourites(firebaseUser.uid)
      .then((favs) => setFavIds(new Set(favs.map((f) => f.itemId))))
      .catch(() => {});
  }, [firebaseUser]);

  useEffect(() => {
    if (!selectedVenue) {
      setSelectedReviews([]);
      return;
    }
    fetchVenueReviews(selectedVenue.id)
      .then(setSelectedReviews)
      .catch(() => setSelectedReviews([]));
  }, [selectedVenue]);

  const allVenues = useMemo(() => {
    const liveIds = new Set(firestoreVenues.map((v) => v.id));
    const refs = BENGALURU_REFERENCE_VENUES.filter((r) => !liveIds.has(r.id));
    return [...firestoreVenues, ...refs];
  }, [firestoreVenues]);

  const filteredVenues = useMemo(() => {
    return allVenues.filter((v) => {
      if (category && v.category !== category) return false;
      if (locality && v.locality !== locality) return false;
      if (v.weekendPrice > maxBudget) return false;
      if (queryText.trim()) {
        const q = queryText.toLowerCase();
        const match =
          v.name.toLowerCase().includes(q) ||
          v.locality.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allVenues, category, locality, maxBudget, queryText]);

  const getOfferForVenue = (venue: Venue): PriceLockOffer | undefined => {
    const live = offers.find((o) => o.venueId === venue.id);
    if (live) return live;
    const ref = BENGALURU_REFERENCE_VENUES.find((r) => r.id === venue.id);
    return ref?.illustrativeOffer;
  };

  const handleToggleFav = async (venue: Venue) => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const added = await toggleFavourite({
      userId: firebaseUser.uid,
      itemType: 'venue',
      itemId: venue.id,
      itemTitle: venue.name,
    });
    setFavIds((prev) => {
      const next = new Set(prev);
      if (added) next.add(venue.id);
      else next.delete(venue.id);
      return next;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <p className="text-xs font-semibold text-blue-700">Bengaluru Venue Discovery</p>
        <h1 className="font-display text-3xl font-bold text-[#0A1428] tracking-tight mt-1">
          Explore Experiences & Price-Lock Offers
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Browse verified partner listings alongside clearly marked illustrative Bengaluru reference venues.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Venue, locality, or activity"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Categories</option>
            {VENUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Locality</label>
          <select
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Bengaluru Localities</option>
            {BENGALURU_LOCALITIES.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Max Weekend Price: <span className="font-mono">₹{maxBudget}</span>
          </label>
          <input
            type="range"
            min={500}
            max={5000}
            step={100}
            value={maxBudget}
            onChange={(e) => setMaxBudget(Number(e.target.value))}
            className="w-full mt-2 accent-blue-700"
          />
        </div>
      </div>

      {/* Interactive Map-Ready Explorer */}
      <BengaluruMapReady
        venues={filteredVenues}
        selectedVenueId={selectedVenue?.id}
        onSelectVenue={(v) => setSelectedVenue(v)}
      />

      {/* Venue Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-80 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredVenues.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">
            No venues match your current filter selection.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory('');
              setLocality('');
              setQueryText('');
              setMaxBudget(5000);
            }}
            className="px-4 py-2 bg-[#0A1428] text-white text-xs font-semibold rounded-lg"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVenues.map((venue) => {
            const offer = getOfferForVenue(venue);
            const isFav = favIds.has(venue.id);

            return (
              <div
                key={venue.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <SafeImage
                      src={venue.imageUrl}
                      alt={venue.name}
                      className="w-full h-full object-cover"
                      fallbackTitle={venue.name}
                    />
                    {firebaseUser && (
                      <button
                        type="button"
                        onClick={() => handleToggleFav(venue)}
                        aria-label="Toggle favourite"
                        className="absolute top-3 right-3 p-2 rounded-lg bg-white/90 hover:bg-white text-slate-800 border border-slate-200"
                      >
                        <Heart
                          className={`w-4 h-4 ${isFav ? 'fill-red-600 text-red-600' : ''}`}
                        />
                      </button>
                    )}
                  </div>

                  <div className="p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{venue.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{venue.locality}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {venue.isIllustrativeListing ? 'Reference Benchmark' : 'Partner Verified'}
                      </span>
                    </div>

                    <h2 className="font-display text-lg font-bold text-slate-900">{venue.name}</h2>
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {venue.description}
                    </p>

                    <div className="pt-2 text-xs text-slate-500 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {venue.operatingHours || '10:00 AM – 10:00 PM'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500 block">
                        {offer
                          ? offer.offerStatus === 'active'
                            ? 'Advance Price-Lock (3+ days)'
                            : 'Illustrative Advance Lock'
                          : 'Weekend Rate'}
                      </span>
                      <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        ₹{offer ? offer.albaAdvancePrice : venue.weekendPrice}
                      </span>
                      {offer && (
                        <span className="ml-2 font-mono text-slate-400 line-through tabular-nums">
                          ₹{offer.weekendPrice}
                        </span>
                      )}
                    </div>
                    {offer && (
                      <span className="text-xs font-semibold text-emerald-700">
                        {offer.offerStatus === 'active'
                          ? `Save ${offer.discountPercent || 20}%`
                          : 'Awaiting Partner'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVenue(venue)}
                      className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Details & Reviews
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingTarget({ venue, offer: offer || null })}
                      className="flex-1 py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Book Slot
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden my-8">
            <div className="relative h-56">
              <SafeImage
                src={selectedVenue.imageUrl}
                alt={selectedVenue.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedVenue(null)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-slate-950/75 text-white hover:bg-slate-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs text-slate-500">
                  {selectedVenue.category} · {selectedVenue.locality}, {selectedVenue.city} ·{' '}
                  {selectedVenue.isIllustrativeListing
                    ? 'Illustrative Reference Listing'
                    : 'Verified Partner'}
                </p>
                <h2 className="font-display text-2xl font-bold text-[#0A1428] mt-1">
                  {selectedVenue.name}
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  {selectedVenue.description}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Weekday Rate</span>
                  <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    ₹{selectedVenue.weekdayPrice}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Weekend Rate</span>
                  <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    ₹{selectedVenue.weekendPrice}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-500 block">Hours</span>
                  <span className="font-medium text-slate-900">
                    {selectedVenue.operatingHours || '10:00 AM – 10:00 PM'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{selectedVenue.address || `${selectedVenue.locality}, ${selectedVenue.city}`}</span>
              </div>

              {/* Verified Reviews */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    Verified Booking Reviews
                  </h3>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {selectedReviews.length} verified reviews
                  </span>
                </div>

                {selectedReviews.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No verified booking reviews yet. Only customers with completed bookings can post
                    reviews.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {selectedReviews.map((rev) => (
                      <div key={rev.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>{rev.customerName}</span>
                          <span className="inline-flex items-center gap-1 text-amber-600 font-mono">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            {rev.rating}/5
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1">{rev.comment}</p>
                        {rev.partnerResponse && (
                          <p className="mt-2 pt-2 border-t border-slate-200 text-slate-700">
                            <strong>Partner Reply:</strong> {rev.partnerResponse}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVenue(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const offer = getOfferForVenue(selectedVenue) || null;
                    setBookingTarget({ venue: selectedVenue, offer });
                    setSelectedVenue(null);
                  }}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
                >
                  Request Booking Slot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bookingTarget && (
        <BookingModal
          venue={bookingTarget.venue}
          offer={bookingTarget.offer}
          onClose={() => setBookingTarget(null)}
        />
      )}
    </div>
  );
}
