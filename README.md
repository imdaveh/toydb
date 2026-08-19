ToyDB - simple auth demo (Node + MySQL + React + Tailwind)

Structure
- backend/  Express API (MySQL, JWT refresh flow)
- frontend/ Vite + React + Tailwind UI

Quick start
1. Backend
   - Copy backend/.env.example to backend/.env and set DB credentials and long secrets
   - Run the SQL in backend/migrations/init.sql on your MySQL server
   - cd backend && npm install && npm start

2. Frontend
   - cd frontend && npm install && npm run dev
   - Open http://localhost:5173

Testing the PWA locally
1. Start the backend in one terminal:
   - cd backend
   - npm start
2. Build the frontend so Vite generates the PWA service worker:
   - cd frontend
   - npm run build
3. Serve the production build in another terminal:
   - cd frontend
   - npm run preview
4. Open the preview URL, normally http://localhost:4173.

The Vite development server is useful for normal UI work, but the installable PWA
service worker is generated and tested through the production build and preview.
Because localhost is treated as a secure context, Chrome or Edge should show an
Install ToyDB option in the address bar or browser menu when the manifest and
service worker are available.

PWA verification checklist
- Open DevTools > Application > Manifest and confirm the ToyDB name, colors, and logo.
- Open DevTools > Application > Service Workers and confirm the service worker is running.
- Install ToyDB from the browser menu, launch it, and confirm it opens in standalone mode.
- In DevTools > Application > Cache Storage, confirm the app shell assets are cached.
- To retest after changes, rebuild with npm run build, restart npm run preview, and
  unregister the old service worker from DevTools if the browser is serving stale files.

Security notes
- Use strong random secrets for ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET
- In production set cookie "secure" to true (NODE_ENV=production)
- Consider rotating refresh tokens or hashing tokens in DB for extra security

Next options
- Add account settings / email verification

