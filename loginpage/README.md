# FAMU Career Assistant — Login and Career Tools (React + Express + MongoDB)

A minimal MERN application that provides:
- Login and Registration
- Post‑login onboarding quiz that routes users to either `#/quiz` or `#/dashboard`
- Resume Feedback: keyword extraction and simple job‑match heuristics
- Local event logging and MongoDB persistence

This project is structured as a single app inside `loginpage/` that contains both the Vite React frontend and the Express backend.

## Project structure

```
/ (repo root)
└─ loginpage/
   ├─ public/
   ├─ src/            # React frontend (Vite)
   ├─ server/         # Node/Express API
   ├─ .env            # Your environment (optional)
   ├─ package.json    # One package.json for both frontend and backend
   └─ server/data/events.log (created on demand)
```

## Prerequisites

- Node.js 18+
- MongoDB running locally OR a MongoDB Atlas connection string

## Setup

1) Install dependencies
- Open a terminal at the repository root and run:
  - npm install

2) Configure environment (optional but recommended)
- Create a `.env` file in the `loginpage/` directory. Example:
```
MONGODB_URI=mongodb://127.0.0.1:27017/loginpage
PORT=5000
LOG_FILE=server/data/events.log
# Optional HTTPS (provide absolute or repo-relative paths)
SSL_CERT_PATH=certs/localhost.crt
SSL_KEY_PATH=certs/localhost.key
# Optional CA chain (if needed)
# SSL_CA_PATH=certs/ca_bundle.crt
# If you have a key, some AI messaging may be enabled; otherwise heuristics are used
GEMINI_API_KEY=your_google_generative_ai_key
# or
# GOOGLE_API_KEY=your_google_generative_ai_key
```
- If `MONGODB_URI` is omitted, the server defaults to `mongodb://127.0.0.1:27017/loginpage`.

3) Run the app (backend + frontend together)
- npm run dev
- Backend API: http://127.0.0.1:5000
- Frontend (Vite): http://localhost:5173 (port may vary)

4) Run pieces separately (optional)
- Backend only: npm run server
- Frontend only: vite (or `npm run preview` to serve a built app)

The Vite dev server proxies `/api` requests to the backend, so the React app calls `/api/login` and `/api/register` directly during development.

## Available npm scripts (from loginpage/package.json)

- dev — Run Express API and Vite dev server concurrently
- build — Build the frontend with Vite
- preview — Preview the built frontend
- server — Run the Express backend only

## Hash‑based routes in the app

- `#/login`: Login/Registration page
- `#/quiz`: Onboarding quiz after authentication (shown when `questionnaireCompleted` is false)
- `#/dashboard`: Main dashboard (shown when `questionnaireCompleted` is true)
- `#/resume-feedback`: Resume keyword analysis and job matching
- Other pages: `#/jobs`, `#/save`, `#/job-matcher`, `#/advanced`, `#/myqa`

Navigation behavior after auth:
- On successful login/register, the app sets `window.location.hash` to `#/quiz` if the user has not completed the questionnaire, otherwise to `#/dashboard`.

## API Endpoints (selected)

- POST `/api/register` `{ email, password }` → 201 on success
- POST `/api/login` `{ email, password }` → 200 with `{ userId, email, createdAt, questionnaireCompleted }`
- POST `/api/resume/extract` (multipart/form-data with `file`) → `{ text, chars }`
- POST `/api/resume/feedback` `{ resumeText, savedJobs: [], compareToJobs: boolean }`
  - When `compareToJobs=true`, returns `{ keywords, jobs: [{ score, matchedKeywords, missingKeywords }], ai }`
  - When `compareToJobs=false`, returns `{ keywords, jobs: [], ai:false }`

## Local file logging

- In addition to MongoDB, the server appends minimal event data (NDJSON) to `server/data/events.log` by default.
- Events written: `register`, `login`, and failures like `*_failed` with reasons. No raw passwords are ever written.
- Override the path via `LOG_FILE` in your `.env`.

## HTTPS/SSL (optional)

- The Express server can start in HTTPS mode when both `SSL_CERT_PATH` and `SSL_KEY_PATH` are provided (and point to readable files). Optionally supply `SSL_CA_PATH` for a chain file.
- If these variables are not set or files are missing, the server falls back to HTTP.
- Example (dev, self-signed):
  - Generate with OpenSSL and place under `loginpage/certs/`.
  - Set in `.env`:
    - `SSL_CERT_PATH=certs/localhost.crt`
    - `SSL_KEY_PATH=certs/localhost.key`
    - `# SSL_CA_PATH=certs/ca_bundle.crt`
- In production, store certs in a secure location or mount them via your hosting platform (Docker/Kubernetes secret, VM disk) and set these env vars accordingly.

## Resume Feedback UI (what to expect)

- Go to `#/resume-feedback` after logging in.
- Upload a PDF/DOCX or paste resume text, then click Analyze.
- You’ll see detected keywords and, if comparing to saved jobs:
  - A match percentage for each job
  - Matched keywords
  - Up to 4 missing keywords (highlighted as red badges)
- A resume preview highlights detected keywords inline (prioritizing Experience and Skills when present).

## Continuous Integration (GitHub Actions)

- The repository includes `.github/workflows/node.js.yml` which:
  - Installs dependencies under `loginpage/`
  - Runs tests if present
  - Builds the frontend with Vite to verify deployability

## Testing (coming soon)

- This project is being prepared for unit tests using Vitest + React Testing Library and API mocking via MSW.
- Once added, you’ll be able to run:
  - `npm run test` — interactive watch mode
  - `npm run test:ci` — one‑shot CI mode
- CI is already configured to pick up tests if these scripts exist.


## License

This project is for educational purposes for the FAMU Career Assistant initiative. Add a license file if you intend to distribute or open‑source beyond internal use.
