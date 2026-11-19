import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Users,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  Group,
  GroupMember,
  Itinerary,
  ItineraryStop,
  ItineraryVote,
} from '../types/alba';
import {
  generateId,
  joinGroupByInviteCode,
  subscribeGroupDetails,
  voteOnItineraryStop,
} from '../services/firestoreService';

export function GroupCollaborationPage() {
  const { groupId, inviteCode } = useParams();
  const navigate = useNavigate();
  const { firebaseUser, albaUser } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [stops, setStops] = useState<ItineraryStop[]>([]);
  const [votes, setVotes] = useState<ItineraryVote[]>([]);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinPrefs, setJoinPrefs] = useState('');
  const [error, setError] = useState('');

  // Suggest alternative stop state
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestLocality, setSuggestLocality] = useState('Indiranagar');
  const [suggestCost, setSuggestCost] = useState(600);
  const [suggesting, setSuggesting] = useState(false);

  // If arrived via /invite/:inviteCode, offer quick join
  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode || !firebaseUser) {
      navigate('/auth');
      return;
    }
    if (!firebaseUser.emailVerified) {
      setError('Please verify your email before joining a group.');
      return;
    }
    setJoining(true);
    setError('');
    try {
      const joinedGroupId = await joinGroupByInviteCode({
        inviteCode,
        userId: firebaseUser.uid,
        displayName: albaUser?.fullName || firebaseUser.displayName || 'Group Member',
        preferences: joinPrefs || 'Ready for the outing',
      });
      navigate(`/groups/${joinedGroupId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join group.');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (!groupId || !firebaseUser) return;
    const unsub = subscribeGroupDetails(groupId, setGroup, setMembers);
    return () => unsub();
  }, [groupId, firebaseUser]);

  useEffect(() => {
    if (!group?.itineraryId || !firebaseUser) return;
    const itinId = group.itineraryId;
    getDoc(doc(db, 'itineraries', itinId))
      .then(async (snap) => {
        if (!snap.exists()) return;
        const itinData = snap.data() as Itinerary;
        setItinerary(itinData);
        // Self-heal stop membership for newly joined members using itinerary.stopIds
        if (Array.isArray(itinData.stopIds) && itinData.stopIds.length > 0) {
          for (const stopId of itinData.stopIds) {
            try {
              const sSnap = await getDoc(doc(db, 'itinerary_stops', stopId));
              if (sSnap.exists()) {
                const sData = sSnap.data() as ItineraryStop;
                const existingMembers = sData.memberIds || [];
                if (!existingMembers.includes(firebaseUser.uid)) {
                  await updateDoc(doc(db, 'itinerary_stops', stopId), {
                    memberIds: Array.from(new Set([...existingMembers, ...(group.memberIds || []), firebaseUser.uid])).slice(0, 20),
                    updatedAt: serverTimestamp(),
                  });
                }
              }
            } catch {
              // Ignore individual stop sync failure
            }
          }
        }
      })
      .catch((err) => handleFirestoreError(err, OperationType.GET, `itineraries/${itinId}`));

    const unsubStops = onSnapshot(
      query(
        collection(db, 'itinerary_stops'),
        where('itineraryId', '==', itinId),
        where('memberIds', 'array-contains', firebaseUser.uid)
      ),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as ItineraryStop)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        setStops(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'itinerary_stops')
    );

    const unsubVotes = onSnapshot(
      query(
        collection(db, 'itinerary_votes'),
        where('itineraryId', '==', itinId),
        where('memberIds', 'array-contains', firebaseUser.uid)
      ),
      (snap) => setVotes(snap.docs.map((d) => d.data() as ItineraryVote)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'itinerary_votes')
    );

    return () => {
      unsubStops();
      unsubVotes();
    };
  }, [group?.itineraryId, group?.memberIds, firebaseUser]);

  if (inviteCode && !groupId) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-5">
          <Users className="w-8 h-8 text-blue-700" />
          <h1 className="font-display text-2xl font-bold text-[#0A1428]">
            You&apos;re Invited to an Alba Group Outing
          </h1>
          <p className="text-sm text-slate-600">
            Invite Code: <span className="font-mono font-semibold text-slate-900">{inviteCode}</span>
          </p>
          <form onSubmit={handleAcceptInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Food / Activity Preferences (Optional)
              </label>
              <input
                type="text"
                value={joinPrefs}
                onChange={(e) => setJoinPrefs(e.target.value)}
                placeholder="e.g. Vegetarian, love adventure & rooftop cafes"
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
              disabled={joining}
              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
            >
              {firebaseUser
                ? joining
                  ? 'Joining Group...'
                  : 'Join Group Outing'
                : 'Sign In to Join Group'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-slate-600">Loading group workspace...</p>
      </div>
    );
  }

  const isOrganizer = firebaseUser?.uid === group.organizerId;
  const inviteUrl = `${window.location.origin}/invite/${group.inviteCode}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinalize = async () => {
    if (!isOrganizer) return;
    await updateDoc(doc(db, 'groups', group.id), {
      status: 'finalized',
      updatedAt: serverTimestamp(),
    });
    if (group.itineraryId) {
      await updateDoc(doc(db, 'itineraries', group.itineraryId), {
        isFinalized: true,
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleSuggestStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !group.itineraryId || !suggestTitle.trim()) return;
    setSuggesting(true);
    try {
      const stopId = generateId('stop');
      await setDoc(doc(db, 'itinerary_stops', stopId), {
        id: stopId,
        itineraryId: group.itineraryId,
        ownerId: group.organizerId,
        memberIds: group.memberIds,
        orderIndex: stops.length,
        timeSlot: 'Member Suggestion',
        durationMinutes: 90,
        title: suggestTitle.trim(),
        category: 'Group Suggestion',
        locality: suggestLocality,
        description: `Suggested by ${albaUser?.fullName || 'Group Member'}`,
        estimatedCostPerPerson: Math.max(0, Number(suggestCost) || 0),
        priceType: 'estimated',
        travelTimeNote: 'TBD by organizer',
        venueId: '',
        suggestedByUserId: firebaseUser.uid,
        alternativeOption: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'itineraries', group.itineraryId), {
        stopIds: arrayUnion(stopId),
        updatedAt: serverTimestamp(),
      });
      setSuggestTitle('');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Group Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold text-blue-700">
            Group Workspace · Status: {group.status.toUpperCase()}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0A1428] mt-1">
            {group.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span>Destination: {group.destination}</span>
            <span>·</span>
            <span>Date: {group.tripDate}</span>
            <span>·</span>
            <span className="font-mono tabular-nums">
              Budget: ₹{group.budgetPerPerson}/person
            </span>
            <span>·</span>
            <span className="font-mono tabular-nums">
              Participants: {group.memberIds.length}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCopyInvite}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Invite Link Copied' : 'Copy Invite Link'}
          </button>

          {isOrganizer && group.status !== 'finalized' && (
            <button
              type="button"
              onClick={handleFinalize}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Finalize Group Itinerary
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Stops & Voting */}
        <div className="lg:col-span-8 space-y-4">
          <h2 className="font-display text-xl font-bold text-[#0A1428]">
            Shared Itinerary & Activity Voting
          </h2>

          {stops.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <p className="text-sm text-slate-600">
                No itinerary stops linked yet.{' '}
                <Link to="/planner" className="text-blue-700 font-semibold underline">
                  Generate an itinerary
                </Link>{' '}
                or suggest a venue below.
              </p>
            </div>
          ) : (
            stops.map((stop) => {
              const stopVotes = votes.filter((v) => v.stopId === stop.id);
              const ups = stopVotes.filter((v) => v.vote === 'up').length;
              const downs = stopVotes.filter((v) => v.vote === 'down').length;
              const myVote = stopVotes.find((v) => v.userId === firebaseUser?.uid)?.vote;

              return (
                <div
                  key={stop.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">
                      <span className="font-mono text-blue-700 font-semibold">{stop.timeSlot}</span>{' '}
                      · {stop.category} · {stop.locality}
                    </p>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {stop.title}
                    </h3>
                    <p className="text-xs text-slate-600">{stop.description}</p>
                    <p className="text-xs font-mono text-slate-700 tabular-nums">
                      Est. ₹{stop.estimatedCostPerPerson}/person
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        firebaseUser &&
                        itinerary &&
                        voteOnItineraryStop({
                          itineraryId: itinerary.id,
                          stopId: stop.id,
                          groupId: group.id,
                          userId: firebaseUser.uid,
                          userName: albaUser?.fullName || 'Member',
                          memberIds: group.memberIds,
                          vote: 'up',
                        })
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 ${
                        myVote === 'up'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums">{ups}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        firebaseUser &&
                        itinerary &&
                        voteOnItineraryStop({
                          itineraryId: itinerary.id,
                          stopId: stop.id,
                          groupId: group.id,
                          userId: firebaseUser.uid,
                          userName: albaUser?.fullName || 'Member',
                          memberIds: group.memberIds,
                          vote: 'down',
                        })
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 ${
                        myVote === 'down'
                          ? 'bg-red-50 border-red-600 text-red-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums">{downs}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Suggest Alternative Venue/Stop */}
          {group.itineraryId && (
            <form
              onSubmit={handleSuggestStop}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900">Suggest an Activity or Venue</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={suggestTitle}
                  onChange={(e) => setSuggestTitle(e.target.value)}
                  placeholder="Venue or activity name"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={suggestLocality}
                  onChange={(e) => setSuggestLocality(e.target.value)}
                  placeholder="Locality"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="number"
                  value={suggestCost}
                  onChange={(e) => setSuggestCost(Number(e.target.value) || 0)}
                  placeholder="Est. cost/person"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={suggesting}
                className="px-4 py-2 bg-[#0A1428] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {suggesting ? 'Adding...' : 'Add Suggestion for Vote'}
              </button>
            </form>
          )}
        </div>

        {/* Participants & Preferences */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-[#0A1428]">
              Group Members ({members.length})
            </h2>
            <div className="space-y-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>{m.displayName}</span>
                    <span className="text-blue-700 capitalize">{m.role}</span>
                  </div>
                  {m.preferences && (
                    <p className="text-slate-600 mt-1">{m.preferences}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              Note: Automated split payments are disabled in the initial MVP. The Group Organizer
              coordinates booking submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
