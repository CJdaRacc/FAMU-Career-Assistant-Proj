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
const resultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: [String], required: true },
    yesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Result = mongoose.model('Result', resultSchema);

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
    const { userId, answers } = req.body || {};
    if (!userId) {
      appendEvent({ type: 'questionnaire_failed', reason: 'missing_user' });
      return res.status(400).json({ message: 'userId is required' });
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      appendEvent({ type: 'questionnaire_failed', reason: 'missing_answers', userId });
      return res.status(400).json({ message: 'answers array is required' });
    }
    const user = await User.findById(userId);
    if (!user) {
      appendEvent({ type: 'questionnaire_failed', reason: 'user_not_found', userId });
      return res.status(404).json({ message: 'User not found' });
    }

    // Compute a simple score: number of 'yes' answers
    const yesCount = answers.reduce((acc, a) => acc + (String(a).toLowerCase() === 'yes' ? 1 : 0), 0);

    // Persist the result linked to the user
    const result = await Result.create({ userId, answers, yesCount });

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
        answersCount: result.answers.length,
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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Logging events to: ${LOG_FILE}`);
});
