import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseProjectId = process.env.FIREBASE_PROJECT_ID || '';
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
    if (parsed.projectId && parsed.projectId !== 'remixed-project-id') {
      firebaseProjectId = parsed.projectId;
    }
  } catch (err) {
    console.error('Failed to read firebase-applet-config.json:', err);
  }
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp(firebaseProjectId ? { projectId: firebaseProjectId } : undefined);
const adminAuth = getAuth(adminApp);

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AuthenticatedRequest extends Request {
  uid?: string;
  userEmail?: string;
}

// Simple sliding-window rate limiter per UID/IP
const rateLimitMap = new Map<string, number[]>();
function rateLimit(maxRequests = 20, windowMs = 60_000) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const key = req.uid || req.ip || 'anonymous';
    const now = Date.now();
    const timestamps = (rateLimitMap.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before trying again.' });
      return;
    }
    timestamps.push(now);
    rateLimitMap.set(key, timestamps);
    next();
  };
}

async function verifyFirebaseToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in to use Alba AI & Concierge services.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Invalid authorization token.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.uid = decoded.uid;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    console.error('Firebase ID token verification failed:', error);
    res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'alba-concierge', timestamp: new Date().toISOString() });
  });

  // Protected AI Group Itinerary Generator
  app.post(
    '/api/itinerary/generate',
    verifyFirebaseToken,
    rateLimit(15, 60_000),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!process.env.GEMINI_API_KEY) {
          res.status(503).json({
            error: 'Gemini API key is not configured in server environment secrets.',
          });
          return;
        }

        const {
          destination = 'Bengaluru',
          startingLocation = 'Indiranagar, Bengaluru',
          travelDate,
          participantsCount = 6,
          groupType = 'Friends',
          budgetPerPerson = 2000,
          preferredActivities = [],
          foodPreferences = 'Flexible / Cafes & Rooftop Dining',
          travelMode = 'Cab / Metro',
          startTime = '09:30',
          endTime = '21:30',
          indoorOutdoor = 'Balanced Mix',
          customPrompt = '',
        } = req.body || {};

        if (!travelDate || typeof travelDate !== 'string') {
          res.status(400).json({ error: 'Travel date is required.' });
          return;
        }

        const safeParticipants = Math.min(Math.max(Number(participantsCount) || 4, 1), 50);
        const safeBudget = Math.min(Math.max(Number(budgetPerPerson) || 1500, 300), 100000);

        const promptText = `Create a realistic, well-paced day outing itinerary for ${destination}, India.
Group Details:
- Starting Location: ${startingLocation}
- Travel Date: ${travelDate}
- Group Size: ${safeParticipants} people (${groupType})
- Budget Cap Per Person: ₹${safeBudget} INR
- Preferred Activities: ${Array.isArray(preferredActivities) && preferredActivities.length ? preferredActivities.join(', ') : 'Adventure, Dining, Scenic Hangouts'}
- Food Preferences: ${foodPreferences}
- Preferred Travel Mode: ${travelMode}
- Schedule Window: ${startTime} to ${endTime}
- Setting Preference: ${indoorOutdoor}
${customPrompt ? `- Additional Request: ${String(customPrompt).slice(0, 400)}` : ''}

Strict Honesty Rules:
- Only recommend realistic localities and experience types in or around ${destination} (e.g., Indiranagar, Koramangala, Kanakapura Road, Nandi Hills, Whitefield, Church Street, MG Road, Yelahanka).
- NEVER invent live ticket availability or claim reservations are confirmed.
- Mark every cost as an estimated budget figure (not a guaranteed partner quote).
- Include logical transit buffers, dining breaks, and an alternative activity option per stop.
- Keep total estimated expenditure per person aligned within ₹${safeBudget}.`;

        const response = await getAiClient().models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: promptText,
          config: {
            systemInstruction:
              'You are Alba Concierge, an honest, practical Bengaluru and Indian metro group outing planner. Return valid JSON matching the requested schema. Keep descriptions concise and grounded.',
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                estimatedTotalPerPerson: { type: Type.NUMBER },
                budgetBreakdown: {
                  type: Type.OBJECT,
                  properties: {
                    activitiesInr: { type: Type.NUMBER },
                    diningInr: { type: Type.NUMBER },
                    localTravelInr: { type: Type.NUMBER },
                    bufferInr: { type: Type.NUMBER },
                  },
                  required: ['activitiesInr', 'diningInr', 'localTravelInr', 'bufferInr'],
                },
                stops: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      orderIndex: { type: Type.INTEGER },
                      timeSlot: { type: Type.STRING },
                      durationMinutes: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      category: { type: Type.STRING },
                      locality: { type: Type.STRING },
                      description: { type: Type.STRING },
                      estimatedCostPerPerson: { type: Type.NUMBER },
                      travelTimeNote: { type: Type.STRING },
                      alternativeOption: { type: Type.STRING },
                    },
                    required: [
                      'orderIndex',
                      'timeSlot',
                      'durationMinutes',
                      'title',
                      'category',
                      'locality',
                      'description',
                      'estimatedCostPerPerson',
                      'travelTimeNote',
                      'alternativeOption',
                    ],
                  },
                },
              },
              required: ['title', 'summary', 'estimatedTotalPerPerson', 'budgetBreakdown', 'stops'],
            },
          },
        });

        const rawText = response.text;
        if (!rawText) {
          res.status(502).json({ error: 'AI service returned an empty itinerary response.' });
          return;
        }

        const parsed = JSON.parse(rawText);
        if (!parsed || !Array.isArray(parsed.stops) || parsed.stops.length === 0) {
          res.status(502).json({ error: 'AI itinerary output failed structural validation.' });
          return;
        }

        res.json({
          ...parsed,
          aiGenerated: true,
          aiDisclaimer:
            'AI-generated planning estimate. All costs are indicative estimates; live slot availability and official rates require Venue Partner confirmation.',
        });
      } catch (error) {
        console.error('Error generating itinerary:', error);
        const msg = error instanceof Error ? error.message : 'Failed to generate itinerary';
        res.status(500).json({ error: msg });
      }
    }
  );

  // Protected single-stop regeneration
  app.post(
    '/api/itinerary/regenerate-stop',
    verifyFirebaseToken,
    rateLimit(20, 60_000),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!process.env.GEMINI_API_KEY) {
          res.status(503).json({ error: 'Gemini API key is not configured.' });
          return;
        }
        const {
          destination = 'Bengaluru',
          currentTitle,
          timeSlot,
          budgetPerPerson = 500,
          groupType = 'Friends',
          preferenceNote = '',
        } = req.body || {};

        const response = await getAiClient().models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Suggest a fresh alternative stop in ${destination} for time slot "${timeSlot}" replacing "${currentTitle}". Group type: ${groupType}. Target spend per person: ~₹${budgetPerPerson}. ${preferenceNote ? `Note: ${preferenceNote}` : ''}`,
          config: {
            systemInstruction:
              'You are Alba Concierge. Provide one grounded alternative stop in JSON. Never fabricate availability or confirm reservations.',
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: { type: Type.STRING },
                locality: { type: Type.STRING },
                description: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                estimatedCostPerPerson: { type: Type.NUMBER },
                travelTimeNote: { type: Type.STRING },
                alternativeOption: { type: Type.STRING },
              },
              required: [
                'title',
                'category',
                'locality',
                'description',
                'durationMinutes',
                'estimatedCostPerPerson',
                'travelTimeNote',
                'alternativeOption',
              ],
            },
          },
        });

        const rawText = response.text;
        if (!rawText) {
          res.status(502).json({ error: 'Empty response from AI stop regenerator.' });
          return;
        }
        res.json(JSON.parse(rawText));
      } catch (error) {
        console.error('Error regenerating stop:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to regenerate stop' });
      }
    }
  );

  // Server-side Financial & Commission Calculation Endpoint
  app.post('/api/financial/calculate', verifyFirebaseToken, (req: AuthenticatedRequest, res: Response) => {
    const {
      lockedUnitPrice = 0,
      standardWeekendUnitPrice = 0,
      participants = 1,
      commissionRatePercent = 15,
      variableCostPerTxn = 50,
    } = req.body || {};

    const qty = Math.max(1, Math.min(100, Number(participants) || 1));
    const unit = Math.max(0, Number(lockedUnitPrice) || 0);
    const stdUnit = Math.max(unit, Number(standardWeekendUnitPrice) || unit);
    const rate = Math.max(0, Math.min(50, Number(commissionRatePercent) || 15));

    const grossAmount = Math.round(unit * qty);
    const standardGross = Math.round(stdUnit * qty);
    const customerSavings = Math.max(0, standardGross - grossAmount);
    const platformCommission = Math.round((grossAmount * rate) / 100);
    const merchantPayable = Math.max(0, grossAmount - platformCommission);
    const contributionMargin = platformCommission - Number(variableCostPerTxn || 50);

    res.json({
      grossAmount,
      customerSavings,
      commissionRatePercent: rate,
      platformCommission,
      merchantPayable,
      contributionMargin,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Alba server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Alba server:', err);
  process.exit(1);
});
