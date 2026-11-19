import { auth } from '../firebase';

export interface ItineraryGenerateRequest {
  destination: string;
  startingLocation: string;
  travelDate: string;
  participantsCount: number;
  groupType: 'Friends' | 'Family' | 'Couples' | 'Solo';
  budgetPerPerson: number;
  preferredActivities: string[];
  foodPreferences: string;
  travelMode: string;
  startTime: string;
  endTime: string;
  indoorOutdoor: string;
  customPrompt?: string;
}

export interface GeneratedStop {
  orderIndex: number;
  timeSlot: string;
  durationMinutes: number;
  title: string;
  category: string;
  locality: string;
  description: string;
  estimatedCostPerPerson: number;
  travelTimeNote: string;
  alternativeOption: string;
}

export interface GeneratedItineraryResponse {
  title: string;
  summary: string;
  estimatedTotalPerPerson: number;
  budgetBreakdown: {
    activitiesInr: number;
    diningInr: number;
    localTravelInr: number;
    bufferInr: number;
  };
  stops: GeneratedStop[];
  aiGenerated: boolean;
  aiDisclaimer: string;
}

async function getBearerToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in to generate AI-powered group itineraries.');
  }
  return await user.getIdToken();
}

export async function generateAiItinerary(
  payload: ItineraryGenerateRequest
): Promise<GeneratedItineraryResponse> {
  const token = await getBearerToken();
  const res = await fetch('/api/itinerary/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate AI itinerary.');
  }
  return data as GeneratedItineraryResponse;
}

export async function regenerateItineraryStop(payload: {
  destination: string;
  currentTitle: string;
  timeSlot: string;
  budgetPerPerson: number;
  groupType: string;
  preferenceNote?: string;
}): Promise<Omit<GeneratedStop, 'orderIndex'>> {
  const token = await getBearerToken();
  const res = await fetch('/api/itinerary/regenerate-stop', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to regenerate itinerary stop.');
  }
  return data;
}
