import { useEffect, useMemo, useState } from "react";

// Job Postings page styled to look like src/jobposting.html (minus spelling mistakes),
// while keeping dynamic data, Save, and Apply behaviors.
export default function JobPostings({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [useMock, setUseMock] = useState(() => {
    try {
      const v = localStorage.getItem("jobPostingsUseMock");
      return v === "1";
    } catch {
      return false;
    }
  });

  // sidebar filter state
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState(""); // not available from API yet
  const [worktype, setWorktype] = useState(""); // not available from API yet

  const [openMore, setOpenMore] = useState(() => new Set()); // open/closed more-info per job id

  const userId = user?.userId || "";

  function useIsNarrow(bp = 992) {
    const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : bp + 1));
    useEffect(() => {
      const on = () => setW(window.innerWidth);
      window.addEventListener("resize", on);
      return () => window.removeEventListener("resize", on);
    }, []);
    return w < bp;
  }

  function makeStyles(isNarrow) {
    return {
      header: {
        background: "linear-gradient(90deg, #2e7d32, #ff9800)",
        color: "white",
        padding: isNarrow ? 16 : 20,
        textAlign: "center",
      },
      h1: { margin: 0, fontSize: isNarrow ? "1.6em" : "2em" },
      main: {
        display: "flex",
        flexDirection: isNarrow ? "column" : "row",
        maxWidth: isNarrow ? "100%" : 1400,
        margin: isNarrow ? "15px auto" : "30px auto",
        padding: isNarrow ? "0 12px" : "0 20px",
        gap: isNarrow ? 12 : 20,
      },
      sidebar: {
        width: isNarrow ? "100%" : 260,
        border: "2px solid #2e7d32",
        borderRadius: 6,
        padding: isNarrow ? 12 : 20,
        backgroundColor: "#fafafa",
        height: "fit-content",
      },
      sidebarH2: { fontSize: "1.2em", marginTop: 0, marginBottom: 10, color: "#2e7d32" },
      filterGroup: { marginBottom: 20 },
      label: { display: "block", marginBottom: 5, fontWeight: "bold" },
      select: { width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 },
      filterBtn: {
        width: "100%",
        padding: 10,
        backgroundColor: "#ff9800",
        color: "white",
        border: "none",
        fontWeight: "bold",
        borderRadius: 4,
        cursor: "pointer",
      },
      listings: { flexGrow: 1 },
      card: {
        position: "relative",
        border: "2px solid #2e7d32",
        borderLeft: "10px solid #ff9800",
        borderRadius: 6,
        padding: isNarrow ? 14 : 20,
        marginBottom: 16,
        backgroundColor: "#fafafa",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      },
      title: { fontSize: isNarrow ? "1.1em" : "1.3em", color: "#2e7d32", marginBottom: 5 },
      company: { fontWeight: "bold", marginBottom: 10, color: "#ff9800" },
      details: { marginBottom: 10, fontSize: "0.95em" },
      applyBtn: {
        display: "inline-block",
        padding: "10px 15px",
        backgroundColor: "#2e7d32",
        color: "white",
        textDecoration: "none",
        fontWeight: "bold",
        borderRadius: 4,
        transition: "background-color 0.2s ease",
        border: "none",
      },
      applyBtnDisabled: {
        backgroundColor: "#4d6b4f",
        cursor: "not-allowed",
      },
      moreBtn: {
        position: "absolute",
        top: 10,
        right: 15,
        fontSize: 20,
        cursor: "pointer",
        color: "#555",
        background: "transparent",
        border: "none",
      },
      moreInfo: {
        marginTop: 10,
        padding: 10,
        backgroundColor: "#f0f0f0",
        borderLeft: "3px solid #2e7d32",
        borderRadius: 4,
        fontSize: "0.9em",
      },
      matchPill: {
        position: "absolute",
        top: 12,
        left: 12,
        background: "#2e7d32",
        color: "white",
        borderRadius: 20,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 700,
      },
    };
  }

  const isNarrow = useIsNarrow(992);
  const styles = makeStyles(isNarrow);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError("");
      const base = import.meta.env.VITE_API_BASE || "http://localhost:5002";
      const sp = new URLSearchParams();
      if (userId) sp.set("userId", userId);
      if (useMock) sp.set("forceMock", "1");
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      const resp = await fetch(`${base}/api/job-postings${qs}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const list = Array.isArray(data.items) ? data.items : [];
      // If backend returned empty list, try mock fallback (Gemini-backed or stub)
      if (list.length === 0) {
        const mresp = await fetch(`${base}/api/job-postings/mocks${qs}`);
        if (mresp.ok) {
          const mdata = await mresp.json();
          setItems(Array.isArray(mdata.items) ? mdata.items : []);
        } else {
          setItems(list);
        }
      } else {
        setItems(list);
      }
    } catch (e) {
      // On failure, attempt to load mock postings
      try {
        const base = import.meta.env.VITE_API_BASE || "http://localhost:5002";
        const sp = new URLSearchParams();
        if (userId) sp.set("userId", userId);
        // Even on error, honor the toggle for forcing mocks
        if (useMock) sp.set("forceMock", "1");
        const qs = sp.toString() ? `?${sp.toString()}` : "";
        const mresp = await fetch(`${base}/api/job-postings/mocks${qs}`);
        if (mresp.ok) {
          const mdata = await mresp.json();
          setItems(Array.isArray(mdata.items) ? mdata.items : []);
          setError("");
        } else {
          setError(e?.message || "Failed to load");
        }
      } catch (e2) {
        setError(e?.message || "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch server config to initialize toggle if not explicitly set
    (async () => {
      try {
        const base = import.meta.env.VITE_API_BASE || "http://localhost:5002";
        const resp = await fetch(`${base}/api/config`);
        if (resp.ok) {
          const cfg = await resp.json();
          // Only update if user hasn't chosen explicitly before
          const hasLocal = localStorage.getItem("jobPostingsUseMock");
          if (hasLocal == null && cfg && typeof cfg.jobPostingsForceMock === "boolean") {
            setUseMock(Boolean(cfg.jobPostingsForceMock));
          }
        }
      } catch {}
    })();

    const seedThenFetch = async () => {
      // Seed sample postings if the database is empty.
      // This is done first to avoid a race condition where items are fetched before seeding is complete.
      try {
        const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
        await fetch(`${base}/api/job-postings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seed: true }),
        });
      } catch (e) {
        // It's okay if this fails (e.g., jobs already exist).
        console.info("Job seeding may have been skipped if data already exists.");
      }
      // Now, fetch the items.
      fetchItems();
    };

    seedThenFetch();
  }, [userId, useMock]);

  // infer a coarse "role" from title
  function inferRole(title) {
    const t = String(title || "").toLowerCase();
    if (t.includes("data")) return "data";
    if (t.includes("cyber")) return "cyber";
    if (t.includes("security")) return "cyber";
    if (t.includes("web")) return "web";
    if (t.includes("front")) return "web";
    if (t.includes("ai") || t.includes("machine") || t.includes("ml")) return "ai";
    return "software"; // default bucket
  }

  const companies = useMemo(() => {
    const set = new Set(items.map((i) => i.company).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  // local save/unsave using localStorage to integrate with Save page
  const SAVED_KEY = "savedJobs";
  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    } catch {
      return [];
    }
  }
  const [saved, setSaved] = useState(() => readSaved());
  useEffect(() => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }, [saved]);

  const toggleSave = (job) => {
    setSaved((prev) => {
      const exists = prev.some((j) => j.id === job.id);
      if (exists) return prev.filter((j) => j.id !== job.id);
      return [
        ...prev,
        {
          id: job.id,
          title: job.title,
          company: job.company,
          location: "",
          type: "",
          matchPercent: job.matchPercent ?? null,
        },
      ];
    });
  };
  const isSaved = (id) => saved.some((j) => j.id === id);

  const handleApply = async (id) => {
    try {
      const base = import.meta.env.VITE_API_BASE || "http://localhost:5002";
      const resp = await fetch(`${base}/api/job-postings/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!resp.ok) throw new Error("Apply failed");
      await fetchItems();
    } catch (e) {
      alert(e?.message || "Failed to apply");
    }
  };

  // Apply filters and sorting (match desc then newest)
  const filteredSorted = useMemo(() => {
    let list = [...items];
    if (role) list = list.filter((j) => inferRole(j.title) === role);
    if (company) list = list.filter((j) => j.company === company);
    // location/worktype are placeholders until backend provides fields
    if (location) list = list.filter(() => false); // no matches if a specific location chosen
    if (worktype) list = list.filter(() => false);

    return list.sort((a, b) => {
      const ms = (b.matchPercent || 0) - (a.matchPercent || 0);
      if (ms !== 0) return ms;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, role, company, location, worktype]);

  const goBack = () => (window.location.hash = "#/dashboard");
  const goSave = () => (window.location.hash = "#/save");

  const toggleMore = (id) => {
    setOpenMore((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.h1}>FAMU Career Development – Job Postings</h1>
      </div>

      {/* Top actions aligned with app navigation */}
      <div className="container mt-3 d-flex justify-content-between align-items-center">
        <p className="text-muted mb-0">Browse postings ranked by your match percentage.</p>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={goBack}>
            Back to Dashboard
          </button>
          <button className="btn btn-primary btn-sm" onClick={goSave}>
            Go to Save
          </button>
        </div>
      </div>

      {/* Main layout: sidebar + list */}
      <div style={styles.main}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <h2 style={styles.sidebarH2}>Filter Jobs</h2>

          <div className="form-check form-switch mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="toggleUseMock"
              checked={useMock}
              onChange={(e) => {
                const v = e.target.checked;
                setUseMock(v);
                try {
                  localStorage.setItem("jobPostingsUseMock", v ? "1" : "0");
                } catch {}
                // Refetch with new preference
                fetchItems();
              }}
            />
            <label className="form-check-label" htmlFor="toggleUseMock">
              Use mock postings (override external API)
            </label>
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="role" style={styles.label}>
              Role
            </label>
            <select
              id="role"
              style={styles.select}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">All</option>
              <option value="software">Software Development</option>
              <option value="data">Data Science</option>
              <option value="cyber">Cybersecurity</option>
              <option value="web">Web Development</option>
              <option value="ai">AI / Research</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="company" style={styles.label}>
              Company
            </label>
            <select
              id="company"
              style={styles.select}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              <option value="">All</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="location" style={styles.label}>
              Location
            </label>
            <select
              id="location"
              style={styles.select}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">All</option>
              {/* Placeholder options to match the HTML mock */}
              <option value="mountain-view">Mountain View, CA</option>
              <option value="redmond">Redmond, WA</option>
              <option value="seattle">Seattle, WA</option>
              <option value="armonk">Armonk, NY</option>
              <option value="menlo-park">Menlo Park, CA</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label htmlFor="worktype" style={styles.label}>
              Work Type
            </label>
            <select
              id="worktype"
              style={styles.select}
              value={worktype}
              onChange={(e) => setWorktype(e.target.value)}
            >
              <option value="">All</option>
              <option value="onsite">Onsite</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>

          <button
            type="button"
            style={styles.filterBtn}
            onClick={() => {
              // no-op: filters apply immediately via state
            }}
            title="Filters apply instantly"
          >
            Apply Filters
          </button>
        </aside>

        {/* Listings */}
        <section style={styles.listings}>
          {loading && <div className="text-muted">Loading…</div>}
          {error && <div className="alert alert-warning py-2">Failed to load: {error}</div>}

          {!loading && !error && filteredSorted.length === 0 && (
            <div className="text-muted">No postings available.</div>
          )}

          {!loading &&
            !error &&
            filteredSorted.map((job) => {
              const applied = !!job.appliedAt;
              const opened = openMore.has(job.id);
              return (
                <div
                  key={job.id}
                  style={styles.card}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)";
                    e.currentTarget.style.boxShadow = "0 6px 15px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <span style={styles.matchPill}>{job.matchPercent ?? 0}% match</span>

                  <button
                    type="button"
                    style={styles.moreBtn}
                    onClick={() => toggleMore(job.id)}
                    aria-label="More information"
                    title="More information"
                  >
                    ⋮
                  </button>

                  <div style={styles.title}>
                    {job.title}
                    {job.mock && (
                      <span className="badge bg-warning text-dark ms-2" title="AI-generated mock listing">
                        AI-generated
                      </span>
                    )}
                  </div>
                  <div style={styles.company}>{job.company}</div>
                  <div style={styles.details}>
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </div>

                  <div className="d-flex flex-column flex-sm-row gap-2">
                    <button
                      style={{
                        ...styles.applyBtn,
                        ...(applied || !userId ? styles.applyBtnDisabled : {}),
                      }}
                      onClick={() => handleApply(job.id)}
                      disabled={applied || !userId}
                      title={!userId ? "Login required" : applied ? "Already applied" : "Apply"}
                    >
                      {applied ? "Applied" : "Apply Now"}
                    </button>
                    <button
                      className={`btn btn-sm ${isSaved(job.id) ? "btn-outline-secondary" : "btn-outline-dark"}`}
                      onClick={() => toggleSave(job)}
                    >
                      {isSaved(job.id) ? "Unsave" : "Save"}
                    </button>
                  </div>

                  {opened && (
                    <div style={styles.moreInfo}>
                      <p>
                        <strong>Match:</strong> {job.matchPercent ?? 0}%
                      </p>
                      {job.major && (
                        <p>
                          <strong>Major:</strong> {job.major}
                        </p>
                      )}
                      {job.summary && (
                        <p>
                          <strong>Summary:</strong> {job.summary}
                        </p>
                      )}
                      {job.applyUrl && (
                        <p>
                          <a href={job.applyUrl} target="_blank" rel="noreferrer" className="link-success">
                            Apply link
                          </a>
                        </p>
                      )}
                      <p>
                        <strong>Applied:</strong>{" "}
                        {applied ? new Date(job.appliedAt).toLocaleString() : "Not yet"}
                      </p>
                      <p className="mb-0 text-muted">
                        This is a simplified preview. More fields (location, work type,
                        responsibilities, requirements) will appear as the backend evolves.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
        </section>
      </div>
    </div>
  );
}
