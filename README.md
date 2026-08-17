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

Security notes
- Use strong random secrets for ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET
- In production set cookie "secure" to true (NODE_ENV=production)
- Consider rotating refresh tokens or hashing tokens in DB for extra security

Next options
- Add account settings / email verification

