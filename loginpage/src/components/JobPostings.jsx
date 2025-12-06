import { useEffect, useMemo, useRef, useState } from "react";

// Job Postings page styled to look like src/jobposting.html (minus spelling mistakes),
// while keeping dynamic data, Save, and Apply behaviors.
export default function JobPostings({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Debounce timer for lazy external fetch (to avoid consuming tokens on every quick change)
  const FETCH_DELAY_MS = 2000; // 2 seconds
  const debounceRef = useRef(null);

  // sidebar filter state (updated)
  // Keep: Work type (placeholder for now)
  const [worktype, setWorktype] = useState(""); // not available from API yet
  // New: Time Posted (days) and Custom filters dropdown
  const [timeDays, setTimeDays] = useState(7);
  const [customOpen, setCustomOpen] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [easyApplyOnly, setEasyApplyOnly] = useState(false);
  const [statuses, setStatuses] = useState(() => new Set()); // employment_statuses_or
  const [props, setProps] = useState(() => new Set()); // property_exists_or
  // Toggle for blurred preview mode (TheirStack free preview). Default ON.
  const [blurPreview, setBlurPreview] = useState(true);
  // General extra filters (no location field available)
  const [keywords, setKeywords] = useState(""); // maps to job_title_or (comma-separated)
  // Removed Minimum Salary filter per request

  const [openMore, setOpenMore] = useState(() => new Set()); // open/closed more-info per job id

  const userId = user?.userId || "";
  const useExternal = String(import.meta.env.VITE_USE_THEIRSTACK || "").toLowerCase() === "true";

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
      let url;
      if (useExternal) {
        // Call our TheirStack proxy again (no limit:1). Build query from current filters
        const q = new URLSearchParams();
        if (userId) q.set("userId", userId);
        q.set("country", "US");
        q.set("days", String(timeDays || 7));
        q.set("blur", blurPreview ? "true" : "false");
        const kw = (keywords || "").trim().split(/\s*,\s*/).filter(Boolean).join(",");
        if (kw) q.set("keywords", kw);
        if (remoteOnly) q.set("remote", "true");
        if (easyApplyOnly) q.set("easy_apply", "true");
        // statuses is a Set; convert to CSV if any selected
        const statusesArr = Array.from(statuses || []);
        if (statusesArr.length) q.set("statuses", statusesArr.join(","));
        // props is a Set of property_exists_or values; convert to CSV if any selected
        const propList = Array.from(props || []);
        if (propList.length) q.set("props", propList.join(","));
        url = `${base}/api/theirstack/jobs/search?${q.toString()}`;
      } else {
        const params = userId ? `?userId=${encodeURIComponent(userId)}` : "";
        url = `${base}/api/job-postings${params}`;
      }
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const arr = Array.isArray(data.items) ? data.items : [];
      setItems(arr);
    } catch (e) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Clear any pending debounce when dependencies change
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const run = async () => {
      if (useExternal) {
        // Lazy/debounced fetch to avoid burning tokens while the user is adjusting filters
        setLoading(true);
        debounceRef.current = setTimeout(() => {
          fetchItems();
          debounceRef.current = null;
        }, FETCH_DELAY_MS);
      } else {
        // Local mode: seed immediately (does not consume external tokens) and fetch
        try {
          const base = import.meta.env.VITE_API_BASE || "http://localhost:5002";
          await fetch(`${base}/api/job-postings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seed: true }),
          });
        } catch (e) {
          console.info("Job seeding may have been skipped if data already exists.");
        }
        fetchItems();
      }
    };
    run();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [
    userId,
    useExternal,
    timeDays,
    remoteOnly,
    easyApplyOnly,
    statuses,
    props,
    blurPreview,
    keywords,
  ]);

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

  // Placeholder: companies list no longer shown in filters, but keep for potential future use
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
    const anyScore = list.some((j) => typeof j.matchPercent === "number" && j.matchPercent > 0);
    // location/worktype are placeholders until backend provides fields
    if (worktype) list = list.filter(() => false);

    return list.sort((a, b) => {
      if (anyScore) {
        const ms = (b.matchPercent || 0) - (a.matchPercent || 0);
        if (ms !== 0) return ms;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, worktype]);

  // Display all positions (remove previous Top 3 limitation)

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

          {/* Preview mode toggle (blur company/job identifiers) */}
          <div style={styles.filterGroup}>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="blurPreview"
                checked={blurPreview}
                onChange={(e) => setBlurPreview(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="blurPreview">
                Preview mode (blur company data)
              </label>
            </div>
            <small className="text-muted">When enabled, data is blurred and doesn’t consume credits.</small>
          </div>

          {/* Time Posted */}
          <div style={styles.filterGroup}>
            <label htmlFor="timePosted" style={styles.label}>
              Time Posted
            </label>
            <select
              id="timePosted"
              style={styles.select}
              value={String(timeDays)}
              onChange={(e) => setTimeDays(parseInt(e.target.value, 10) || 7)}
            >
              <option value="1">Past 24 hours</option>
              <option value="3">Past 3 days</option>
              <option value="7">Past week</option>
              <option value="14">Past 2 weeks</option>
              <option value="30">Past month</option>
            </select>
          </div>

          {/* Percent Match slider removed per request */}

          {/* General: Keywords (Title contains) */}
          <div style={styles.filterGroup}>
            <label htmlFor="keywords" style={styles.label}>
              Keywords (title contains)
            </label>
            <input
              id="keywords"
              type="text"
              className="form-control"
              placeholder="e.g. intern, python, analyst"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
            <small className="text-muted">Comma-separated. Matches any of the words.</small>
          </div>

          {/* Minimum Salary filter removed per request */}

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

          {/* Custom filters (dropdown with checkboxes) */}
          <div style={styles.filterGroup}>
            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              onClick={() => setCustomOpen((v) => !v)}
              aria-expanded={customOpen}
            >
              Custom Filters ▾
            </button>
            {customOpen && (
              <div className="border rounded p-2 mt-2 bg-white" style={{ maxHeight: 240, overflowY: "auto" }}>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="remoteOnly"
                    checked={remoteOnly}
                    onChange={(e) => setRemoteOnly(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="remoteOnly">Remote only</label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="easyApplyOnly"
                    checked={easyApplyOnly}
                    onChange={(e) => setEasyApplyOnly(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="easyApplyOnly">Easy apply only</label>
                </div>

                <hr className="my-2" />
                <div className="mb-1 fw-semibold" style={{ fontSize: 13 }}>Employment Status</div>
                {[
                  ["full_time", "Full-time"],
                  ["part_time", "Part-time"],
                  ["temporary", "Temporary"],
                  ["internship", "Internship"],
                  ["contract", "Contract"],
                ].map(([val, label]) => (
                  <div className="form-check" key={val}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`status-${val}`}
                      checked={statuses.has(val)}
                      onChange={(e) =>
                        setStatuses((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(val);
                          else next.delete(val);
                          return next;
                        })
                      }
                    />
                    <label className="form-check-label" htmlFor={`status-${val}`}>{label}</label>
                  </div>
                ))}

                <hr className="my-2" />
                <div className="mb-1 fw-semibold" style={{ fontSize: 13 }}>Has Property</div>
                {[
                  ["final_url", "Final URL"],
                  ["company_object.domain", "Company Domain"],
                  ["company_object.linkedin_url", "Company LinkedIn"],
                  ["hiring_team", "Hiring Team"],
                  ["employment_statuses", "Employment Statuses"],
                ].map(([val, label]) => (
                  <div className="form-check" key={val}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`prop-${val}`}
                      checked={props.has(val)}
                      onChange={(e) =>
                        setProps((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(val);
                          else next.delete(val);
                          return next;
                        })
                      }
                    />
                    <label className="form-check-label" htmlFor={`prop-${val}`}>{label}</label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            style={styles.filterBtn}
            onClick={() => {
              // Apply by re-fetching when using external API; otherwise client filters only
              fetchItems();
            }}
            title="Filters apply instantly"
          >
            Apply Filters
          </button>
        </aside>

        {/* Listings */}
        <section style={styles.listings}>
          {/* Jobs found indicator + lazy-fetch hint */}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="text-muted">
              {loading ? "Searching…" : `${filteredSorted.length} jobs found`}
            </div>
            {useExternal && loading && (
              <small className="text-muted">Waiting 2s before fetching…</small>
            )}
          </div>

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

                  <div style={styles.title}>{job.title}</div>
                  <div style={styles.company}>{job.company}</div>
                  <div style={styles.details}>
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </div>

                  <div className="d-flex flex-column flex-sm-row gap-2">
                    {job.applyUrl ? (
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.applyBtn}
                        title="Open application link in new tab"
                      >
                        Apply Externally
                      </a>
                    ) : (
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
                    )}
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
