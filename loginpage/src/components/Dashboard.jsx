import { useEffect, useState } from "react";

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

  return (
    <div className="container mt-2 mb-4">
      <div className="row g-4 align-items-start">
        {/* Main Section */}
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body p-4">
                <div className="text-center mb-3">
                <h2 className="mb-3" style={{ fontFamily: '"Limelight", serif' }}>
                  Dashboard
                </h2>
                <p className="text-muted">Welcome{user?.email ? `, ${user.email}` : ""}!</p>

                {user?.createdAt && (
                  <p className="mb-0">
                    <strong>Account created:</strong> {new Date(user.createdAt).toLocaleString()}
                  </p>
                )}
                {user?.questionnaireCompleted ? (
                  <p className="text-success mt-2">Questionnaire completed. Thank you!</p>
                ) : (
                  <p className="text-warning mt-2">Questionnaire not completed yet.</p>
                )}
              </div>

              {/* Job Recommendations */}
              <hr className="my-4" />
              <h5 className="mb-3">Position Recommendations</h5>
              <JobRecommendations user={user} />
            </div>
          </div>
        </div>

        {/* Sidebar with Sneak Peek */}
        <div className="col-12 col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="mb-2">Sneak Peek: Saved Jobs</h5>
              <SavedSneakPeek />
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

/* ---------- Local helpers: mock jobs + save using localStorage ---------- */

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

function useSaved() {
  const [saved, setSaved] = useState(() => readLs(SAVED_KEY));

  useEffect(() => {
    writeLs(SAVED_KEY, saved);
  }, [saved]);

  const saveJob = (job) => {
    setSaved((prev) => (prev.some((j) => j.id === job.id) ? prev : [...prev, job]));
  };

  const unsaveJob = (jobId) => setSaved((prev) => prev.filter((j) => j.id !== jobId));

  return { saved, saveJob, unsaveJob };
}

function JobRecommendations({ user }) {
  const { saved, saveJob, unsaveJob } = useSaved();
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
        const mapped = list.map((m, idx) => ({
          id: `match-${idx}-${(m.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          title: m.title || "Untitled Position",
          company:
            m.company ||
            ["CloudCore Systems", "NextGen Labs", "SkyTech AI", "BrightWeb Analytics", "TechNova"][
              idx % 5
            ],
          location:
            m.location ||
            ["New York, NY", "Atlanta, GA", "Tallahassee, FL", "Remote", "Austin, TX"][idx % 5],
          type: m.type || ["Full-Time", "Internship", "Part-Time", "Hybrid", "Contract"][idx % 5],
          matchPercent: m.score ?? 0,
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
      <div className="alert alert-warning">Please log in to see your personalized job matches.</div>
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
        return (
          <div key={job.id} className="job-card job-card-orange shadow-sm">
            <div className="d-flex align-items-center">
              <div className="match-badge me-3" style={{ "--score": job.matchPercent }}>
                <span>{job.matchPercent}%</span>
              </div>
              <div className="flex-grow-1">
                <div className="job-title fw-bold">{job.title}</div>
                <div className="text-white-50 small">
                  {job.company} • {job.location} • {job.type}
                </div>
              </div>
              <div className="d-flex flex-column flex-sm-row gap-2 ms-3">
                {isSaved ? (
                  <button className="btn btn-light btn-sm" onClick={() => unsaveJob(job.id)}>
                    Unsave
                  </button>
                ) : (
                  <button className="btn btn-outline-light btn-sm" onClick={() => saveJob(job)}>
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Sneak Peek Sidebar ---------- */
function SavedSneakPeek() {
  const [saved, setSaved] = useState(() => readLs(SAVED_KEY));

  useEffect(() => {
    const sync = () => setSaved(readLs(SAVED_KEY));
    window.addEventListener("storage", sync);
    const interval = setInterval(sync, 500);
    return () => {
      window.removeEventListener("storage", sync);
      clearInterval(interval);
    };
  }, []);

  if (!saved.length) {
    return <small className="text-muted">No saved jobs yet.</small>;
  }

  const preview = saved.slice(0, 3);

  return (
    <div>
      <ul className="list-unstyled mb-2">
        {preview.map((job) => (
          <li key={job.id} className="mb-2 border-bottom pb-2">
            <div className="fw-semibold small text-dark">{job.title}</div>
            <div className="text-muted small">{job.company || "Unknown company"}</div>
          </li>
        ))}
      </ul>
      {saved.length > 3 && <small className="text-muted">+{saved.length - 3} more saved…</small>}
      <div className="d-grid mt-3">
        <button
          className="btn btn-outline-primary btn-sm"
          onClick={() => (window.location.hash = "#/save")}
        >
          View All Saved
        </button>
      </div>
    </div>
  );
}
