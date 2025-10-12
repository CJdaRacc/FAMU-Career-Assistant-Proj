# Simple Login Page (React + Express + MongoDB)

This project provides a minimal login/registration page in React with a Node/Express API that connects to MongoDB.

## Prerequisites

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

1. Install dependencies:
   - Open a terminal at the project root and run:
     - npm install
2. Configure environment (optional):
   - Create a .env file in the loginpage directory with:
     - MONGODB_URI=<your_mongodb_uri>
     - PORT=5000
     - LOG_FILE=server/data/events.log (optional; default shown)
     - GEMINI_API_KEY=<your_google_generative_ai_key> (or GOOGLE_API_KEY)
   - If omitted, the server will try mongodb://127.0.0.1:27017/loginpage (and AI features will fall back to heuristics if no key is provided)
3. Start the app (backend + frontend) together for development:
   - npm run dev
   - The API will listen on http://127.0.0.1:5000 and the frontend on http://localhost:5173 (or the displayed port)
4. Alternatively, you can run them separately:
   - Backend only: npm run server
   - Frontend only: vite (or npm run preview for the preview server)

The Vite dev server proxies /api requests to the backend, so the React app calls /api/login and /api/register directly.

## API Endpoints (selected)

- POST /api/register { email, password } → 201 on success
- POST /api/login { email, password } → 200 with basic user info on success
- POST /api/resume/extract (multipart/form-data with `file`) → { text, chars }
- POST /api/resume/feedback { resumeText, savedJobs: [], compareToJobs: boolean }
  - When compareToJobs=true, returns { keywords, jobs: [{ score, matchedKeywords, missingKeywords }], ai }
  - When compareToJobs=false, returns { keywords, jobs: [], ai:false }

## Local file saving

- In addition to MongoDB, the server appends minimal event data to a local file (NDJSON format) at `server/data/events.log` by default.
- Events written: `register`, `login`, and failures like `*_failed` with reasons. No raw passwords are ever written.
- You can override the path via `LOG_FILE` in your `.env`.

## Resume Feedback UI

- Navigate to `#/resume-feedback` after logging in.
- Upload a PDF/DOCX or paste your resume text, then click Analyze.
- The page shows detected keywords and, if comparing to saved jobs, displays:
  - A match percentage per job
  - Matched keywords
  - Unmatched keywords (up to 4) shown as red badges
- It also provides a resume preview where detected keywords are highlighted in-line (Experience and Skills sections prioritized when detected).

## Notes

- Passwords are hashed using bcryptjs.
- This example intentionally avoids JWT/session management to stay minimal. For real apps, add authentication tokens and proper validation.
