export default function Dashboard({ user, onLogout }) {
  const handleBackToLogin = () => {
    if (typeof onLogout === "function") {
      onLogout();
    } else {
      window.location.hash = "#/login";
    }
  };
  const goToSave = () => {
    window.location.hash = "#/save";
  };
  // ... existing code ...
  return (
    <div className="container mt-2 mb-4">
      {/* change the row to grid-like spacing and align to top */}
      <div className="row g-4 align-items-start">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h2
                    className="mb-3"
                    style={{ fontFamily: '"Limelight", serif' }}
                  >
                    Dashboard
                  </h2>
                  <p className="text-muted">
                    Welcome{user?.email ? `, ${user.email}` : ""}!
                  </p>
                </div>
              </div>
              {user?.createdAt && (
                <p className="mb-0">
                  <strong>Account created:</strong>{" "}
                  {new Date(user.createdAt).toLocaleString()}
                </p>
              )}
              {user?.questionnaireCompleted ? (
                <p className="text-success mt-2">
                  Questionnaire completed. Thank you!
                </p>
              ) : (
                <p className="text-warning mt-2">
                  Questionnaire not completed yet.
                </p>
              )}

              {/* --- Mock Jobs List with Save / Apply --- */}
              <hr className="my-4" />
              <h5 className="mb-3">Job Recommendations</h5>
              <JobRecommendations user={user} />
            </div>
          </div>
        </div>

        {/* Sidebar with Sneak Peek */}
        <div className="col-12 col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="mb-2">Sneak peek: Job Matches</h5>
              <JobMatchesSneakPeek user={user} />
              <div className="mt-auto pt-3 d-grid gap-2">
                <button
                  className="btn btn-success w-100"
                  onClick={() => (window.location.hash = "#/job-postings")}
                >
                  Go to Job Postings
                </button>
                <button className="btn btn-primary w-100" onClick={goToSave}>
                  Go to Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Local helpers: mock jobs + save/apply using localStorage ---------- */
import { useEffect, useMemo, useState } from "react";

const MOCK_JOBS = [
  {
    id: "job-1",
    title: "Software Engineering Intern (Backend)",
    company: "TechNova",
    location: "Remote",
    type: "Internship",
    matchPercent: 82,
    matchedSkills: ["Python", "Flask", "Git", "APIs"],
    missingSkills: ["Docker basics"],
  },
  {
    id: "job-2",
    title: "Full-Stack Intern (React/Python)",
    company: "InsightWorks",
    location: "Tallahassee, FL",
    type: "Full-time",
    matchPercent: 78,
    matchedSkills: ["React", "Python", "REST"],
    missingSkills: ["Advanced SQL (joins/Indexes)"],
  },
  {
    id: "job-3",
    title: "Data Engineering Intern (Jr.)",
    company: "BrightWeb",
    location: "Atlanta, GA",
    type: "Full-time",
    matchPercent: 65,
    matchedSkills: ["Python", "AWS (S3)"],
    missingSkills: ["SQL pipelines", "Pandas"],
  },
];

const SAVED_KEY = "savedJobs";
const APPLIED_KEY = "appliedJobs";

function readLs(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function writeLs(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function useSavedApplied() {
  const [saved, setSaved] = useState(() => readLs(SAVED_KEY));
  const [applied, setApplied] = useState(() => readLs(APPLIED_KEY));

  // keep state and localStorage in sync
  useEffect(() => {
    writeLs(SAVED_KEY, saved);
  }, [saved]);
  useEffect(() => {
    writeLs(APPLIED_KEY, applied);
  }, [applied]);

  const saveJob = (job) => {
    setSaved((prev) =>
      prev.some((j) => j.id === job.id) ? prev : [...prev, job],
    );
  };
  const unsaveJob = (jobId) =>
    setSaved((prev) => prev.filter((j) => j.id !== jobId));

  const applyJob = (job) => {
    setApplied((prev) =>
      prev.some((j) => j.id === job.id) ? prev : [...prev, job],
    );
    // Optionally also mark as saved
    setSaved((prev) =>
      prev.some((j) => j.id === job.id) ? prev : [...prev, job],
    );
  };

  return { saved, applied, saveJob, unsaveJob, applyJob };
}

function JobRecommendations({ user }) {
  const { saved, applied, saveJob, unsaveJob, applyJob } = useSavedApplied();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.userId) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError("");
        const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
        const resp = await fetch(`${base}/api/jobs/my?userId=${encodeURIComponent(user.userId)}`);
        const data = await resp.json();
        if (!mounted) return;
        const list = Array.isArray(data.matches) ? data.matches : [];
        // Normalize into UI jobs
        const mapped = list.map((m, idx) => ({
          id: `match-${idx}-${(m.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          title: m.title,
          company: "", // unknown for matches
          location: "",
          type: "",
          matchPercent: m.score ?? 0,
          matchedSkills: [],
          missingSkills: [],
        }));
        setItems(mapped);
      } catch (e) {
        setError(e?.message || "Failed to load");
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [user?.userId]);

  if (!user?.userId) {
    return (
      <div className="alert alert-warning">
        Please log in to see your personalized job matches.
      </div>
    );
  }

  if (loading) return <div className="text-muted">Loading recommendations…</div>;
  if (error) return <div className="alert alert-warning py-2">{error}</div>;

  if (!items.length) {
    return (
      <div className="alert alert-info">
        No job matches yet. Go to <a href="#/jobs">Job Matches</a> and generate results.
      </div>
    );
  }

  return (
    <div className="vstack gap-3">
      {items.slice(0, 5).map((job) => {
        const isSaved = saved.some((j) => j.id === job.id);
        const isApplied = applied.some((j) => j.id === job.id);
        return (
          <div key={job.id} className="job-card job-card-orange shadow-sm">
            <div className="d-flex align-items-center">
              <div className="match-badge me-3">
                <span>{job.matchPercent}%</span>
              </div>
              <div className="flex-grow-1">
                <div className="job-title fw-bold">{job.title}</div>
                <div className="job-sub text-white-50 small">
                  {job.company || "Recommended role"}
                </div>
              </div>
              <div className="d-flex flex-column flex-sm-row gap-2 ms-3">
                {isSaved ? (
                  <button
                    className="btn btn-light btn-sm"
                    onClick={() => unsaveJob(job.id)}
                  >
                    Unsave
                  </button>
                ) : (
                  <button
                    className="btn btn-outline-light btn-sm"
                    onClick={() => saveJob(job)}
                  >
                    Save
                  </button>
                )}
                <button
                  className={`btn btn-sm ${isApplied ? "btn-dark" : "btn-success"}`}
                  onClick={() => applyJob(job)}
                  disabled={isApplied}
                  title={isApplied ? "Already applied" : "Mark as applied"}
                >
                  {isApplied ? "Applied" : "Apply"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SavedSneakPeek() {
  const [saved, setSaved] = useState(() => readLs(SAVED_KEY));

  // listen for changes from other components/pages
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SAVED_KEY) setSaved(readLs(SAVED_KEY));
    };
    window.addEventListener("storage", onStorage);
    // also a quick polling fallback for same-tab updates
    const t = setInterval(() => setSaved(readLs(SAVED_KEY)), 500);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, []);

  if (!saved.length) {
    return <small className="text-muted">No saved jobs yet.</small>;
  }

  const preview = saved.slice(0, 3);

  return (
    <ul className="list-unstyled mb-0">
      {preview.map((job) => (
        <li key={job.id} className="mb-2">
          <div className="fw-semibold small">{job.title}</div>
          <div className="text-muted small">{job.company}</div>
        </li>
      ))}
      {saved.length > 3 && (
        <small className="text-muted">+{saved.length - 3} more saved…</small>
      )}
    </ul>
  );
}


function JobMatchesSneakPeek({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        if (!user?.userId) {
          setItems([]);
          setLoading(false);
          return;
        }
        const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
        const resp = await fetch(`${base}/api/jobs/my?userId=${encodeURIComponent(user.userId)}`);
        const data = await resp.json();
        if (!isMounted) return;
        const list = Array.isArray(data.matches) ? data.matches : [];
        setItems(
          list
            .slice()
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 3),
        );
      } catch (e) {
        if (isMounted) setItems([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [user?.userId]);

  if (loading) return <small className="text-muted">Loading…</small>;
  if (!items.length)
    return <small className="text-muted">No job matches yet.</small>;

  return (
    <ul className="list-unstyled mb-0">
      {items.map((m, i) => (
        <li key={`${i}-${m.title}`} className="mb-2">
          <div className="fw-semibold small">
            {m.title} <span className="text-success ms-1">{m.score ?? 0}%</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
