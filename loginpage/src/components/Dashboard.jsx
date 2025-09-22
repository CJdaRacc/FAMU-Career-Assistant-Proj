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
              <MockJobs />
            </div>
          </div>
        </div>

        {/* Sidebar with Sneak Peek */}
        <div className="col-12 col-lg-4">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="mb-2">Sneak peek: Save</h5>
              <SavedSneakPeek />
              <div className="mt-auto pt-3">
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

function MockJobs() {
  const { saved, applied, saveJob, unsaveJob, applyJob } = useSavedApplied();

  const items = useMemo(() => MOCK_JOBS, []);

  return (
    <div className="vstack gap-3">
      {items.map((job) => {
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
                  {job.company} • {job.location} • {job.type}
                </div>
                <div className="job-skills mt-2 small">
                  <div>
                    <strong>Matched:</strong> {job.matchedSkills.join(", ")}
                  </div>
                  <div>
                    <strong>Missing:</strong> {job.missingSkills.join(", ")}
                  </div>
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
