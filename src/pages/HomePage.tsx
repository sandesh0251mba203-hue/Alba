import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Play,
  ShieldCheck,
  Users,
  Calendar,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import {
  HERO_IMAGE,
  BENGALURU_REFERENCE_VENUES,
  BENGALURU_LOCALITIES,
  VENUE_CATEGORIES,
  SUPPORTED_CITIES,
  PILOT_TESTIMONIALS,
  FAQ_ITEMS,
  VENUE_IMAGES,
} from '../data/bengaluruCatalog';
import { SafeImage } from '../components/SafeImage';
import { Venue } from '../types/alba';
import { fetchApprovedVenues, createSupportTicket } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const navigate = useNavigate();
  const { firebaseUser, albaUser } = useAuth();

  // Search bar state
  const [city, setCity] = useState('Bengaluru');
  const [locality, setLocality] = useState('');
  const [category, setCategory] = useState('');
  const [venueQuery, setVenueQuery] = useState('');
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
  });
  const [participants, setParticipants] = useState(6);
  const [budget, setBudget] = useState(2000);
  const [groupType, setGroupType] = useState('Friends');

  // Price-lock interactive calculator state
  const [calcGuests, setCalcGuests] = useState(6);
  const [calcWeekday, setCalcWeekday] = useState(800);
  const [calcWeekend, setCalcWeekend] = useState(1000);

  // Live Firestore approved venues merged cleanly with illustrative benchmarks
  const [liveVenues, setLiveVenues] = useState<Venue[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Contact & Support Inquiry Form
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportCategory, setSupportCategory] = useState('General Enquiry');
  const [supportFeedback, setSupportFeedback] = useState('');
  const [supportSending, setSupportSending] = useState(false);

  useEffect(() => {
    fetchApprovedVenues()
      .then((items) => setLiveVenues(items))
      .catch(() => {
        // Public list query fallback handled gracefully
      });
  }, []);

  const displayedVenues: Venue[] =
    liveVenues.length > 0 ? liveVenues.slice(0, 4) : BENGALURU_REFERENCE_VENUES.slice(0, 4);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({
      city,
      locality,
      category,
      q: venueQuery,
      date: travelDate,
      participants: String(participants),
      budget: String(budget),
      groupType,
    });
    navigate(`/explore?${params.toString()}`);
  };

  const handlePlanQuickLaunch = () => {
    const params = new URLSearchParams({
      destination: city,
      date: travelDate,
      participants: String(participants),
      budget: String(budget),
      groupType,
    });
    navigate(`/planner?${params.toString()}`);
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportFeedback('');
    if (!firebaseUser) {
      navigate('/auth');
      return;
    }
    if (!firebaseUser.emailVerified) {
      setSupportFeedback('Please verify your email address in your account before submitting a support ticket.');
      return;
    }
    setSupportSending(true);
    try {
      const ticketId = await createSupportTicket({
        userId: firebaseUser.uid,
        userName: albaUser?.fullName || firebaseUser.displayName || 'Alba User',
        category: supportCategory,
        priority: 'medium',
        subject: supportSubject,
        initialMessage: supportMessage,
        senderRole: 'customer',
      });
      setSupportSubject('');
      setSupportMessage('');
      setSupportFeedback(`Support ticket ${ticketId} created. Track replies in Account → Support.`);
    } catch (err) {
      setSupportFeedback(err instanceof Error ? err.message : 'Could not submit inquiry.');
    } finally {
      setSupportSending(false);
    }
  };

  const savingsPerTicket = Math.max(0, calcWeekend - calcWeekday);
  const totalGroupSavings = savingsPerTicket * calcGuests;

  return (
    <div className="bg-slate-50 text-slate-900">
      {/* 2. Hero Section */}
      <section className="bg-[#0A1428] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-10 lg:pt-16 lg:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-blue-300 mb-3">
                Bengaluru Launch · Group Outing Concierge
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] [text-wrap:balance]">
                Your Perfect Group Getaway Starts with Alba.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                Plan unforgettable outings, discover amazing places, and secure better prices — all
                in one intelligent platform.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handlePlanQuickLaunch}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  Plan My Trip
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/explore"
                  className="px-6 py-3 bg-white/10 hover:bg-white/15 text-white border border-white/20 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Explore Experiences
                </Link>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                <span>AI Group Itinerary Builder</span>
                <span aria-hidden="true">·</span>
                <span>Shared Voting & Cost Clarity</span>
                <span aria-hidden="true">·</span>
                <span>3+ Day Advance Weekday Price-Lock</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-72 sm:h-96 lg:h-full min-h-[340px] rounded-2xl overflow-hidden border border-slate-800 relative">
                <SafeImage
                  src={HERO_IMAGE}
                  alt="Friends dining at a Bengaluru rooftop terrace at twilight"
                  className="w-full h-full object-cover"
                  fallbackTitle="Alba Bengaluru Group Outings"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent flex items-end p-6">
                  <div className="text-sm text-white/95">
                    <p className="font-semibold">Plan Together. Explore More. Save Smarter.</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Built for 3–10 person weekend crews in Bengaluru
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-10 bg-white text-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {SUPPORTED_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.status})
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">All Experience Categories</option>
                  {VENUE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Venue Name</label>
                <input
                  type="text"
                  value={venueQuery}
                  onChange={(e) => setVenueQuery(e.target.value)}
                  placeholder="Search venue or activity"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Outing Date</label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Participants
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={participants}
                  onChange={(e) => setParticipants(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Budget / Person (₹)
                </label>
                <input
                  type="number"
                  min={300}
                  step={100}
                  value={budget}
                  onChange={(e) => setBudget(Math.max(300, Number(e.target.value) || 1000))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Group Type
                  </label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Friends">Friends</option>
                    <option value="Family">Family</option>
                    <option value="Couples">Couples</option>
                    <option value="Solo">Solo</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0A1428] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors h-[38px] shrink-0"
                >
                  <Search className="w-4 h-4" />
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* 3. AI Trip Planner Spotlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-semibold text-violet-700">
              AI Group Itinerary Builder
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428] tracking-tight [text-wrap:balance]">
              Turn one group brief into a complete, voteable Bengaluru day plan.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
              Enter your starting locality, group size, food preferences, and budget per person.
              Alba sequences activities, transit buffers, dining stops, and backup alternatives —
              clearly separating AI planning estimates from partner-verified rates.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePlanQuickLaunch}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors"
              >
                Open AI Itinerary Builder
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/explore"
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-lg transition-colors"
              >
                Browse Approved & Reference Venues
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Sample Prompt Input</p>
            <p className="text-sm text-slate-800 italic leading-relaxed">
              &ldquo;Plan a Saturday outing in Bengaluru for six friends with a budget of ₹2,000 per
              person. We enjoy adventure activities, good food, and scenic places.&rdquo;
            </p>
            <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div>
                <span className="block text-slate-500">Output Format</span>
                <span className="font-semibold text-slate-900">Time-Slotted JSON Plan</span>
              </div>
              <div>
                <span className="block text-slate-500">Group Collaboration</span>
                <span className="font-semibold text-slate-900">Share Link & Live Voting</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Explore Experiences + 5. Popular Weekend Destinations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428] tracking-tight">
              Explore Experiences
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Filter across 12 curated outing categories in Bengaluru.
            </p>
          </div>
          <Link
            to="/explore"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
          >
            View All Venues <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {VENUE_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              to={`/explore?category=${encodeURIComponent(cat)}`}
              className="bg-white border border-slate-200 hover:border-blue-600 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-800 hover:text-blue-700 transition-colors"
            >
              {cat}
            </Link>
          ))}
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-4 gap-5">
          {[
            {
              title: 'Kanakapura Adventure Belt',
              meta: '45 mins South · Outdoor & Ziplines',
              img: VENUE_IMAGES.adventure,
              locality: 'Kanakapura Road',
            },
            {
              title: 'Indiranagar 100ft Road',
              meta: 'Central East · Rooftop Dining & Cafes',
              img: VENUE_IMAGES.dining,
              locality: 'Indiranagar',
            },
            {
              title: 'Whitefield Motorsport Corridor',
              meta: 'East Tech Hub · Karting & Team Outings',
              img: VENUE_IMAGES.gokart,
              locality: 'Whitefield',
            },
            {
              title: 'Nandi Hills Foothills',
              meta: '60 km North · Sunrise Retreats',
              img: VENUE_IMAGES.retreat,
              locality: 'Nandi Hills Foothills',
            },
          ].map((dest) => (
            <Link
              key={dest.title}
              to={`/explore?locality=${encodeURIComponent(dest.locality)}`}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-600 transition-colors"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <SafeImage
                  src={dest.img}
                  alt={dest.title}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500">{dest.meta}</p>
                <h3 className="font-display text-base font-bold text-slate-900 mt-1">
                  {dest.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 6. Trending Activities & 7. Featured Venues */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428] tracking-tight">
                Featured Venues & Trending Outings
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Live partner-approved listings and clearly labeled Bengaluru reference benchmarks.
              </p>
            </div>
            <Link
              to="/explore"
              className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Explore Map & Venues <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedVenues.map((venue) => (
              <div
                key={venue.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] overflow-hidden">
                    <SafeImage
                      src={venue.imageUrl}
                      alt={venue.name}
                      className="w-full h-full object-cover"
                      fallbackTitle={venue.name}
                    />
                  </div>
                  <div className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{venue.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{venue.locality}</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {venue.name}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {venue.description}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      {venue.isIllustrativeListing ? 'Illustrative Benchmark' : 'Verified Partner'}
                    </p>
                    <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      ₹{venue.weekdayPrice} wkdy / ₹{venue.weekendPrice} wknd
                    </p>
                  </div>
                  <Link
                    to={`/explore?venue=${encodeURIComponent(venue.id)}`}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0A1428] hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Inspect
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Weekend Price-Lock Offers */}
      <section id="price-lock" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-[#0A1428] text-white rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-4">
            <p className="text-xs font-semibold text-emerald-400">
              Advance Weekday Price-Lock Mechanism
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight [text-wrap:balance]">
              Lock weekday rates for weekend group slots — booked 3+ days ahead.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Avoid last-minute weekend surge fees. When verified Alba Venue Partners publish
              advance inventory at least 3 days prior to the outing date, your group locks the
              agreed weekday rate transparently at checkout.
            </p>
            <p className="text-xs text-slate-400">
              Honesty disclosure: The calculator on the right illustrates benchmark savings (e.g.,
              ₹800 weekday vs. ₹1,000 weekend). Live guaranteed discounts apply only to partner-confirmed offers.
            </p>
          </div>

          <div className="lg:col-span-6 bg-white text-slate-900 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Illustrative Savings Calculator</h3>
              <span className="text-xs text-slate-500">Min. 3 days advance</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Group Size</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={calcGuests}
                  onChange={(e) => setCalcGuests(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Weekday (₹)</label>
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={calcWeekday}
                  onChange={(e) => setCalcWeekday(Math.max(100, Number(e.target.value) || 100))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Weekend (₹)</label>
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={calcWeekend}
                  onChange={(e) => setCalcWeekend(Math.max(100, Number(e.target.value) || 100))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-900">
                  Illustrative Group Savings ({calcGuests} guests)
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  ₹{savingsPerTicket} saved per ticket · Locked price ₹{calcWeekday}
                </p>
              </div>
              <p className="font-mono text-2xl font-bold text-emerald-800 tabular-nums">
                ₹{totalGroupSavings.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 9. Video-Based Venue Discovery & 10. How Alba Works & 11. Group Benefits */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-16">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-semibold text-blue-700">Short-Form Venue Reels</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428] tracking-tight">
              Preview the real atmosphere before your group books.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Swipe through vertical venue previews with honest operating hours, locality context,
              and Price-Lock comparisons. Save favourites or add stops straight into your group
              itinerary.
            </p>
            <Link
              to="/discover-video"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A1428] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Open Vertical Video Discovery
            </Link>
          </div>
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            {BENGALURU_REFERENCE_VENUES.slice(0, 2).map((item) => (
              <Link
                key={item.id}
                to="/discover-video"
                className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 group"
              >
                <SafeImage
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 flex flex-col justify-end text-white">
                  <p className="text-xs font-semibold line-clamp-1">{item.name}</p>
                  <p className="text-[11px] text-slate-300">{item.locality}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 10. How Alba Works */}
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428] tracking-tight mb-6">
            How Alba Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01. Brief & Generate',
                body: 'Share your Bengaluru locality, headcount, food preferences, and budget per person. Gemini structures a paced itinerary with backup stops.',
              },
              {
                num: '02. Share & Vote',
                body: 'Send one invitation link to friends. Group members vote on activities and suggest swaps in real time.',
              },
              {
                num: '03. Check Price-Lock',
                body: 'When booking 3+ days ahead at verified partners, unlock agreed weekday pricing instead of weekend surge rates.',
              },
              {
                num: '04. Request & Confirm',
                body: 'Submit one coordinated group booking request. Venue Partners confirm slot availability and payment instructions transparently.',
              },
            ].map((step) => (
              <div key={step.num} className="bg-white border border-slate-200 rounded-2xl p-6">
                <h3 className="font-display text-base font-bold text-[#0A1428]">{step.num}</h3>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 11. Group Planning Benefits & 12. Pilot Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-2xl font-bold text-[#0A1428]">
              Built for Group Outing Captains
            </h2>
            <ul className="space-y-4 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <span>Eliminate scattered WhatsApp polls with one shareable group itinerary.</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <span>Distinguish partner-verified pricing from illustrative AI estimates.</span>
              </li>
              <li className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <span>Lock advance slots early so Saturday evenings never sell out last minute.</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <span>Compare localities and commute corridors across Bengaluru in one map view.</span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-bold text-[#0A1428]">
                Pre-Launch Pilot Insights
              </h2>
              <span className="text-xs text-slate-500">Bengaluru group captain interviews</span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {PILOT_TESTIMONIALS.map((t) => (
                <div key={t.name} className="bg-white border border-slate-200 rounded-2xl p-5">
                  <p className="text-sm text-slate-700 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900">
                      {t.name} · {t.role}
                    </span>
                    <span className="text-slate-500">{t.context}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 13. Venue Partner Registration */}
      <section className="bg-white border-y border-slate-200 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold text-blue-700">For Bengaluru Venue Owners</p>
            <h2 className="font-display text-2xl font-bold text-[#0A1428] mt-1">
              Turn advance group bookings into predictable weekend occupancy.
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Register your venue, manage time-slot inventory, approve group requests, and publish
              3+ day advance weekday-rate Price-Lock offers inside the Partner Dashboard.
            </p>
          </div>
          <Link
            to="/partner"
            className="px-6 py-3 bg-[#0A1428] hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Register Venue Partner
          </Link>
        </div>
      </section>

      {/* 14. FAQs & 15. Contact and Support */}
      <section id="contact-support" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl font-bold text-[#0A1428] mb-5">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {FAQ_ITEMS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={faq.q}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-slate-900"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="font-display text-xl font-bold text-[#0A1428]">
                Contact & Concierge Support
              </h2>
              <p className="text-xs text-slate-600 mt-1 mb-4">
                Have a question about group outings, partner onboarding, or a booking request?
              </p>

              <form onSubmit={handleSupportSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Topic
                  </label>
                  <select
                    value={supportCategory}
                    onChange={(e) => setSupportCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option>General Enquiry</option>
                    <option>Group Planning Assistance</option>
                    <option>Booking / Refund Support</option>
                    <option>Venue Partner Onboarding</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    placeholder="Brief summary of your question"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Message
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="How can Alba help?"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                {supportFeedback && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{supportFeedback}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={supportSending}
                  className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {firebaseUser
                    ? supportSending
                      ? 'Submitting Ticket...'
                      : 'Submit Support Ticket'
                    : 'Sign In to Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
