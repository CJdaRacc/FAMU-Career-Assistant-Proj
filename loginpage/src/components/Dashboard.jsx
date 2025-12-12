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
      {/* Local style to shift the "Your Profile" card 2 inches left on large screens */}
      <style>{`
        @media (min-width: 992px) {
          .profile-card-shift {
            margin-left: -4in !important;
          }
        }
      `}</style>
      <div className="row g-4 align-items-start">
        {/* Left column: Profile card */}
        <div className="col-12 col-lg-4 profile-card-shift">
          <div className="mb-4">
            <ProfileCard user={user} />
          </div>

          {/* Sneak Peek: Saved Jobs moved under Profile card */}
          <div className="mb-4">
            <div className="card shadow-sm">
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

        {/* Right column: Dashboard content */}
        <div className="col-12 col-lg-8">
          <div className="row g-4">
            {/* Main dashboard content now spans full width of this column */}
            <div className="col-12">
              <div className="card shadow-sm h-100" style={{ minHeight: "10in", width: "calc(100% + 5in)" }}>
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

// Options sourced from Profile tab (Quiz.jsx)
const FIELD_INTERESTS = {
  "Computer Science & Engineering": [
    "Software Engineering",
    "Cybersecurity",
    "AI/ML",
    "Data/Analytics",
    "DevOps",
    "Other",
  ],
  "Business & Management": [
    "Product Management",
    "Marketing/Sales",
    "Operations",
    "Finance/Accounting",
    "Entrepreneurship",
    "Other",
  ],
  "Design & Media": [
    "Design/UX",
    "UI Design",
    "Graphic Design",
    "Product Design",
    "Content Strategy",
    "Other",
  ],
  "Health & Life Sciences": [
    "Bioinformatics",
    "Public Health",
    "Healthcare IT",
    "Medical Devices",
    "Other",
  ],
  "Natural Sciences": ["Environmental Science", "Chemistry", "Physics", "Biology", "Other"],
};

function ProfileCard({ user }) {
  const [profile, setProfile] = useState({ major: "", classYear: "", college: "", interests: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  // Edit form state (dropdowns)
  const [selectedFields, setSelectedFields] = useState([]); // majors (multi)
  const [fieldSelections, setFieldSelections] = useState({}); // interests per field
  const [otherText, setOtherText] = useState("");
  const [classYear, setClassYear] = useState("");
  const [college, setCollege] = useState("");
  const [saving, setSaving] = useState(false);
  const hasUser = Boolean(user?.userId);

  const fieldNames = Object.keys(FIELD_INTERESTS);
  const years = (() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(now + i));
  })();

  useEffect(() => {
    let active = true;
    async function load() {
      if (!hasUser) return;
      setLoading(true);
      setError("");
      try {
        const apiBase = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/g, "");
        const resp = await fetch(`${apiBase}/api/profile?userId=${encodeURIComponent(user.userId)}`);
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`Failed to load profile: ${resp.status} ${resp.statusText}${text ? ` - ${text}` : ""}`);
        }
        const data = await resp.json();
        const p = data?.profile || {};
        if (!active) return;
        const next = {
          major: p.major || "",
          classYear: p.classYear || "",
          college: p.college || "",
          interests: Array.isArray(p.interests) ? p.interests : [],
        };
        setProfile(next);
        if (!editing) {
          // Seed edit form from profile snapshot
          const seededFields = (next.major || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const seededSelections = {};
          (next.interests || []).forEach((intr) => {
            // Map each interest to the first matching field that contains it
            const field = fieldNames.find((f) => FIELD_INTERESTS[f].includes(intr));
            if (field) {
              if (!seededSelections[field]) seededSelections[field] = [];
              if (!seededSelections[field].includes(intr)) seededSelections[field].push(intr);
            }
          });
          setSelectedFields(seededFields);
          setFieldSelections(seededSelections);
          setClassYear(next.classYear || "");
          setCollege(next.college || "");
          setOtherText("");
        }
      } catch (e) {
        if (active) setError(e?.message || "Failed to load profile");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [hasUser, user?.userId]);

  const startEdit = () => {
    // Ensure edit form seeded with latest profile
    const seededFields = (profile.major || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const seededSelections = {};
    (profile.interests || []).forEach((intr) => {
      const field = fieldNames.find((f) => FIELD_INTERESTS[f].includes(intr));
      if (field) {
        if (!seededSelections[field]) seededSelections[field] = [];
        if (!seededSelections[field].includes(intr)) seededSelections[field].push(intr);
      }
    });
    setSelectedFields(seededFields);
    setFieldSelections(seededSelections);
    setClassYear(profile.classYear || "");
    setCollege(profile.college || "");
    setOtherText("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleMajorChange = (e) => {
    const values = Array.from(e.target.selectedOptions || []).map((o) => o.value);
    // prune interests for any deselected fields
    setFieldSelections((old) => {
      const next = { ...old };
      Object.keys(next).forEach((f) => {
        if (!values.includes(f)) delete next[f];
      });
      return next;
    });
    setSelectedFields(values);
  };

  const handleFieldInterestChange = (field, e) => {
    const values = Array.from(e.target.selectedOptions || []).map((o) => o.value);
    setFieldSelections((prev) => ({ ...prev, [field]: values }));
  };

  const onSave = async () => {
    // Build payload as in Profile tab
    if (selectedFields.length === 0) {
      setError("Please select at least one major");
      return;
    }
    if (classYear && !/^\d{4}$/.test(classYear)) {
      setError("Graduation year must be a 4-digit year");
      return;
    }
    const preset = Object.values(fieldSelections)
      .flat()
      .filter((i) => i && i !== "Other");
    const custom = otherText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const finalInterests = Array.from(new Set([...preset, ...custom]));

    const payload = {
      userId: user?.userId,
      major: selectedFields.join(", "),
      interests: finalInterests,
      classYear: String(classYear || "").trim(),
      college: String(college || "").trim(),
    };

    setSaving(true);
    setError("");
    try {
      const apiBase = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/g, "");
      const resp = await fetch(`${apiBase}/api/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Failed to save: ${resp.status} ${resp.statusText}${text ? ` - ${text}` : ""}`);
      }
      const data = await resp.json();
      const p = data?.profile || payload;
      setProfile({
        major: p.major || payload.major,
        classYear: p.classYear || payload.classYear,
        college: p.college || payload.college,
        interests: Array.isArray(p.interests) ? p.interests : payload.interests,
      });
      setEditing(false);
    } catch (e) {
      setError(e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h5 className="mb-3">Your Profile</h5>
        {!hasUser && <div className="alert alert-warning">Please log in to see your profile.</div>}
        {hasUser && (
          <>
            {error && (
              <div className="alert alert-danger py-2 mb-3" role="alert">
                {error}
              </div>
            )}
            {!editing ? (
              <div>
                {loading ? (
                  <div className="text-muted">Loading…</div>
                ) : (
                  <>
                    <p className="mb-1">
                      <strong>Major:</strong> {profile.major || <span className="text-muted">Not set</span>}
                    </p>
                    <p className="mb-1">
                      <strong>Interests:</strong>{" "}
                      {Array.isArray(profile.interests) && profile.interests.length > 0 ? (
                        profile.interests.join(", ")
                      ) : (
                        <span className="text-muted">Not set</span>
                      )}
                    </p>
                    <p className="mb-1">
                      <strong>Graduation Year:</strong>{" "}
                      {profile.classYear || <span className="text-muted">Not set</span>}
                    </p>
                    <p className="mb-3">
                      <strong>College:</strong> {profile.college || <span className="text-muted">Not set</span>}
                    </p>
                    <button className="btn btn-outline-primary btn-sm" onClick={startEdit} disabled={loading}>
                      Edit
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div>
                {/* Major(s) dropdown (multi-select) */}
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="majors">Major(s)</label>
                  <select
                    id="majors"
                    className="form-select"
                    multiple
                    size={Math.min(fieldNames.length, 8)}
                    value={selectedFields}
                    onChange={handleMajorChange}
                  >
                    {fieldNames.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    Hold Ctrl (Windows) or Command (Mac) to select multiple. Interest options will appear below for each selected field.
                  </div>
                </div>

                {/* Per-field interests dropdowns */}
                {selectedFields.map((field) => (
                  <div className="mb-3" key={`sel-${field}`}>
                    <label className="form-label fw-semibold" htmlFor={`interests-${field}`}>
                      {field} Interests
                    </label>
                    <select
                      id={`interests-${field}`}
                      className="form-select"
                      multiple
                      size={Math.min(FIELD_INTERESTS[field].length, 8)}
                      value={fieldSelections[field] || []}
                      onChange={(e) => handleFieldInterestChange(field, e)}
                    >
                      {FIELD_INTERESTS[field].map((opt) => (
                        <option key={`${field}-${opt}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">
                      Hold Ctrl (Windows) or Command (Mac) to select multiple. Choose "Other" to add custom interests.
                    </div>
                  </div>
                ))}

                {Object.values(fieldSelections).some((arr) => (arr || []).includes("Other")) && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="otherInterests">
                      Other interests (comma-separated)
                    </label>
                    <input
                      id="otherInterests"
                      type="text"
                      className="form-control"
                      placeholder="e.g., Robotics, Sports Analytics"
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                    />
                  </div>
                )}

                {/* Graduation year dropdown */}
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="gradYear">Graduation Year</label>
                  <select
                    id="gradYear"
                    className="form-select"
                    value={classYear}
                    onChange={(e) => setClassYear(e.target.value)}
                  >
                    <option value="">Select year…</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label mb-1">College</label>
                  <input
                    className="form-control"
                    name="college"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="e.g., FAMU College of Science and Technology"
                  />
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-primary" onClick={onSave} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
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
        // Default to relative "/api" so Vite dev proxy forwards to backend (5002).
        // If VITE_API_BASE is set (e.g., in production), use it as the origin.
        const base = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/g, "");
        const resp = await fetch(
          `${base}/api/jobs/my?userId=${encodeURIComponent(user.userId)}`
        );
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`Request failed: ${resp.status} ${resp.statusText}${text ? ` - ${text}` : ""}`);
        }
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
    return <small className="text-muted">no jobs saved</small>;
  }

  return (
    <div>
      {/* Wrap saved jobs as compact chips that flow to new lines */}
      <div className="d-flex flex-wrap gap-2 mb-2">
        {saved.map((job) => (
          <div
            key={job.id}
            className="border rounded px-2 py-1 bg-light"
            title={`${job.title} • ${job.company || "Unknown company"}`}
            style={{ maxWidth: "100%" }}
          >
            <div className="small text-truncate" style={{ maxWidth: "12rem" }}>
              {job.title}
            </div>
          </div>
        ))}
      </div>
      <div className="d-grid mt-2">
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
