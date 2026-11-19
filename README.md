# Alba — AI-Powered Travel, Group Planning & Lifestyle Concierge

**Alba Ltd.** | *Plan Together. Explore More. Save Smarter.*  
Initial Launch Market: **Bengaluru, India**

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, React Router DOM
- **Backend:** Express (`server.ts`), Firebase Admin SDK (`verifyIdToken`), Google Gemini API (`@google/genai`)
- **Database & Auth:** Cloud Firestore, Firebase Authentication (Google Sign-In + Email/Password), Firebase Storage

## Environment Variables
Copy `.env.example` to `.env` locally (never commit `.env`):
- `GEMINI_API_KEY` — Server-side Gemini API key for AI itinerary generation
- `APP_URL` — Public application URL

## Firebase Console Setup
1. Provisioned project configuration lives in `firebase-applet-config.json`.
2. Deploy security rules (`firestore.rules`) and composite indexes (`firestore.indexes.json`) via Firebase CLI or AI Studio.
3. **Important:** Enable **Email/Password** in **Firebase Console → Authentication → Sign-in method** alongside Google Sign-In so email registration, verification, and password resets work for customers and partners.

## Local Development & Production Build
```bash
npm install
npm run dev      # Starts Express + Vite middleware on port 3000
npm run lint     # Runs TypeScript type-checking (tsc --noEmit)
npm run build    # Builds Vite production bundle to dist/
npm start        # Runs Express production server via Node (port 3000)
```

## GitHub & Vercel Deployment (`alba-travel-concierge`)
- Default branch: `main`
- Configure `GEMINI_API_KEY` in Vercel / Cloud environment secrets before deploying.
