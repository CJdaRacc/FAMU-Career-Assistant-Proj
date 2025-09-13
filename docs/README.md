# FAMU Career Assistant

A simple demo web app that shows a student login + onboarding questionnaire flow (similar to LinkedIn onboarding) and a minimal dashboard. The project includes:
- React + Vite frontend (loginpage)
- Node.js + Express backend (loginpage/server)
- MongoDB for storing users and questionnaire results

This README explains how to set up your environment, run the app, and demo the core flow end-to-end.

## Prerequisites
- Node.js 18+ (includes npm)
- MongoDB instance (local or Atlas)
- Optional (for IDE run config): IntelliJ IDEA / WebStorm / Rider

## Project layout
- loginpage/ — frontend and backend code (monorepo style)
  - src/ — React app
  - server/ — Express API
  - vite.config.js — proxies /api to the backend on http://127.0.0.1:5000 during dev

## 1) Install dependencies
1. Open a terminal and change into the frontend folder:
   - cd loginpage
2. Install packages:
   - npm install

## 2) Configure environment (.env)
Create a file at loginpage/.env with at least the MongoDB connection string. Example:

```
# Backend server port (Vite proxies /api to this). Default is 5000
PORT=5000

# MongoDB connection string. Use your local MongoDB or Atlas URI
# Example (local): mongodb://127.0.0.1:27017/famu_career
MONGODB_URI=

# Optional: name of DB if you want to override
# MONGODB_DB=famu_career

# Optional: local log file for server events
# LOG_FILE=server/data/events.log

# Optional: Gemini/Google AI key (not required for the core demo)
# Set one of these if you extend AI features later
# GEMINI_API_KEY=your_key_here
# GOOGLE_API_KEY=your_key_here
```

Notes:
- The backend reads .env from the loginpage folder. You can also create loginpage/.env.local to override values locally.
- If you use a different PORT, also update the proxy target in loginpage/vite.config.js.

## 3) Run the app (development)
From the loginpage directory, start both the backend and the Vite dev server concurrently:

- npm run dev

What happens:
- Express backend starts on http://127.0.0.1:5000 (or your PORT)
- Vite dev server starts (default http://localhost:5173) and proxies requests starting with /api to the backend (see vite.config.js)

Open the printed Vite URL in your browser (usually http://localhost:5173).

## 4) Demo walkthrough (end-to-end)
The frontend uses hash routes: #/login → #/quiz → #/dashboard.

1. Register a user (or login if already registered)
   - On the Login page, click “Register”, enter an email and password, and submit.
   - Switch back to “Login”, enter the same credentials, and submit.
   - On successful login, you will be taken to the questionnaire.
2. Complete the questionnaire
   - Answer the 20 yes/no questions and click “Submit Questionnaire”.
   - You will be redirected to the Dashboard. Your account shows “Questionnaire completed”.
3. Return to Login
   - Click “Back to Login” on the Dashboard to reset the flow.

## 5) API quick tests (optional)
You can exercise the backend directly via curl while Vite is running (proxy to 127.0.0.1:5000). Run these from a terminal in the loginpage directory:

Health checks:
```
curl http://localhost:5173/api/health
curl http://localhost:5173/api/health/config
```

Register → Login → Questionnaire:
```
# Register
curl -X POST http://localhost:5173/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Password123!"}'

# Login (note the returned userId)
curl -X POST http://localhost:5173/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Password123!"}'

# Questionnaire (replace USER_ID with the one from login)
curl -X POST http://localhost:5173/api/questionnaire \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","answers":["yes","no","yes","no","yes","no","yes","no","yes","no","yes","no","yes","no","yes","no","yes","no","yes","no"]}'
```

If you prefer to hit the backend directly (bypassing Vite), use http://127.0.0.1:5000 instead of http://localhost:5173 and run the server with:
- npm run server

## 6) IntelliJ IDEA Run/Debug configuration (optional)
1. Open Run > Edit Configurations…
2. Click + (Add New Configuration) and choose "npm".
3. Set the fields as follows:
   - Package.json: select loginpage/package.json
   - Command: run
   - Scripts: dev
   - Working directory: loginpage (the folder that contains package.json)
   - Node interpreter: Use your local Node installation (auto-detected is fine)
4. Apply and OK.

## Troubleshooting
- MongoDB connection errors
  - Ensure MONGODB_URI is correct and your Mongo instance is running/reachable.
  - The server logs “MongoDB connected” on success; otherwise, it prints an error and exits.
- Port issues
  - Backend default is 5000 (configurable via PORT). Vite default is 5173 (may auto-pick a new port if busy).
  - If you change PORT, update the proxy target in loginpage/vite.config.js.
- Where are logs?
  - The server appends JSON lines to server/data/events.log by default (configurable via LOG_FILE). Create directories if needed.
- Checking server health
  - Visit http://localhost:5173/api/health (via Vite proxy) or http://127.0.0.1:5000/api/health (direct) to verify the API is up.