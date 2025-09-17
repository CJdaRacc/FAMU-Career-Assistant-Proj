import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env (and optionally .env.local)
const rootEnvPath = path.resolve(process.cwd(), '.env');
const localEnvPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: rootEnvPath });
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: true });
}

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || '';

// Local file logging setup
const DEFAULT_LOG_FILE = path.resolve(process.cwd(), 'server', 'data', 'events.log');
const LOG_FILE = process.env.LOG_FILE || DEFAULT_LOG_FILE;
const LOG_DIR = path.dirname(LOG_FILE);
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (e) {
  console.error('Could not create log directory:', e);
}
function appendEvent(event) {
  const safe = {
    ...event,
    ts: new Date().toISOString(),
  };
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(safe) + '\n');
  } catch (e) {
    console.error('Failed to write log event:', e);
  }
}

app.use(cors());
app.use(express.json());

// // Connect to MongoDB
mongoose
  .connect(MONGODB_URI, { dbName: process.env.MONGODB_DB || undefined })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// User schema
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    questionnaireCompleted: { type: Boolean, default: false },
    questionnaireCompletedAt: { type: Date, default: null },
    userTag: {
      type: String,
      default: function () {
        try {
          return 'U-' + String(this._id).slice(-6).toUpperCase();
        } catch (e) {
          return undefined;
        }
      },
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// Quiz/Questionnaire results schema
// Supports legacy quiz (answers/yesCount) and new profile form (major/interests/classYear)
const resultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Legacy fields
    answers: { type: [String], required: false },
    yesCount: { type: Number, default: 0 },
    // New fields
    major: { type: String },
    interests: { type: [String], default: [] },
    classYear: { type: String },
  },
  { timestamps: true }
);

const Result = mongoose.model('Result', resultSchema);

// Advanced Questionnaire schema (6 generic + 8 AI-generated questions & answers)
const advancedQASchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // 6 generic questions and answers
    genericQuestions: { type: [String], default: [] },
    genericAnswers: { type: [String], default: [] },
    // 8 AI generated questions and answers
    aiQuestions: { type: [String], default: [] },
    aiAnswers: { type: [String], default: [] },
    // Snapshot of profile used for generation
    profileSnapshot: {
      major: { type: String },
      interests: { type: [String], default: [] },
      classYear: { type: String },
    },
    // Optional meta/debug
    aiMeta: {
      model: { type: String },
      prompt: { type: String },
      rawResponse: { type: String },
    },
  },
  { timestamps: true }
);

const AdvancedQA = mongoose.model('AdvancedQA', advancedQASchema);

// 6 starter generic questions
const ADV_GENERIC_QUESTIONS = [
  'What is your preferred work environment (remote, hybrid, on-site)?',
  'Which company size do you prefer (startup, mid-size, large enterprise)?',
  'What type of roles are you most interested in (internship, full-time, research, freelance)?',
  'What top 2 skills do you want to develop this year?',
  'What industries interest you the most (e.g., fintech, healthcare, education)?',
  'How many hours per week can you commit to professional development?'
];

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Config health (does not expose secrets)
app.get('/api/health/config', (req, res) => {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  res.json({
    status: 'ok',
    geminiConfigured,
    port: process.env.PORT || 5000,
    logFile: process.env.LOG_FILE || require('path').resolve(process.cwd(), 'server', 'data', 'events.log'),
  });
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      appendEvent({ type: 'register_failed', reason: 'missing_fields' });
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      appendEvent({ type: 'register_failed', email, reason: 'email_exists' });
      return res.status(409).json({ message: 'Email already registered.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });
    appendEvent({ type: 'register', email, userId: String(user._id) });
    return res.status(201).json({
      message: 'Registered successfully',
      userId: user._id,
      email: user.email,
      createdAt: user.createdAt,
      questionnaireCompleted: user.questionnaireCompleted,
      userTag: user.userTag,
    });
  } catch (err) {
    console.error('Register error:', err);
    appendEvent({ type: 'register_error', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      appendEvent({ type: 'login_failed', reason: 'missing_fields' });
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      appendEvent({ type: 'login_failed', email, reason: 'user_not_found' });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      appendEvent({ type: 'login_failed', email, reason: 'bad_password' });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    appendEvent({ type: 'login', email, userId: String(user._id) });
    return res.json({
      message: 'Login successful',
      userId: user._id,
      email: user.email,
      questionnaireCompleted: user.questionnaireCompleted,
      createdAt: user.createdAt,
      userTag: user.userTag,
    });
  } catch (err) {
    console.error('Login error:', err);
    appendEvent({ type: 'login_error', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Gemini proxy endpoint
// Questionnaire submission: marks questionnaire as completed
app.post('/api/questionnaire', async (req, res) => {
  try {
    const { userId, answers, major, interests, classYear } = req.body || {};
    if (!userId) {
      appendEvent({ type: 'questionnaire_failed', reason: 'missing_user' });
      return res.status(400).json({ message: 'userId is required' });
    }

    const isLegacy = Array.isArray(answers) && answers.length > 0;
    const isNew = typeof major === 'string' && major.trim().length > 0 && typeof classYear === 'string' && classYear.trim().length > 0;

    if (!isLegacy && !isNew) {
      appendEvent({ type: 'questionnaire_failed', reason: 'missing_payload', userId });
      return res.status(400).json({ message: 'Provide either answers array (legacy) or major and classYear (new form).' });
    }

    const user = await User.findById(userId);
    if (!user) {
      appendEvent({ type: 'questionnaire_failed', reason: 'user_not_found', userId });
      return res.status(404).json({ message: 'User not found' });
    }

    let result;
    if (isLegacy) {
      // Compute a simple score: number of 'yes' answers
      const yesCount = answers.reduce((acc, a) => acc + (String(a).toLowerCase() === 'yes' ? 1 : 0), 0);
      result = await Result.create({ userId, answers, yesCount });
    } else {
      const cleanedInterests = Array.isArray(interests) ? interests.map((s) => String(s)).filter(Boolean) : [];
      result = await Result.create({
        userId,
        major: String(major).trim(),
        interests: cleanedInterests,
        classYear: String(classYear).trim(),
      });
    }

    // Update user completion flags
    user.questionnaireCompleted = true;
    user.questionnaireCompletedAt = new Date();
    await user.save();

    appendEvent({ type: 'questionnaire_completed', userId: String(user._id), resultId: String(result._id) });
    return res.json({
      message: 'Questionnaire saved',
      userId: user._id,
      questionnaireCompleted: user.questionnaireCompleted,
      questionnaireCompletedAt: user.questionnaireCompletedAt,
      result: {
        resultId: result._id,
        yesCount: result.yesCount,
        answersCount: Array.isArray(result.answers) ? result.answers.length : 0,
        major: result.major,
        interests: result.interests,
        classYear: result.classYear,
        createdAt: result.createdAt,
      },
    });
  } catch (err) {
    console.error('Questionnaire error:', err);
    appendEvent({ type: 'questionnaire_error', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Fetch results for a user
app.get('/api/results', async (req, res) => {
  try {
    const { userId } = req.query || {};
    if (!userId) {
      appendEvent({ type: 'results_failed', reason: 'missing_user' });
      return res.status(400).json({ message: 'userId query parameter is required' });
    }
    const results = await Result.find({ userId }).sort({ createdAt: -1 }).lean();
    appendEvent({ type: 'results_fetch', userId, count: results.length });
    return res.json({ userId, results });
  } catch (err) {
    console.error('Results fetch error:', err);
    appendEvent({ type: 'results_error', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/gemini', async (req, res) => {
  try {
    const message = (req.body && req.body.message) || req.query?.message;
    if (!message || typeof message !== 'string') {
      appendEvent({ type: 'gemini_failed', reason: 'missing_message' });
      return res.status(400).json({ message: 'Parameter "message" is required.' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!GEMINI_API_KEY) {
      appendEvent({ type: 'gemini_failed', reason: 'missing_api_key' });
      return res.status(500).json({ message: 'Server not configured: Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env' });
    }
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    const payload = {
      contents: [
        {
          parts: [
            { text: message }
          ]
        }
      ]
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      appendEvent({ type: 'gemini_error', status: resp.status, statusText: resp.statusText, body: data });
      return res.status(resp.status).json({ message: 'Gemini API error', status: resp.status, statusText: resp.statusText, body: data });
    }

    appendEvent({ type: 'gemini_request', ok: true });
    return res.json(data);
  } catch (err) {
    console.error('Gemini proxy error:', err);
    appendEvent({ type: 'gemini_exception', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Advanced questionnaire endpoints

function safeArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (v == null ? '' : String(v))).filter((s) => s.length > 0);
}

async function getProfileSnapshot(userId) {
  try {
    const latest = await Result.findOne({ userId }).sort({ createdAt: -1 }).lean();
    return {
      major: latest?.major || undefined,
      interests: Array.isArray(latest?.interests) ? latest.interests : [],
      classYear: latest?.classYear || undefined,
    };
  } catch (e) {
    return { interests: [] };
  }
}

// Return the 6 generic questions
app.get('/api/advanced/init-questions', (req, res) => {
  appendEvent({ type: 'adv_init_questions' });
  return res.json({ questions: ADV_GENERIC_QUESTIONS });
});

// Generate 8 personalized questions from Gemini based on user profile, prior answers, and current generic answers
app.post('/api/advanced/generate', async (req, res) => {
  try {
    const { userId, genericAnswers, dashboardContext, targetCareer } = req.body || {};
    if (!userId) {
      appendEvent({ type: 'adv_generate_failed', reason: 'missing_user' });
      return res.status(400).json({ message: 'userId is required' });
    }
    const gAnswers = safeArrayOfStrings(genericAnswers);
    if (gAnswers.length !== ADV_GENERIC_QUESTIONS.length) {
      appendEvent({ type: 'adv_generate_failed', reason: 'bad_generic_answers', count: gAnswers.length });
      return res.status(400).json({ message: `Provide ${ADV_GENERIC_QUESTIONS.length} genericAnswers` });
    }

    const profile = await getProfileSnapshot(userId);

    // Fetch the most recent advanced QA to include prior personalized answers as context (if any)
    let priorQA = null;
    try {
      priorQA = await AdvancedQA.findOne({ userId }).sort({ createdAt: -1 }).lean();
    } catch (_) {}

    const contextBits = [
      profile.major ? `Major: ${profile.major}` : null,
      profile.classYear ? `Class Year: ${profile.classYear}` : null,
      (profile.interests && profile.interests.length) ? `Interests: ${profile.interests.join(', ')}` : null,
      dashboardContext ? `Dashboard: ${String(dashboardContext)}` : null,
    ].filter(Boolean).join('\n');

    const priorBits = priorQA ? [
      'PRIOR PERSONALIZED Q&A',
      ...(Array.isArray(priorQA.aiQuestions) ? priorQA.aiQuestions.map((q, i) => `${i + 1}. ${q}\nAnswer: ${String(priorQA.aiAnswers?.[i] || '').trim()}`) : [])
    ].join('\n') : '';

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!GEMINI_API_KEY) {
      appendEvent({ type: 'adv_generate_failed', reason: 'missing_api_key' });
      return res.status(500).json({ message: 'Server not configured: Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env' });
    }

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = [
      'You are creating an in-depth career questionnaire for a university student. ',
      'First, determine ONE specific target career title (e.g., "Data Analyst", "UX Designer", "Supply Chain Analyst") that best fits the PROFILE and GENERIC answers. ',
      'If a TARGET CAREER HINT is provided, prefer that exact role when reasonable. ',
      'Then generate 8 short follow-up questions that are explicitly tailored to succeeding in that ONE role. ',
      'Avoid broad, general field questions. Make them role-specific: tools/technologies, key artifacts, metrics/KPIs, workflows, internships/projects, portfolios, certifications/prereqs, and constraints. ',
      'Do not repeat previous questions. Vary themes. ',
      'Return ONLY compact JSON with key "questions" as an array of 8 strings. No commentary.'
    ].join('');

    const sections = [
      `PROFILE\n${contextBits}`,
      `GENERIC QUESTIONS & ANSWERS\n${ADV_GENERIC_QUESTIONS.map((q,i)=>`${i+1}. ${q}\nAnswer: ${gAnswers[i]}`).join('\n')}`,
      priorBits ? priorBits : null,
      `TARGET CAREER HINT\n${String(targetCareer || '').trim()}`,
      'JSON OUTPUT FORMAT\n{"questions": ["...8 items..."]}',
    ].filter(Boolean).join('\n\n');

    const payload = {
      contents: [{ parts: [{ text: `${prompt}\n\n${sections}` }] }]
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      appendEvent({ type: 'adv_generate_error', status: resp.status, body: data });
      return res.status(resp.status).json({ message: 'Gemini API error', body: data });
    }

    // Try to extract text
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let questions = [];
    try {
      const jsonMatch = textOut.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textOut);
      if (parsed && Array.isArray(parsed.questions)) {
        questions = parsed.questions.map((q) => String(q)).filter(Boolean).slice(0, 8);
      }
    } catch (_) {
      // fallback: try to split lines
      questions = String(textOut).split(/\n|\r/).map((s)=>s.replace(/^[-*\d\.\)\s]+/, '').trim()).filter(Boolean).slice(0,8);
    }

    if (questions.length !== 8) {
      appendEvent({ type: 'adv_generate_bad_output', got: questions.length });
      return res.status(502).json({ message: 'AI did not return 8 questions', raw: textOut });
    }

    appendEvent({ type: 'adv_generate_ok', userId: String(userId), targetCareer: String(targetCareer || '').trim() });
    return res.json({ aiQuestions: questions, profileSnapshot: profile, usedPrior: Boolean(priorQA) });
  } catch (err) {
    console.error('Advanced generate error:', err);
    appendEvent({ type: 'adv_generate_exception', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Submit all advanced questionnaire answers for persistence
app.post('/api/advanced/submit', async (req, res) => {
  try {
    const { userId, genericQuestions, genericAnswers, aiQuestions, aiAnswers, profileSnapshot } = req.body || {};
    if (!userId) {
      appendEvent({ type: 'adv_submit_failed', reason: 'missing_user' });
      return res.status(400).json({ message: 'userId is required' });
    }
    const gQ = safeArrayOfStrings(genericQuestions);
    const gA = safeArrayOfStrings(genericAnswers);
    const aQ = safeArrayOfStrings(aiQuestions);
    const aA = safeArrayOfStrings(aiAnswers);

    if (gQ.length !== ADV_GENERIC_QUESTIONS.length || gA.length !== ADV_GENERIC_QUESTIONS.length) {
      appendEvent({ type: 'adv_submit_failed', reason: 'bad_generic_lengths' });
      return res.status(400).json({ message: `Must provide ${ADV_GENERIC_QUESTIONS.length} genericQuestions and genericAnswers` });
    }
    if (aQ.length !== 8 || aA.length !== 8) {
      appendEvent({ type: 'adv_submit_failed', reason: 'bad_ai_lengths' });
      return res.status(400).json({ message: 'Must provide 8 aiQuestions and 8 aiAnswers' });
    }

    const profile = profileSnapshot && typeof profileSnapshot === 'object' ? profileSnapshot : await getProfileSnapshot(userId);

    const doc = await AdvancedQA.create({
      userId,
      genericQuestions: gQ,
      genericAnswers: gA,
      aiQuestions: aQ,
      aiAnswers: aA,
      profileSnapshot: {
        major: profile?.major,
        interests: Array.isArray(profile?.interests) ? profile.interests : [],
        classYear: profile?.classYear,
      },
    });

    appendEvent({ type: 'adv_submit_ok', userId: String(userId), id: String(doc._id) });
    return res.status(201).json({ message: 'Advanced questionnaire saved', id: doc._id, createdAt: doc.createdAt });
  } catch (err) {
    console.error('Advanced submit error:', err);
    appendEvent({ type: 'adv_submit_exception', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Fetch latest advanced questionnaire for a user
app.get('/api/advanced/my', async (req, res) => {
  try {
    const { userId } = req.query || {};
    if (!userId) {
      appendEvent({ type: 'adv_my_failed', reason: 'missing_user' });
      return res.status(400).json({ message: 'userId query parameter is required' });
    }
    const doc = await AdvancedQA.findOne({ userId }).sort({ createdAt: -1 }).lean();
    appendEvent({ type: 'adv_my_ok', userId: String(userId), hasDoc: Boolean(doc) });
    return res.json({ userId, advanced: doc || null });
  } catch (err) {
    console.error('Advanced my fetch error:', err);
    appendEvent({ type: 'adv_my_exception', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Job Matches schema: stores AI-recommended jobs for a user
const jobMatchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [
      new mongoose.Schema(
        {
          title: { type: String, required: true },
          score: { type: Number, required: true }, // 0-100
          reason: { type: String },
        },
        { _id: false }
      )
    ],
    profileSnapshot: {
      major: { type: String },
      interests: { type: [String], default: [] },
      classYear: { type: String },
    },
    sourceQAId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdvancedQA' },
  },
  { timestamps: true }
);

const JobMatch = mongoose.model('JobMatch', jobMatchSchema);

// Generate job matches based on profile + advanced questionnaire answers
app.post('/api/jobs/generate', async (req, res) => {
  try {
    const { userId, count } = req.body || {};
    if (!userId) {
      appendEvent({ type: 'jobs_generate_failed', reason: 'missing_user' });
      return res.status(400).json({ message: 'userId is required' });
    }

    const profile = await getProfileSnapshot(userId);
    const adv = await AdvancedQA.findOne({ userId }).sort({ createdAt: -1 }).lean();

    if (!profile?.major && (!profile?.interests || profile.interests.length === 0)) {
      appendEvent({ type: 'jobs_generate_failed', reason: 'no_profile' });
      return res.status(400).json({ message: 'Please complete your profile first.' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!GEMINI_API_KEY) {
      appendEvent({ type: 'jobs_generate_failed', reason: 'missing_api_key' });
      return res.status(500).json({ message: 'Server not configured: Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env' });
    }

    const model = 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const desired = Math.min(Math.max(parseInt(count || '8', 10) || 8, 5), 12);

    const profileText = [
      profile?.major ? `Major: ${profile.major}` : null,
      profile?.classYear ? `Class Year: ${profile.classYear}` : null,
      profile?.interests?.length ? `Interests: ${profile.interests.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    const advText = adv
      ? [
          'GENERIC Q&A:',
          ...(adv.genericQuestions || []).map((q, i) => `${i + 1}. ${q}\nAnswer: ${String(adv.genericAnswers?.[i] || '')}`),
          'PERSONALIZED Q&A:',
          ...(adv.aiQuestions || []).map((q, i) => `${i + 1}. ${q}\nAnswer: ${String(adv.aiAnswers?.[i] || '')}`),
        ].join('\n')
      : 'No advanced questionnaire found yet.';

    const prompt = [
      'You are a career assistant. Using the PROFILE and QUESTIONNAIRE context, return a compact JSON with top matching jobs.',
      'Return an object { "jobs": [ { "title": string, "score": number(0-100), "reason": string } ] } with between 6 and 10 items.',
      'Ensure scores are integers 0-100 and sort from highest to lowest suitability. No extra commentary.'
    ].join(' ');

    const sections = [
      `PROFILE\n${profileText}`,
      `QUESTIONNAIRE\n${advText}`,
      `OUTPUT FORMAT\n{"jobs":[{"title":"...","score":95,"reason":"..."}]}`,
      `COUNT\n${desired}`,
    ].join('\n\n');

    const payload = { contents: [{ parts: [{ text: `${prompt}\n\n${sections}` }] }] };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      appendEvent({ type: 'jobs_generate_error', status: resp.status, body: data });
      return res.status(resp.status).json({ message: 'Gemini API error', body: data });
    }

    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let jobs = [];
    try {
      const jsonMatch = textOut.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textOut);
      if (parsed && Array.isArray(parsed.jobs)) {
        jobs = parsed.jobs.map((j) => ({
          title: String(j.title || '').trim(),
          score: Math.max(0, Math.min(100, parseInt(j.score, 10) || 0)),
          reason: String(j.reason || '').trim(),
        }))
        .filter((j) => j.title)
        .slice(0, 12);
      }
    } catch (_) {
      // fallback: line-based parsing "Title - 88: reason"
      jobs = String(textOut)
        .split(/\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/^(.*?)[-:](.*?)(\d{1,3})/);
          const title = line.replace(/[-:].*$/, '').trim();
          const score = m ? parseInt(m[3], 10) : 0;
          const reason = line.includes(':') ? line.split(':').slice(1).join(':').trim() : '';
          return { title, score: Math.max(0, Math.min(100, score || 0)), reason };
        })
        .filter((j) => j.title)
        .slice(0, 10);
    }

    if (!jobs.length) {
      appendEvent({ type: 'jobs_generate_bad_output' });
      return res.status(502).json({ message: 'AI did not return job matches', raw: textOut });
    }

    // sort by score desc
    jobs.sort((a, b) => (b.score || 0) - (a.score || 0));

    const doc = await JobMatch.create({
      userId,
      items: jobs,
      profileSnapshot: {
        major: profile?.major,
        interests: Array.isArray(profile?.interests) ? profile.interests : [],
        classYear: profile?.classYear,
      },
      sourceQAId: adv?._id || undefined,
    });

    appendEvent({ type: 'jobs_generate_ok', userId: String(userId), id: String(doc._id), count: jobs.length });
    return res.status(201).json({ message: 'Job matches generated', matches: jobs, id: doc._id, createdAt: doc.createdAt, profileSnapshot: doc.profileSnapshot });
  } catch (err) {
    console.error('Jobs generate error:', err);
    appendEvent({ type: 'jobs_generate_exception', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Fetch latest job matches for a user
app.get('/api/jobs/my', async (req, res) => {
  try {
    const { userId } = req.query || {};
    if (!userId) {
      appendEvent({ type: 'jobs_my_failed', reason: 'missing_user' });
      return res.status(400).json({ message: 'userId query parameter is required' });
    }
    const doc = await JobMatch.findOne({ userId }).sort({ createdAt: -1 }).lean();
    appendEvent({ type: 'jobs_my_ok', userId: String(userId), hasDoc: Boolean(doc) });
    return res.json({ userId, matches: doc?.items || [], createdAt: doc?.createdAt || null, profileSnapshot: doc?.profileSnapshot || null });
  } catch (err) {
    console.error('Jobs my fetch error:', err);
    appendEvent({ type: 'jobs_my_exception', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Logging events to: ${LOG_FILE}`);
});
