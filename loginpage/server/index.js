import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import https from "https";
import crypto from "crypto";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Load environment variables from .env (and optionally .env.local)
const rootEnvPath = path.resolve(process.cwd(), ".env");
const localEnvPath = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: rootEnvPath });
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: true });
}

// Helper to resolve a Gemini API key from multiple possible env var names
function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.VITE_GOOGLE_API_KEY ||
    ""
  );
}

// Helper to resolve TheirStack API token
function getTheirStackToken() {
  return (
    process.env.THEIRSTACK_API_TOKEN ||
    process.env.VITE_THEIRSTACK_API_TOKEN ||
    ""
  );
}

// Helper to resolve SerpApi API key (for Google Jobs engine)
function getSerpApiKey() {
  return process.env.SERPAPI_API_KEY || "";
}

const app = express();
const PORT = process.env.PORT || 5002;
const MONGODB_URI = process.env.MONGODB_URI || "";

// Local file logging setup
const DEFAULT_LOG_FILE = path.resolve(process.cwd(), "server", "data", "events.log");
const LOG_FILE = process.env.LOG_FILE || DEFAULT_LOG_FILE;
const LOG_DIR = path.dirname(LOG_FILE);
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (e) {
  console.error("Could not create log directory:", e);
}
function appendEvent(event) {
  const safe = {
    ...event,
    ts: new Date().toISOString(),
  };
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(safe) + "\n");
  } catch (e) {
    console.error("Failed to write log event:", e);
  }
}

// Process-level safety nets
process.on("unhandledRejection", (reason) => {
  try {
    appendEvent({
      type: "unhandled_rejection",
      error: String((reason && reason.message) || reason),
    });
  } catch {}
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  try {
    appendEvent({ type: "uncaught_exception", error: err?.message });
  } catch {}
  console.error("Uncaught Exception:", err);
});

// Async route wrapper
const wrapAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(cors());
app.use(express.json());

// // Connect to MongoDB
mongoose
  .connect(MONGODB_URI, { dbName: process.env.MONGODB_DB || undefined })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// User schema
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    questionnaireCompleted: { type: Boolean, default: false },
    questionnaireCompletedAt: { type: Date, default: null },
    userTag: {
      type: String,
      default: function () {
        try {
          return "U-" + String(this._id).slice(-6).toUpperCase();
        } catch (e) {
          return undefined;
        }
      },
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

// Quiz/Questionnaire results schema
// Supports legacy quiz (answers/yesCount) and new profile form (major/interests/classYear)
const resultSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Legacy fields
    answers: { type: [String], required: false },
    yesCount: { type: Number, default: 0 },
    // New fields
    major: { type: String },
    interests: { type: [String], default: [] },
    classYear: { type: String },
  },
  { timestamps: true },
);

const Result = mongoose.model("Result", resultSchema);

// Advanced Questionnaire schema (6 generic + 8 AI-generated questions & answers)
const advancedQASchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
  { timestamps: true },
);

const AdvancedQA = mongoose.model("AdvancedQA", advancedQASchema);

// 6 starter generic questions
const ADV_GENERIC_QUESTIONS = [
  "What is your preferred work environment (remote, hybrid, on-site)?",
  "Which company size do you prefer (startup, mid-size, large enterprise)?",
  "What type of roles are you most interested in (internship, full-time, research, freelance)?",
  "What top 2 skills do you want to develop this year?",
  "What industries interest you the most (e.g., fintech, healthcare, education)?",
  "How many hours per week can you commit to professional development?",
];

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Config health (does not expose secrets)
app.get("/api/health/config", (req, res) => {
  const geminiConfigured = Boolean(getGeminiApiKey());
  const theirstackConfigured = Boolean(getTheirStackToken());
  res.json({
    status: "ok",
    geminiConfigured,
    theirstackConfigured,
    port: process.env.PORT || 5002,
    logFile:
      process.env.LOG_FILE ||
      path.resolve(process.cwd(), "server", "data", "events.log"),
  });
});

// TheirStack Job Search proxy (RE-ENABLED)
// GET /api/theirstack/jobs/search?country=US&days=7&userId=...&blur=true&keywords=intern,python&remote=true&easy_apply=true&statuses=full_time,internship&props=final_url,company_object.domain
app.get("/api/theirstack/jobs/search", wrapAsync(async (req, res) => {
  const token = getTheirStackToken();
  if (!token) {
    appendEvent({ type: "theirstack_missing_token" });
    return res.status(501).json({ message: "TheirStack token not configured" });
  }

  // Map query → TheirStack payload
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const country = (req.query.country || "US").toString();
  const days = Number(req.query.days ?? 7) || 7;
  const blur = String(req.query.blur ?? "true").toLowerCase() !== "false";
  const keywordsCsv = typeof req.query.keywords === "string" ? req.query.keywords : undefined;
  const remote = typeof req.query.remote !== "undefined" ? String(req.query.remote).toLowerCase() === "true" : undefined;
  const easyApply = typeof req.query.easy_apply !== "undefined" ? String(req.query.easy_apply).toLowerCase() === "true" : undefined;
  const statusesCsv = typeof req.query.statuses === "string" ? req.query.statuses : undefined;
  const propsCsv = typeof req.query.props === "string" ? req.query.props : undefined;
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25) || 25)); // default 25, NEVER force 1
  const page = Math.max(0, Number(req.query.page || 0) || 0);

  const payload = {
    page,
    limit, // intentionally not 1
    job_country_code_or: country ? [country] : [],
    posted_at_max_age_days: days,
    blur_company_data: blur,
  };

  if (keywordsCsv) {
    const arr = keywordsCsv.split(/\s*,\s*/).filter(Boolean);
    if (arr.length) payload.job_title_or = arr;
  }
  if (typeof remote === "boolean") payload.remote = remote;
  if (typeof easyApply === "boolean") payload.easy_apply = easyApply;
  if (statusesCsv) {
    const arr = statusesCsv.split(/\s*,\s*/).filter(Boolean);
    if (arr.length) payload.employment_statuses_or = arr;
  }
  if (propsCsv) {
    const arr = propsCsv.split(/\s*,\s*/).filter(Boolean);
    if (arr.length) payload.property_exists_or = arr;
  }

  const r = await fetch("https://api.theirstack.com/v1/jobs/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    appendEvent({ type: "theirstack_error", status: r.status, body });
    return res.status(r.status).json(body);
  }

  const rawItems = Array.isArray(body?.items) ? body.items : Array.isArray(body?.jobs) ? body.jobs : [];
  const items = rawItems
    .map((it, idx) => {
      const id = String(it.id || it.job_id || idx);
      const title = String(it.job_title || it.title || "").trim();
      const company = String(it.company || it.company_object?.name || it.company_object?.domain || "").trim();
      const createdAt = it.date_posted || it.discovered_at || new Date().toISOString();
      const applyUrl = it.final_url || it.url || it.source_url || null;
      return { id, title, company, createdAt, applyUrl, appliedAt: null };
    })
    .filter((j) => j.title && j.company);

  let withScores = items;
  try { if (userId) withScores = await attachMatchPercent(userId, items); } catch {}

  const anyScore = withScores.some((j) => typeof j.matchPercent === "number" && j.matchPercent > 0);
  const sorted = [...withScores].sort((a, b) => {
    if (anyScore) {
      const ms = (b.matchPercent || 0) - (a.matchPercent || 0);
      if (ms !== 0) return ms;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  appendEvent({ type: "theirstack_ok", count: sorted.length });
  return res.json({ items: sorted, raw: body });
}));

// POST passthrough (optional): mirror GET behavior, accept JSON body with same fields
app.post("/api/theirstack/jobs/search", wrapAsync(async (req, res) => {
  // For simplicity, redirect POST to GET-style handler by translating body → query-compatible fields
  const q = new URLSearchParams();
  const b = (req.body && typeof req.body === "object") ? req.body : {};
  if (b.userId) q.set("userId", String(b.userId));
  if (b.country) q.set("country", String(b.country));
  if (b.days != null) q.set("days", String(b.days));
  if (b.blur != null) q.set("blur", String(b.blur));
  if (Array.isArray(b.job_title_or)) q.set("keywords", b.job_title_or.join(","));
  if (typeof b.remote === "boolean") q.set("remote", String(b.remote));
  if (typeof b.easy_apply === "boolean") q.set("easy_apply", String(b.easy_apply));
  if (Array.isArray(b.employment_statuses_or)) q.set("statuses", b.employment_statuses_or.join(","));
  if (Array.isArray(b.property_exists_or)) q.set("props", b.property_exists_or.join(","));
  if (b.limit != null) q.set("limit", String(b.limit));
  if (b.page != null) q.set("page", String(b.page));
  req.query = Object.fromEntries(q.entries());
  return app._router.handle(req, res, () => {});
}));

// New: SerpApi Google Jobs proxy
// GET /api/serpapi/jobs?q=software+engineer&gl=us&hl=en&location=City
app.get("/api/serpapi/jobs", wrapAsync(async (req, res) => {
  const API_KEY = getSerpApiKey();
  if (!API_KEY) {
    appendEvent({ type: "serpapi_missing_key" });
    return res.status(501).json({ message: "SerpApi key not configured" });
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  const q = (req.query.q || req.query.keywords || "software intern").toString();
  const location = typeof req.query.location === "string" ? req.query.location : undefined;
  const google_domain = typeof req.query.google_domain === "string" ? req.query.google_domain : undefined;
  const gl = (req.query.gl || req.query.country || "us").toString();
  const hl = (req.query.hl || "en").toString();
  const next_page_token = typeof req.query.next_page_token === "string" ? req.query.next_page_token : undefined;
  const no_cache = typeof req.query.no_cache !== "undefined" ? String(req.query.no_cache) : undefined;
  const asyncFlag = typeof req.query.async !== "undefined" ? String(req.query.async) : undefined;
  const output = typeof req.query.output === "string" ? req.query.output : undefined;
  const json_restrictor = typeof req.query.json_restrictor === "string" ? req.query.json_restrictor : undefined;

  const params = new URLSearchParams();
  params.set("engine", "google_jobs");
  params.set("q", q);
  if (location) params.set("location", location);
  if (google_domain) params.set("google_domain", google_domain);
  if (gl) params.set("gl", gl);
  if (hl) params.set("hl", hl);
  if (next_page_token) params.set("next_page_token", next_page_token);
  if (no_cache !== undefined) params.set("no_cache", no_cache);
  if (asyncFlag !== undefined) params.set("async", asyncFlag);
  if (output) params.set("output", output);
  if (json_restrictor) params.set("json_restrictor", json_restrictor);
  params.set("api_key", API_KEY);

  const url = `https://serpapi.com/search.json?${params.toString()}`;
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    appendEvent({ type: "serpapi_error", status: r.status, body });
    return res.status(r.status).json(body);
  }

  const rawItems = Array.isArray(body?.jobs_results) ? body.jobs_results : [];
  const items = rawItems
    .map((it, idx) => {
      const id = String(it.job_id || it.job_id_jrt || it.job_id_oid || it.position || it.link || idx);
      const title = String(it.title || "").trim();
      const company = String(it.company_name || it.source || "").trim();
      // Attempt to derive createdAt from detected_extensions or published_at
      const ext = it.detected_extensions || {};
      const postedAt = ext.posted_at || ext.posted_at_text || it.published_at || it.created_at;
      const createdAt = postedAt || new Date().toISOString();
      const applyUrl = Array.isArray(it.apply_options) && it.apply_options.length
        ? (it.apply_options[0].link || it.apply_options[0].apply_link || null)
        : (it.google_jobs_url || it.link || null);
      return { id, title, company, createdAt, applyUrl, appliedAt: null };
    })
    .filter((j) => j.title && j.company);

  let withScores = items;
  try {
    if (userId) withScores = await attachMatchPercent(userId, items);
  } catch {}

  const anyScore = withScores.some((j) => typeof j.matchPercent === "number" && j.matchPercent > 0);
  const sorted = [...withScores].sort((a, b) => {
    if (anyScore) {
      const ms = (b.matchPercent || 0) - (a.matchPercent || 0);
      if (ms !== 0) return ms;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  appendEvent({ type: "serpapi_ok", count: sorted.length });
  return res.json({ items: sorted, raw: body });
}));

// Register endpoint
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      appendEvent({ type: "register_failed", reason: "missing_fields" });
      return res.status(400).json({ message: "Email and password are required." });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      appendEvent({ type: "register_failed", email, reason: "email_exists" });
      return res.status(409).json({ message: "Email already registered." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash });
    appendEvent({ type: "register", email, userId: String(user._id) });
    return res.status(201).json({
      message: "Registered successfully",
      userId: user._id,
      email: user.email,
      createdAt: user.createdAt,
      questionnaireCompleted: user.questionnaireCompleted,
      userTag: user.userTag,
    });
  } catch (err) {
    console.error("Register error:", err);
    appendEvent({ type: "register_error", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      appendEvent({ type: "login_failed", reason: "missing_fields" });
      return res.status(400).json({ message: "Email and password are required." });
    }
    const user = await User.findOne({ email });
    if (!user) {
      appendEvent({ type: "login_failed", email, reason: "user_not_found" });
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      appendEvent({ type: "login_failed", email, reason: "bad_password" });
      return res.status(401).json({ message: "Invalid credentials" });
    }
    appendEvent({ type: "login", email, userId: String(user._id) });
    return res.json({
      message: "Login successful",
      userId: user._id,
      email: user.email,
      questionnaireCompleted: user.questionnaireCompleted,
      createdAt: user.createdAt,
      userTag: user.userTag,
    });
  } catch (err) {
    console.error("Login error:", err);
    appendEvent({ type: "login_error", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Gemini proxy endpoint
// Questionnaire submission: marks questionnaire as completed
app.post("/api/questionnaire", async (req, res) => {
  try {
    const { userId, answers, major, interests, classYear } = req.body || {};
    if (!userId) {
      appendEvent({ type: "questionnaire_failed", reason: "missing_user" });
      return res.status(400).json({ message: "userId is required" });
    }

    const isLegacy = Array.isArray(answers) && answers.length > 0;
    const isNew =
      typeof major === "string" &&
      major.trim().length > 0 &&
      typeof classYear === "string" &&
      classYear.trim().length > 0;

    if (!isLegacy && !isNew) {
      appendEvent({
        type: "questionnaire_failed",
        reason: "missing_payload",
        userId,
      });
      return res.status(400).json({
        message: "Provide either answers array (legacy) or major and classYear (new form).",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      appendEvent({
        type: "questionnaire_failed",
        reason: "user_not_found",
        userId,
      });
      return res.status(404).json({ message: "User not found" });
    }

    let result;
    if (isLegacy) {
      // Compute a simple score: number of 'yes' answers
      const yesCount = answers.reduce(
        (acc, a) => acc + (String(a).toLowerCase() === "yes" ? 1 : 0),
        0,
      );
      result = await Result.create({ userId, answers, yesCount });
    } else {
      const cleanedInterests = Array.isArray(interests)
        ? interests.map((s) => String(s)).filter(Boolean)
        : [];
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

    appendEvent({
      type: "questionnaire_completed",
      userId: String(user._id),
      resultId: String(result._id),
    });
    return res.json({
      message: "Questionnaire saved",
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
    console.error("Questionnaire error:", err);
    appendEvent({ type: "questionnaire_error", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Fetch results for a user
app.get("/api/results", async (req, res) => {
  try {
    const { userId } = req.query || {};
    if (!userId) {
      appendEvent({ type: "results_failed", reason: "missing_user" });
      return res.status(400).json({ message: "userId query parameter is required" });
    }
    const results = await Result.find({ userId }).sort({ createdAt: -1 }).lean();
    appendEvent({ type: "results_fetch", userId, count: results.length });
    return res.json({ userId, results });
  } catch (err) {
    console.error("Results fetch error:", err);
    appendEvent({ type: "results_error", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/gemini", async (req, res) => {
  try {
    const message = (req.body && req.body.message) || req.query?.message;
    if (!message || typeof message !== "string") {
      appendEvent({ type: "gemini_failed", reason: "missing_message" });
      return res.status(400).json({ message: 'Parameter "message" is required.' });
    }

    const GEMINI_API_KEY = getGeminiApiKey();
    if (!GEMINI_API_KEY) {
      appendEvent({ type: "gemini_failed", reason: "missing_api_key" });
      return res.status(500).json({
        message: "Server not configured: Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env",
      });
    }
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    const payload = {
      contents: [
        {
          parts: [{ text: message }],
        },
      ],
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      appendEvent({
        type: "gemini_error",
        status: resp.status,
        statusText: resp.statusText,
        body: data,
      });
      return res.status(resp.status).json({
        message: "Gemini API error",
        status: resp.status,
        statusText: resp.statusText,
        body: data,
      });
    }

    appendEvent({ type: "gemini_request", ok: true });
    return res.json(data);
  } catch (err) {
    console.error("Gemini proxy error:", err);
    appendEvent({ type: "gemini_exception", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Advanced questionnaire endpoints

function safeArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (v == null ? "" : String(v))).filter((s) => s.length > 0);
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
app.get("/api/advanced/init-questions", (req, res) => {
  appendEvent({ type: "adv_init_questions" });
  return res.json({ questions: ADV_GENERIC_QUESTIONS });
});

// Generate 8 personalized questions from Gemini based on user profile, prior answers, and current generic answers
app.post("/api/advanced/generate", async (req, res) => {
  try {
    const { userId, genericAnswers, dashboardContext, targetCareer } = req.body || {};
    if (!userId) {
      appendEvent({ type: "adv_generate_failed", reason: "missing_user" });
      return res.status(400).json({ message: "userId is required" });
    }
    const gAnswers = safeArrayOfStrings(genericAnswers);
    if (gAnswers.length !== ADV_GENERIC_QUESTIONS.length) {
      appendEvent({
        type: "adv_generate_failed",
        reason: "bad_generic_answers",
        count: gAnswers.length,
      });
      return res.status(400).json({
        message: `Provide ${ADV_GENERIC_QUESTIONS.length} genericAnswers`,
      });
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
      profile.interests && profile.interests.length
        ? `Interests: ${profile.interests.join(", ")}`
        : null,
      dashboardContext ? `Dashboard: ${String(dashboardContext)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const priorBits = priorQA
      ? [
          "PRIOR PERSONALIZED Q&A",
          ...(Array.isArray(priorQA.aiQuestions)
            ? priorQA.aiQuestions.map(
                (q, i) => `${i + 1}. ${q}\nAnswer: ${String(priorQA.aiAnswers?.[i] || "").trim()}`,
              )
            : []),
        ].join("\n")
      : "";

    const GEMINI_API_KEY = getGeminiApiKey();
    if (!GEMINI_API_KEY) {
      appendEvent({ type: "adv_generate_failed", reason: "missing_api_key" });
      return res.status(500).json({
        message: "Server not configured: Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env",
      });
    }

    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt = [
      "You are creating an in-depth career questionnaire for a university student. ",
      'First, determine ONE specific target career title (e.g., "Data Analyst", "UX Designer", "Supply Chain Analyst") that best fits the PROFILE and GENERIC answers. ',
      "If a TARGET CAREER HINT is provided, prefer that exact role when reasonable. ",
      "Then generate 8 short follow-up questions that are explicitly tailored to succeeding in that ONE role. ",
      "Avoid broad, general field questions. Make them role-specific: tools/technologies, key artifacts, metrics/KPIs, workflows, internships/projects, portfolios, certifications/prereqs, and constraints. ",
      "Do not repeat previous questions. Vary themes. ",
      'Return ONLY compact JSON with key "questions" as an array of 8 strings. No commentary.',
    ].join("");

    const sections = [
      `PROFILE\n${contextBits}`,
      `GENERIC QUESTIONS & ANSWERS\n${ADV_GENERIC_QUESTIONS.map((q, i) => `${i + 1}. ${q}\nAnswer: ${gAnswers[i]}`).join("\n")}`,
      priorBits ? priorBits : null,
      `TARGET CAREER HINT\n${String(targetCareer || "").trim()}`,
      'JSON OUTPUT FORMAT\n{"questions": ["...8 items..."]}',
    ]
      .filter(Boolean)
      .join("\n\n");

    const payload = {
      contents: [{ parts: [{ text: `${prompt}\n\n${sections}` }] }],
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      appendEvent({
        type: "adv_generate_error",
        status: resp.status,
        body: data,
      });
      return res.status(resp.status).json({ message: "Gemini API error", body: data });
    }

    // Try to extract text
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let questions = [];
    try {
      const jsonMatch = textOut.match(/\{[\s\S]*}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textOut);
      if (parsed && Array.isArray(parsed.questions)) {
        questions = parsed.questions
          .map((q) => String(q))
          .filter(Boolean)
          .slice(0, 8);
      }
    } catch (_) {
      // fallback: try to split lines
      questions = String(textOut)
        .split(/\n|\r/)
        .map((s) => s.replace(/^[-*\d\.\)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 8);
    }

    if (questions.length !== 8) {
      appendEvent({ type: "adv_generate_bad_output", got: questions.length });
      return res.status(502).json({ message: "AI did not return 8 questions", raw: textOut });
    }

    appendEvent({
      type: "adv_generate_ok",
      userId: String(userId),
      targetCareer: String(targetCareer || "").trim(),
    });
    return res.json({
      aiQuestions: questions,
      profileSnapshot: profile,
      usedPrior: Boolean(priorQA),
    });
  } catch (err) {
    console.error("Advanced generate error:", err);
    appendEvent({ type: "adv_generate_exception", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Submit all advanced questionnaire answers for persistence
app.post("/api/advanced/submit", async (req, res) => {
  try {
    const { userId, genericQuestions, genericAnswers, aiQuestions, aiAnswers, profileSnapshot } =
      req.body || {};
    if (!userId) {
      appendEvent({ type: "adv_submit_failed", reason: "missing_user" });
      return res.status(400).json({ message: "userId is required" });
    }
    const gQ = safeArrayOfStrings(genericQuestions);
    const gA = safeArrayOfStrings(genericAnswers);
    const aQ = safeArrayOfStrings(aiQuestions);
    const aA = safeArrayOfStrings(aiAnswers);

    if (gQ.length !== ADV_GENERIC_QUESTIONS.length || gA.length !== ADV_GENERIC_QUESTIONS.length) {
      appendEvent({ type: "adv_submit_failed", reason: "bad_generic_lengths" });
      return res.status(400).json({
        message: `Must provide ${ADV_GENERIC_QUESTIONS.length} genericQuestions and genericAnswers`,
      });
    }
    if (aQ.length !== 8 || aA.length !== 8) {
      appendEvent({ type: "adv_submit_failed", reason: "bad_ai_lengths" });
      return res.status(400).json({ message: "Must provide 8 aiQuestions and 8 aiAnswers" });
    }

    const profile =
      profileSnapshot && typeof profileSnapshot === "object"
        ? profileSnapshot
        : await getProfileSnapshot(userId);

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

    appendEvent({
      type: "adv_submit_ok",
      userId: String(userId),
      id: String(doc._id),
    });
    return res.status(201).json({
      message: "Advanced questionnaire saved",
      id: doc._id,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error("Advanced submit error:", err);
    appendEvent({ type: "adv_submit_exception", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Fetch latest advanced questionnaire for a user
app.get("/api/advanced/my", async (req, res) => {
  try {
    const { userId } = req.query || {};
    if (!userId) {
      appendEvent({ type: "adv_my_failed", reason: "missing_user" });
      return res.status(400).json({ message: "userId query parameter is required" });
    }
    const doc = await AdvancedQA.findOne({ userId }).sort({ createdAt: -1 }).lean();
    appendEvent({
      type: "adv_my_ok",
      userId: String(userId),
      hasDoc: Boolean(doc),
    });
    return res.json({ userId, advanced: doc || null });
  } catch (err) {
    console.error("Advanced my fetch error:", err);
    appendEvent({ type: "adv_my_exception", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Job Matches schema: stores AI-recommended jobs for a user
const jobMatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [
      new mongoose.Schema(
        {
          title: { type: String, required: true },
          score: { type: Number, required: true }, // 0-100
          reason: { type: String },
        },
        { _id: false },
      ),
    ],
    profileSnapshot: {
      major: { type: String },
      interests: { type: [String], default: [] },
      classYear: { type: String },
    },
    sourceQAId: { type: mongoose.Schema.Types.ObjectId, ref: "AdvancedQA" },
  },
  { timestamps: true },
);

const JobMatch = mongoose.model("JobMatch", jobMatchSchema);

// Generate job matches based on profile + advanced questionnaire answers
app.post("/api/jobs/generate", async (req, res) => {
  try {
    const { userId, count } = req.body || {};
    if (!userId) {
      appendEvent({ type: "jobs_generate_failed", reason: "missing_user" });
      return res.status(400).json({ message: "userId is required" });
    }

    const profile = await getProfileSnapshot(userId);
    const adv = await AdvancedQA.findOne({ userId }).sort({ createdAt: -1 }).lean();

    if (!profile?.major && (!profile?.interests || profile.interests.length === 0)) {
      appendEvent({ type: "jobs_generate_failed", reason: "no_profile" });
      return res.status(400).json({ message: "Please complete your profile first." });
    }

    const GEMINI_API_KEY = getGeminiApiKey();
    if (!GEMINI_API_KEY) {
      appendEvent({ type: "jobs_generate_failed", reason: "missing_api_key" });
      return res.status(500).json({
        message: "Server not configured: Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env",
      });
    }

    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const desired = Math.min(Math.max(parseInt(count || "8", 10) || 8, 5), 12);

    const profileText = [
      profile?.major ? `Major: ${profile.major}` : null,
      profile?.classYear ? `Class Year: ${profile.classYear}` : null,
      profile?.interests?.length ? `Interests: ${profile.interests.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const advText = adv
      ? [
          "GENERIC Q&A:",
          ...(adv.genericQuestions || []).map(
            (q, i) => `${i + 1}. ${q}\nAnswer: ${String(adv.genericAnswers?.[i] || "")}`,
          ),
          "PERSONALIZED Q&A:",
          ...(adv.aiQuestions || []).map(
            (q, i) => `${i + 1}. ${q}\nAnswer: ${String(adv.aiAnswers?.[i] || "")}`,
          ),
        ].join("\n")
      : "No advanced questionnaire found yet.";

    const prompt = [
      "You are a career assistant. Using the PROFILE and QUESTIONNAIRE context, return a compact JSON with top matching jobs.",
      'Return an object { "jobs": [ { "title": string, "score": number(0-100), "reason": string } ] } with between 6 and 10 items.',
      "Ensure scores are integers 0-100 and sort from highest to lowest suitability. No extra commentary.",
    ].join(" ");

    const sections = [
      `PROFILE\n${profileText}`,
      `QUESTIONNAIRE\n${advText}`,
      `OUTPUT FORMAT\n{"jobs":[{"title":"...","score":95,"reason":"..."}]}`,
      `COUNT\n${desired}`,
    ].join("\n\n");

    const payload = {
      contents: [{ parts: [{ text: `${prompt}\n\n${sections}` }] }],
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      appendEvent({
        type: "jobs_generate_error",
        status: resp.status,
        body: data,
      });
      return res.status(resp.status).json({ message: "Gemini API error", body: data });
    }

    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let jobs = [];
    try {
      const jsonMatch = textOut.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textOut);
      if (parsed && Array.isArray(parsed.jobs)) {
        jobs = parsed.jobs
          .map((j) => ({
            title: String(j.title || "").trim(),
            score: Math.max(0, Math.min(100, parseInt(j.score, 10) || 0)),
            reason: String(j.reason || "").trim(),
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
          const title = line.replace(/[-:].*$/, "").trim();
          const score = m ? parseInt(m[3], 10) : 0;
          const reason = line.includes(":") ? line.split(":").slice(1).join(":").trim() : "";
          return {
            title,
            score: Math.max(0, Math.min(100, score || 0)),
            reason,
          };
        })
        .filter((j) => j.title)
        .slice(0, 10);
    }

    if (!jobs.length) {
      appendEvent({ type: "jobs_generate_bad_output" });
      return res.status(502).json({ message: "AI did not return job matches", raw: textOut });
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

    appendEvent({
      type: "jobs_generate_ok",
      userId: String(userId),
      id: String(doc._id),
      count: jobs.length,
    });
    return res.status(201).json({
      message: "Job matches generated",
      matches: jobs,
      id: doc._id,
      createdAt: doc.createdAt,
      profileSnapshot: doc.profileSnapshot,
    });
  } catch (err) {
    console.error("Jobs generate error:", err);
    appendEvent({ type: "jobs_generate_exception", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Fetch latest job matches for a user
app.get("/api/jobs/my", async (req, res) => {
  try {
    const { userId } = req.query || {};
    if (!userId) {
      appendEvent({ type: "jobs_my_failed", reason: "missing_user" });
      return res.status(400).json({ message: "userId query parameter is required" });
    }
    const doc = await JobMatch.findOne({ userId }).sort({ createdAt: -1 }).lean();
    appendEvent({
      type: "jobs_my_ok",
      userId: String(userId),
      hasDoc: Boolean(doc),
    });
    return res.json({
      userId,
      matches: doc?.items || [],
      createdAt: doc?.createdAt || null,
      profileSnapshot: doc?.profileSnapshot || null,
    });
  } catch (err) {
    console.error("Jobs my fetch error:", err);
    appendEvent({ type: "jobs_my_exception", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Job Postings schema: stores postings and applicants
const jobPostingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // posting name
    company: { type: String, required: true },
    postedAt: { type: Date, default: Date.now }, // creation of post
    applicants: [
      new mongoose.Schema(
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          appliedAt: { type: Date, default: Date.now }, // time applied
        },
        { _id: false },
      ),
    ],
  },
  { timestamps: true },
);

const JobPosting = mongoose.model("JobPosting", jobPostingSchema);

// Utility: compute simple match percentage using latest JobMatch for user
async function attachMatchPercent(userId, postings) {
  if (!userId) {
    return postings.map((p) => ({ ...p, matchPercent: null }));
  }
  const jm = await JobMatch.findOne({ userId }).sort({ createdAt: -1 }).lean();
  const items = jm?.items || [];
  const scoreMap = new Map(
    items.map((it) => [String(it.title || "").toLowerCase(), it.score || 0]),
  );
  function scoreFor(title) {
    const key = String(title || "").toLowerCase();
    if (scoreMap.has(key)) return scoreMap.get(key);
    // try loose includes
    let best = 0;
    for (const [t, s] of scoreMap.entries()) {
      if (t.includes(key) || key.includes(t)) {
        best = Math.max(best, s || 0);
      }
    }
    return best || 0;
  }
  return postings.map((p) => ({ ...p, matchPercent: scoreFor(p.title) }));
}

// GET /api/job-postings?userId=...
app.get("/api/job-postings", async (req, res) => {
  try {
    const { userId } = req.query || {};
    const docs = await JobPosting.find({}).sort({ createdAt: -1 }).lean();

    const base = docs.map((d) => {
      const applied = userId
        ? (d.applicants || []).find((a) => String(a.userId) === String(userId))
        : null;
      return {
        id: String(d._id),
        title: d.title,
        company: d.company,
        createdAt: d.postedAt || d.createdAt,
        appliedAt: applied?.appliedAt || null,
      };
    });

    const withScores = await attachMatchPercent(userId, base);
    // Auto-sort: by matchPercent desc when any scores exist, otherwise by newest
    const anyScore = withScores.some((j) => typeof j.matchPercent === "number" && j.matchPercent > 0);
    const sorted = [...withScores].sort((a, b) => {
      if (anyScore) {
        const ms = (b.matchPercent || 0) - (a.matchPercent || 0);
        if (ms !== 0) return ms;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    appendEvent({
      type: "job_postings_list",
      count: sorted.length,
      userId: userId ? String(userId) : undefined,
    });
    return res.json({ items: sorted });
  } catch (err) {
    console.error("Job postings list error:", err);
    appendEvent({ type: "job_postings_list_error", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/job-postings (seed or create single posting)
app.post("/api/job-postings", async (req, res) => {
  try {
    const { title, company, seed } = req.body || {};
    if (seed) {
      const existing = await JobPosting.countDocuments();
      if (existing > 0) {
        return res.json({ message: "Already seeded", count: existing });
      }
      const sample = [
        { title: "Software Engineering Intern (Backend)", company: "TechNova" },
        { title: "Full-Stack Intern (React/Python)", company: "InsightWorks" },
        { title: "Data Engineering Intern (Jr.)", company: "BrightWeb" },
        { title: "QA Analyst Intern", company: "QualityFirst" },
        { title: "IT Support Associate", company: "CampusTech" },
        { title: "Product Management Intern", company: "InnoLabs" },
      ];
      const docs = await JobPosting.insertMany(sample.map((s) => ({ ...s, postedAt: new Date() })));
      appendEvent({ type: "job_postings_seed", count: docs.length });
      return res.status(201).json({ message: "Seeded", count: docs.length });
    }

    if (!title || !company) {
      return res.status(400).json({ message: "title and company are required" });
    }
    const doc = await JobPosting.create({ title, company, postedAt: new Date() });
    appendEvent({ type: "job_posting_created", id: String(doc._id) });
    return res.status(201).json({ id: doc._id });
  } catch (err) {
    console.error("Job posting create error:", err);
    appendEvent({ type: "job_posting_create_error", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/job-postings/:id/apply { userId }
app.post("/api/job-postings/:id/apply", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    const doc = await JobPosting.findById(id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const exists = (doc.applicants || []).some((a) => String(a.userId) === String(userId));
    if (!exists) {
      doc.applicants.push({ userId, appliedAt: new Date() });
      await doc.save();
    }
    appendEvent({ type: "job_posting_applied", id: String(id), userId: String(userId) });
    return res.json({ message: "Applied", id, userId });
  } catch (err) {
    console.error("Job posting apply error:", err);
    appendEvent({ type: "job_posting_apply_error", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Resume extraction endpoint (PDF/DOCX)
const upload = multer({ storage: multer.memoryStorage() });
app.post("/api/resume/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const { originalname, mimetype, buffer } = req.file;
    const name = String(originalname || "");
    const ext = name.split(".").pop()?.toLowerCase();
    let text = "";

    if (mimetype === "application/pdf" || ext === "pdf") {
      const data = await pdfParse(buffer).catch(() => null);
      text = data?.text || "";
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result?.value || "";
    } else if (ext === "doc") {
      return res
        .status(415)
        .json({ message: "Legacy .doc format not supported. Please upload a .docx or PDF." });
    } else {
      return res.status(415).json({ message: "Unsupported file type. Upload a PDF or DOCX." });
    }

    text = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) {
      return res.status(422).json({ message: "Could not extract text from file." });
    }
    return res.json({ text, chars: text.length });
  } catch (err) {
    console.error("Resume extract error:", err);
    appendEvent({ type: "resume_extract_error", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Resume feedback endpoint using Gemini
app.post("/api/resume/feedback", async (req, res) => {
  try {
    const { resumeText, savedJobs, compareToJobs } = req.body || {};
    const text = String(resumeText || "").trim();
    const jobs = Array.isArray(savedJobs) ? savedJobs : [];
    const compare = typeof compareToJobs === "boolean" ? compareToJobs : true;
    if (!text) {
      return res.status(400).json({ message: "resumeText is required" });
    }

    // Stopwords (lowercase) to exclude from heuristic keywords
    const STOPWORDS = new Set([
      "the",
      "and",
      "or",
      "a",
      "an",
      "to",
      "of",
      "in",
      "on",
      "for",
      "with",
      "by",
      "at",
      "from",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "this",
      "that",
      "these",
      "those",
      "as",
      "it",
      "its",
      "but",
      "if",
      "not",
      "no",
      "yes",
      "you",
      "your",
      "we",
      "our",
      "they",
      "their",
      "he",
      "she",
      "him",
      "her",
      "them",
      "i",
      "me",
      "my",
      "mine",
      "ours",
      "using",
      "time",
    ]);

    // If user opts not to compare to jobs, return keywords only
    if (!compare) {
      const resumeWords = text.toLowerCase().match(/[a-zA-Z][a-zA-Z0-9+.#-]{2,}/g) || [];
      const freq = resumeWords.reduce((m, w) => ((m[w] = (m[w] || 0) + 1), m), {});
      const TECH =
        /(python|java(script)?|typescript|c\+\+|c#|c\b|go|golang|rust|ruby|php|sql|mysql|postgres|postgresql|mongodb|redis|oracle|html|css|sass|tailwind|react|angular|vue|node(\.js)?|express(\.js)?|next(\.js)?|nuxt|django|flask|spring|springboot|\.net|dotnet|kubernetes|docker|terraform|ansible|grafana|prometheus|aws|azure|gcp|google\s?cloud|jenkins|git(hub|lab)?|ci\/?cd|graphql|rest|api|pandas|numpy|tensorflow|pytorch|scikit-?learn|sklearn|keras|linux|bash|powershell)/i;
      const entries = Object.entries(freq).filter(([w]) => !STOPWORDS.has(w));
      entries.sort((a, b) => {
        const as = a[1] + (TECH.test(a[0]) ? 5 : 0);
        const bs = b[1] + (TECH.test(b[0]) ? 5 : 0);
        return bs - as;
      });
      const baseKeywords = entries.slice(0, 15).map(([w]) => w);
      appendEvent({ type: "resume_feedback_keywords_only", keywords: baseKeywords.length });
      return res.json({ keywords: baseKeywords, jobs: [], ai: false });
    }
    if (!Array.isArray(jobs) || jobs.length === 0) {
      const resumeWords = text.toLowerCase().match(/[a-zA-Z][a-zA-Z0-9+.#-]{2,}/g) || [];
      const freq = resumeWords.reduce((m, w) => ((m[w] = (m[w] || 0) + 1), m), {});
      const TECH =
        /(python|java(script)?|typescript|c\+\+|c#|c\b|go|golang|rust|ruby|php|sql|mysql|postgres|postgresql|mongodb|redis|oracle|html|css|sass|tailwind|react|angular|vue|node(\.js)?|express(\.js)?|next(\.js)?|nuxt|django|flask|spring|springboot|\.net|dotnet|kubernetes|docker|terraform|ansible|grafana|prometheus|aws|azure|gcp|google\s?cloud|jenkins|git(hub|lab)?|ci\/?cd|graphql|rest|api|pandas|numpy|tensorflow|pytorch|scikit-?learn|sklearn|keras|linux|bash|powershell)/i;
      const entries = Object.entries(freq).filter(([w]) => !STOPWORDS.has(w));
      entries.sort((a, b) => {
        const as = a[1] + (TECH.test(a[0]) ? 5 : 0);
        const bs = b[1] + (TECH.test(b[0]) ? 5 : 0);
        return bs - as;
      });
      const baseKeywords = entries.slice(0, 15).map(([w]) => w);
      appendEvent({ type: "resume_feedback_no_jobs_keywords_only", keywords: baseKeywords.length });
      return res.json({ keywords: baseKeywords, jobs: [], ai: false });
    }

    const GEMINI_API_KEY = getGeminiApiKey();
    if (!GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ message: "Server not configured: Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env" });
    }

    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const jobList = jobs
      .map((j, i) => {
        const id = j.id ?? i;
        const title = (j.title || j.name || "").toString();
        const company = (j.company || j.org || "").toString();
        const desc = (j.description || j.desc || j.reason || "").toString();
        return `- id:${id} | ${title} @ ${company}\n${desc}`.trim();
      })
      .join("\n\n");

    const prompt = [
      "You are an ATS-style resume analyzer.",
      "Task: From the RESUME TEXT, identify and list the candidate's key skills with priority on technical skills (technologies, tools, frameworks, programming languages, cloud/DevOps, data/ML libraries, databases). Use these extracted technical skills as KEYWORDS.",
      "Then, for each job in SAVED JOBS, compute a match percentage (0-100) based on overlap between these KEYWORDS and the job text (title/company/description).",
      "For each job, include which KEYWORDS matched as matchedKeywords.",
      "Return strictly valid JSON only following this schema:",
      '{"keywords": ["keyword"...], "jobs": [{"id": string|number, "title": string, "company": string, "score": number, "matchedKeywords": ["..."], "notes": string}]}',
    ].join(" ");

    const sections = [
      `RESUME TEXT\n${text.slice(0, 15000)}`,
      `SAVED JOBS\n${jobList}`,
      'OUTPUT FORMAT\n{"keywords": ["..."], "jobs": [{"id": "...", "title": "...", "company": "...", "score": 0, "matchedKeywords": ["..."], "notes": "..."}]}',
    ].join("\n\n");

    const payload = { contents: [{ parts: [{ text: `${prompt}\n\n${sections}` }] }] };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      appendEvent({ type: "resume_feedback_ai_error", status: resp.status, body: data });
      return res.status(resp.status).json({ message: "Gemini API error", body: data });
    }

    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed = null;
    try {
      const jsonMatch = textOut.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textOut);
    } catch (_) {}

    if (!parsed || !Array.isArray(parsed.jobs)) {
      // Fallback: derive keywords from resume text frequency
      const resumeWords = text.toLowerCase().match(/[a-zA-Z][a-zA-Z0-9+.#-]{2,}/g) || [];
      const freq = resumeWords.reduce((m, w) => ((m[w] = (m[w] || 0) + 1), m), {});
      const TECH =
        /(python|java(script)?|typescript|c\+\+|c#|c\b|go|golang|rust|ruby|php|sql|mysql|postgres|postgresql|mongodb|redis|oracle|html|css|sass|tailwind|react|angular|vue|node(\.js)?|express(\.js)?|next(\.js)?|nuxt|django|flask|spring|springboot|\.net|dotnet|kubernetes|docker|terraform|ansible|grafana|prometheus|aws|azure|gcp|google\s?cloud|jenkins|git(hub|lab)?|ci\/?cd|graphql|rest|api|pandas|numpy|tensorflow|pytorch|scikit-?learn|sklearn|keras|linux|bash|powershell)/i;
      const entries = Object.entries(freq).filter(([w]) => !STOPWORDS.has(w));
      entries.sort((a, b) => {
        const as = a[1] + (TECH.test(a[0]) ? 5 : 0);
        const bs = b[1] + (TECH.test(b[0]) ? 5 : 0);
        return bs - as;
      });
      const baseKeywords = entries.slice(0, 15).map(([w]) => w);

      const baseSet = new Set(baseKeywords.map((k) => String(k).toLowerCase()));
      const results = jobs.map((j, i) => {
        const textBlob = [j.title, j.company, j.description, j.reason]
          .map((s) => (s || "").toString().toLowerCase())
          .join(" ");
        const matched = baseKeywords.filter((k) => textBlob.includes(k.toLowerCase()));
        const denom = Math.max(5, baseKeywords.length || 1);
        const score = Math.round((matched.length / denom) * 100);
        // Derive up to 4 missing keywords from the job text (tech-focused) that are not present in resume keywords
        const jobWords = textBlob.match(/[a-zA-Z][a-zA-Z0-9+.#-]{2,}/g) || [];
        const jobTech = Array.from(new Set(jobWords))
          .filter((w) => !STOPWORDS.has(w))
          .filter((w) => TECH.test(w));
        const missingKeywords = jobTech.filter((w) => !baseSet.has(w)).slice(0, 4);
        return {
          id: j.id ?? i,
          title: j.title || j.name || "",
          company: j.company || j.org || "",
          score: Math.max(0, Math.min(100, score)),
          matchedKeywords: matched,
          missingKeywords,
          notes: "Heuristic fallback based on resume keywords.",
        };
      });
      return res.json({ keywords: baseKeywords, jobs: results, ai: false });
    }

    // Normalize AI output
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords
          .map((k) => String(k))
          .filter(Boolean)
          .slice(0, 30)
      : [];
    const resultsRaw = parsed.jobs.map((j, i) => ({
      id: j.id ?? jobs[i]?.id ?? i,
      title: String(j.title || jobs[i]?.title || ""),
      company: String(j.company || jobs[i]?.company || ""),
      score: Math.max(0, Math.min(100, parseInt(j.score, 10) || 0)),
      matchedKeywords: Array.isArray(j.matchedKeywords)
        ? j.matchedKeywords
            .map((k) => String(k))
            .filter(Boolean)
            .slice(0, 30)
        : [],
      notes: String(j.notes || ""),
    }));

    const filteredKeywords = keywords;
    const resumeSet = new Set(filteredKeywords.map((k) => String(k).toLowerCase()));
    const results = resultsRaw.map((r, i) => {
      const jobBlob = [jobs[i]?.title, jobs[i]?.company, jobs[i]?.description, jobs[i]?.reason]
        .map((s) => (s || "").toString().toLowerCase())
        .join(" ");
      const jobWords = jobBlob.match(/[a-zA-Z][a-zA-Z0-9+.#-]{2,}/g) || [];
      const jobTech = Array.from(new Set(jobWords))
        .filter((w) => w && !w.includes("@"))
        .filter((w) => !w.includes("http"))
        .filter((w) => !w.includes("www"))
        .filter((w) => !w.includes(".com"))
        .filter((w) => !w.includes(".io"))
        .filter((w) => !w.includes(".org"))
        .filter((w) => !w.includes(".net"))
        .filter((w) => !w.includes(".edu"))
        .filter((w) => !STOPWORDS.has(w))
        .filter((w) =>
          /^(python|java(script)?|typescript|c\+\+|c#|c\b|go|golang|rust|ruby|php|sql|mysql|postgres|postgresql|mongodb|redis|oracle|html|css|sass|tailwind|react|angular|vue|node(\.js)?|express(\.js)?|next(\.js)?|nuxt|django|flask|spring|springboot|\.net|dotnet|kubernetes|docker|terraform|ansible|grafana|prometheus|aws|azure|gcp|google\s?cloud|jenkins|git(hub|lab)?|ci\/?cd|graphql|rest|api|pandas|numpy|tensorflow|pytorch|scikit-?learn|sklearn|keras|linux|bash|powershell)$/i.test(
            w,
          ),
        );
      const missingKeywords = jobTech.filter((w) => !resumeSet.has(w)).slice(0, 4);
      return { ...r, missingKeywords };
    });

    appendEvent({ type: "resume_feedback_ok", jobs: results.length });
    return res.json({ keywords: filteredKeywords, jobs: results, ai: true });
  } catch (err) {
    console.error("Resume feedback error:", err);
    appendEvent({ type: "resume_feedback_exception", error: err?.message });
    return res.status(500).json({ message: "Server error" });
  }
});

// Centralized error handling middleware (must be registered after routes)
app.use((err, req, res, next) => {
  try {
    const status = err?.statusCode || err?.status || 500;
    const traceId = (crypto.randomUUID && crypto.randomUUID()) || Date.now().toString(36);
    const code = err?.code || (status === 500 ? "internal_error" : "request_error");
    const msg =
      status === 500 && process.env.NODE_ENV === "production"
        ? "Server error"
        : err?.message || "Request failed";
    appendEvent({
      type: "http_error",
      status,
      path: req.path,
      method: req.method,
      code,
      traceId,
      msg,
    });
    res.status(status).json({ error: { code, message: msg, traceId } });
  } catch (middlewareErr) {
    console.error("Error in error middleware:", middlewareErr);
    res.status(500).json({ error: { code: "internal_error", message: "Server error" } });
  }
});

// Start HTTP or HTTPS server based on env SSL_CERT_PATH/SSL_KEY_PATH
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "";
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "";
const SSL_CA_PATH = process.env.SSL_CA_PATH || "";

function afterStart(protocol) {
  const base = `${protocol}://localhost:${PORT}`;
  console.log(`Server listening on ${base}`);
  console.log(`Logging events to: ${LOG_FILE}`);
  console.log(`Gemini API key configured: ${getGeminiApiKey() ? "yes" : "no"}`);
  // TheirStack status and quick connectivity probe (non-blocking)
  const theirToken = getTheirStackToken();
  console.log(`TheirStack token configured: ${theirToken ? "yes" : "no"}`);
  if (theirToken) {
    try {
      const probeBody = {
        page: 0,
        limit: 5, // not 1
        job_country_code_or: ["US"],
        posted_at_max_age_days: 7,
        blur_company_data: true,
      };
      fetch("https://api.theirstack.com/v1/jobs/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${theirToken}`,
        },
        body: JSON.stringify(probeBody),
      })
        .then((r) => {
          const msg = r.ok ? "ok" : `failed (HTTP ${r.status})`;
          console.log(`TheirStack connectivity: ${msg}`);
        })
        .catch((e) => console.log(`TheirStack connectivity: failed (${e?.message || e})`));
    } catch (e) {
      console.log(`TheirStack connectivity: failed (${e?.message || e})`);
    }
  }

  // SerpApi status (optional) to keep the endpoint available for alternates
  const serpKey = getSerpApiKey();
  console.log(`SerpApi key configured: ${serpKey ? "yes" : "no"}`);
}

if (SSL_CERT_PATH && SSL_KEY_PATH && fs.existsSync(SSL_CERT_PATH) && fs.existsSync(SSL_KEY_PATH)) {
  try {
    const options = {
      key: fs.readFileSync(SSL_KEY_PATH),
      cert: fs.readFileSync(SSL_CERT_PATH),
      ca: SSL_CA_PATH && fs.existsSync(SSL_CA_PATH) ? fs.readFileSync(SSL_CA_PATH) : undefined,
    };
    https.createServer(options, app).listen(PORT, () => afterStart("https"));
  } catch (e) {
    console.error("Failed to start HTTPS server, falling back to HTTP:", e?.message || e);
    app.listen(PORT, () => afterStart("http"));
  }
} else {
  app.listen(PORT, () => afterStart("http"));
}
