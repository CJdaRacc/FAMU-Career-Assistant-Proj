# FAMU Career Assistant
An end-to-end demo web app that helps students explore careers. It includes:
- React + Vite frontend (loginpage)
- Node.js + Express backend (loginpage/server)
- MongoDB for persisting users, profiles, advanced questionnaires, and job matches
- Optional Gemini AI integration to generate personalized questions and job matches

This README explains how to set up the environment, run the app, and use all features.

## Prerequisites
- Node.js 18+ (includes npm)
- MongoDB instance (local or Atlas)
- Optional (for AI features): a Google Generative AI key (GEMINI_API_KEY or GOOGLE_API_KEY)
- Optional (for IDE run config): IntelliJ IDEA / WebStorm / Rider

## Project layout
- loginpage/ — frontend and backend code (monorepo style)
  - src/ — React app
  - server/ — Express API
  - vite.config.js — proxies /api to the backend on http://127.0.0.1:5000 during dev
  - .env — environment configuration (see below)

## 1) Install dependencies
1. Open a terminal and change into the frontend folder:
   - cd loginpage
2. Install packages:
   - npm install

## 2) Configure environment (.env)
Create a file at loginpage/.env with the following settings.

```
# Backend server port (Vite proxies /api to this). Default is 5000
PORT=5000

# MongoDB connection string. Use your local MongoDB or Atlas URI
# Example (local): mongodb://127.0.0.1:27017/famu_career
MONGODB_URI=

# Optional: name of DB if you want to override
# MONGODB_DB=famu_career

# Optional: local log file for server events (defaults to server/data/events.log)
# LOG_FILE=server/data/events.log

# Optional but REQUIRED for AI features (Advanced Q&A and Job Matches)
# Provide one of the following keys:
# GEMINI_API_KEY=your_key_here
# GOOGLE_API_KEY=your_key_here
```

Notes:
- The backend reads .env from the loginpage folder. You can also create loginpage/.env.local to override values locally.
- If you change PORT, update the proxy target in loginpage/vite.config.js.

## 3) Run the app (development)
From the loginpage directory, start both the backend and the Vite dev server concurrently:

- npm run dev

What happens:
- Express backend starts on http://127.0.0.1:5000 (or your PORT)
- Vite dev server starts (default http://localhost:5173) and proxies requests starting with /api to the backend (see vite.config.js)

Open the printed Vite URL in your browser (usually http://localhost:5173).

## 4) App walkthrough
The frontend uses hash routes and hides the navbar until you log in or register.

Routes after login/registration:
- #/dashboard — simple dashboard with a Back to Login button
- #/quiz — Student Profile Setup (major, general fields of study, related interests, class year)
- #/advanced — Advanced Questionnaire (6 generic questions → 8 AI-generated, role-focused follow-ups)
- #/myqa — My Q&A (user-only view of saved questions and answers)
- #/jobs — Job Matches (displays Gemini-generated matches as Bootstrap progress bars)

Typical flow:
1) Register or Login
   - On the Login page, register a new account or log in to an existing one.
   - Successful authentication immediately shows the navbar and routes you to #/quiz if your profile is not complete, else #/dashboard.

2) Student Profile Setup (#/quiz)
   - Enter your Major and Class Year.
   - Choose one or more General Fields of Study (checkboxes).
   - For each selected field, pick related interests from a multi-select dropdown.
   - If any dropdown includes "Other", enter comma-separated custom interests in the provided input.
   - Click Save and Continue to persist your profile to the database.

3) Advanced Questionnaire (#/advanced)
   - Answer 6 starter (generic) questions.
   - Optionally provide a Target Career (e.g., "Data Analyst") to focus the follow-ups on a single role.
   - Click Generate Personalized Questions to get 8 AI-generated, role-specific questions that consider your profile and generic answers.
   - Provide answers to the 8 questions and submit to save the full set.

4) My Q&A (#/myqa)
   - View your saved profile snapshot, the 6 generic Q&A, and the 8 personalized Q&A. Only you can access your data.

5) Job Matches (#/jobs)
   - Generates a list of personalized jobs using your profile and advanced questionnaire answers (via Gemini).
   - If you have a saved profile but no matches yet, the page can auto-generate on first visit.
   - You can also click Generate/Regenerate to refresh matches. Results render as bar graphs with match percentages and reasons.

## 5) API quick tests (optional)
Run these from a terminal in the loginpage directory while Vite is running (proxy to 127.0.0.1:5000):

Health checks:
```
curl http://localhost:5173/api/health
curl http://localhost:5173/api/health/config
```

Register → Login → Save Profile (new form):
```
# Register
curl -X POST http://localhost:5173/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Password123!"}'

# Login (note the returned userId)
curl -X POST http://localhost:5173/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Password123!"}'

# Save profile (replace USER_ID)
curl -X POST http://localhost:5173/api/questionnaire \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","major":"Computer Science","interests":["Software Engineering","AI/ML"],"classYear":"2026"}'
```

Advanced Questionnaire (Gemini key required):
```
# Get the 6 generic questions
curl http://localhost:5173/api/advanced/init-questions

# Generate 8 personalized questions (replace USER_ID)
curl -X POST http://localhost:5173/api/advanced/generate \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","genericAnswers":["remote","startup","internship","Python & SQL","fintech","10"],"targetCareer":"Data Analyst"}'

# Submit full questionnaire (replace USER_ID; use questions returned from generate)
curl -X POST http://localhost:5173/api/advanced/submit \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","genericQuestions":["...6 items..."],"genericAnswers":["...6 items..."],"aiQuestions":["...8 items..."],"aiAnswers":["...8 items..."]}'
```

Job Matches (Gemini key required):
```
# Generate job matches (replace USER_ID)
curl -X POST http://localhost:5173/api/jobs/generate \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}'

# Fetch latest job matches
curl http://localhost:5173/api/jobs/my?userId=USER_ID
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
- Missing Gemini API key
  - Advanced generation and job matches require GEMINI_API_KEY or GOOGLE_API_KEY. Without it, related endpoints return a configuration error.
- Port issues
  - Backend default is 5000 (configurable via PORT). Vite default is 5173 (may auto-pick a new port if busy).
  - If you change PORT, update the proxy target in loginpage/vite.config.js.
- Where are logs?
  - The server appends JSON lines to server/data/events.log by default (configurable via LOG_FILE). Create directories if needed.
- Checking server health
  - Visit http://localhost:5173/api/health (via Vite proxy) or http://127.0.0.1:5000/api/health (direct) to verify the API is up.
