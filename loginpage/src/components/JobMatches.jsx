import { useEffect, useMemo, useState } from "react";

export default function JobMatches({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [createdAt, setCreatedAt] = useState(null);
  const [profile, setProfile] = useState(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const hasUser = !!user?.userId;

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [matches]);

  const loadExisting = async () => {
    if (!hasUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/my?userId=${encodeURIComponent(user.userId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load job matches");
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      setCreatedAt(data.createdAt || null);
      setProfile(data.profileSnapshot || null);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUser]);

  // Auto-generate dynamically on first visit if no matches exist but we have a profile snapshot
  useEffect(() => {
    if (!loading && hasUser && !autoTriggered && profile && (!matches || matches.length === 0)) {
      setAutoTriggered(true);
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUser, profile, matches, loading]);

  const handleGenerate = async () => {
    if (!hasUser) {
      setError("You must be logged in to generate job matches.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to generate job matches");
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      setCreatedAt(data.createdAt || new Date().toISOString());
      setProfile(data.profileSnapshot || null);
    } catch (err) {
      // If the server indicates Gemini is not configured, surface a clearer message
      const msg =
        err?.message && /GEMINI_API_KEY|GOOGLE_API_KEY|Server not configured/i.test(err.message)
          ? "Server is not configured with a Gemini API key. Please set GEMINI_API_KEY and try again."
          : err.message || "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9">
          <div className="card shadow-sm mb-3">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1" style={{ fontFamily: '"Limelight", serif' }}>
                    Job Matches
                  </h2>
                  <p className="text-muted mb-0">
                    Personalized roles based on your profile and questionnaire.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={loading || !hasUser}
                >
                  {loading ? "Working…" : matches.length ? "Regenerate" : "Generate Matches"}
                </button>
              </div>
              {error && <div className="alert alert-danger mt-3 mb-0 py-2">{error}</div>}
            </div>
          </div>

          {/* Profile summary container */}
          <div className="card shadow-sm mb-4">
            <div className="card-body p-4">
              <h5 className="mb-3">Your Profile</h5>
              {profile ? (
                <div className="row g-3">
                  <div className="col-12 col-md-4">
                    <div className="border rounded p-2 h-100">
                      <strong>Major</strong>
                      <div>{profile.major || "—"}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="border rounded p-2 h-100">
                      <strong>Class Year</strong>
                      <div>{profile.classYear || "—"}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="border rounded p-2 h-100">
                      <strong>Interests</strong>
                      <div>
                        {(profile.interests || []).length ? profile.interests.join(", ") : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="alert alert-warning mb-0 py-2">
                  No profile snapshot found. Complete your Profile form first.
                </div>
              )}
            </div>
          </div>

          {/* Jobs bar chart */}
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h5 className="mb-3">Closest Related Jobs</h5>
              {createdAt && (
                <div className="text-muted small mb-3">
                  Generated: {new Date(createdAt).toLocaleString()}
                </div>
              )}
              {!matches.length ? (
                <div className="alert alert-info mb-0 py-2">
                  No matches yet. Click Generate Matches to get recommendations.
                </div>
              ) : (
                <div className="vstack gap-3">
                  {sortedMatches.map((m, idx) => (
                    <div key={idx} className="border rounded p-3">
                      <div className="d-flex justify-content-between align-items-baseline mb-2">
                        <div className="fw-semibold">{m.title}</div>
                        <div className="text-muted small">{m.score}% match</div>
                      </div>
                      <div
                        className="progress"
                        role="progressbar"
                        aria-valuenow={m.score}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        style={{ height: "18px" }}
                      >
                        <div
                          className={`progress-bar ${m.score >= 80 ? "bg-success" : m.score >= 60 ? "bg-info" : m.score >= 40 ? "bg-warning" : "bg-secondary"}`}
                          style={{
                            width: `${Math.max(0, Math.min(100, m.score || 0))}%`,
                          }}
                        >
                          {m.score}%
                        </div>
                      </div>
                      {m.reason && (
                        <div className="text-muted mt-2" style={{ whiteSpace: "pre-wrap" }}>
                          {m.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
