import { useEffect, useState } from "react";

export default function AdvancedReview({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.userId) {
        setError("You must be logged in to view this page.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/advanced/my?userId=${encodeURIComponent(user.userId)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Failed to load your questionnaire");
        if (!active) return;
        setData(json.advanced || null);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Something went wrong");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [user?.userId]);

  const profile = data?.profileSnapshot || {};

  return (
    <div className="container my-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="mb-3 text-center" style={{ fontFamily: '"Limelight", serif' }}>
                My Personalized Q&A
              </h2>
              <p className="text-muted text-center">Only you can view your saved questions and answers.</p>

              {loading && <div className="alert alert-info py-2">Loading…</div>}
              {error && <div className="alert alert-danger py-2">{error}</div>}

              {!loading && !error && !data && (
                <div className="alert alert-warning py-2">
                  No personalized questionnaire found. Complete the Advanced Questionnaire first.
                </div>
              )}

              {!loading && !error && data && (
                <div>
                  <div className="mb-3">
                    <h5 className="mb-2">
                      <span className="me-2" role="img" aria-label="student profile">🧑‍🎓</span>
                      Profile Snapshot
                    </h5>
                    <ul className="list-unstyled mb-0">
                      {profile.major && (
                        <li>
                          <strong>Major:</strong> {profile.major}
                        </li>
                      )}
                      {profile.classYear && (
                        <li>
                          <strong>Class Year:</strong> {profile.classYear}
                        </li>
                      )}
                      {Array.isArray(profile.interests) && profile.interests.length > 0 && (
                        <li>
                          <strong>Interests:</strong> {profile.interests.join(", ")}
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="mb-4">
                    <h5 className="mb-2">Generic Questions & Answers</h5>
                    {Array.isArray(data.genericQuestions) && data.genericQuestions.length > 0 ? (
                      <div className="mb-0">
                        {data.genericQuestions.map((q, i) => {
                          const ans = data.genericAnswers?.[i];
                          return (
                            <details key={`g-${i}`} className="mb-2 qa-dropdown">
                              <summary className="fw-semibold qa-summary">{q}</summary>
                              <div className="text-muted mt-1 qa-content">
                                Answer: {ans ? ans : <em>(none)</em>}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-muted">No generic responses found.</div>
                    )}
                  </div>

                  <div>
                    <h5 className="mb-2">Personalized Questions & Answers</h5>
                    {Array.isArray(data.aiQuestions) && data.aiQuestions.length > 0 ? (
                      <div className="mb-0">
                        {data.aiQuestions.map((q, i) => {
                          const ans = data.aiAnswers?.[i];
                          return (
                            <details key={`a-${i}`} className="mb-2 qa-dropdown">
                              <summary className="fw-semibold qa-summary">{q}</summary>
                              <div className="text-muted mt-1 qa-content">
                                Answer: {ans ? ans : <em>(none)</em>}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-muted">No personalized responses found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
