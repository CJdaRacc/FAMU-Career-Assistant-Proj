import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/loginpage';

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

// Connect to MongoDB
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
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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
    return res.status(201).json({ message: 'Registered successfully', userId: user._id });
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
    return res.json({ message: 'Login successful', userId: user._id, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    appendEvent({ type: 'login_error', error: err?.message });
    return res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Logging events to: ${LOG_FILE}`);
});
