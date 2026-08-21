Quick local setup

1. Copy .env.example to .env and fill database credentials and secrets.
2. Run the SQL in migrations/init.sql against your MySQL server (e.g. with mysql CLI or a GUI).
3. Install dependencies:
   cd backend
   npm install
4. Start server:
   npm start

API endpoints
- POST /auth/register  { email, password } -> sets refresh cookie, returns accessToken
- POST /auth/login     { email, password } -> sets refresh cookie, returns accessToken
- POST /auth/refresh   -> reads refresh cookie, returns accessToken
- POST /auth/logout    -> clears refresh cookie
- GET /dashboard       -> Requires Authorization: Bearer <accessToken>

Notes
- Refresh tokens are stored in DB and set as HttpOnly cookies for safety.
- Access tokens are short-lived JWTs; store them in memory on the client.
- Uploaded toy photos are written to the directory in UPLOADS_DIR (see .env.example).
  In production, set UPLOADS_DIR to a path outside the deployed code directory
  (e.g. a persistent folder on the host) so photos aren't lost when you redeploy.
