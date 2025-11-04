import { useEffect, useMemo, useState } from "react";

// Client for AI Questions (6 generic + 8 AI questions)
// Usage: <AIQuestions user={user} onDone={() => navigate('/dashboard')} />
export default function AIQuestions({ user, onDone }) {
  const [genericQs, setGenericQs] = useState([]);
  const [genericAns, setGenericAns] = useState([]);
  const [aiQs, setAiQs] = useState([]);
  const [aiAns, setAiAns] = useState([]);
  const [stage, setStage] = useState("generic"); // 'generic' | 'ai' | 'done'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [targetCareer, setTargetCareer] = useState(""); // optional focus
  const [otherInputs, setOtherInputs] = useState({}); // per-question text for "Other"
  const [useTargetCareer, setUseTargetCareer] = useState(true); // toggle for Target Career field

  const canGenerate = useMemo(
    () =>
      genericAns.length === genericQs.length &&
      genericAns.every((a) => String(a || "").trim().length > 0),
    [genericAns, genericQs],
  );
  const canSubmit = useMemo(
    () =>
      aiQs.length === 8 &&
      aiAns.length === aiQs.length &&
      aiAns.every((a) => String(a || "").trim().length > 0),
    [aiQs, aiAns],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/advanced/init-questions");
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.message || "Failed to load questions");
        if (!active) return;
        setGenericQs(data.questions || []);
        setGenericAns(Array((data.questions || []).length).fill(""));
      } catch (err) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const updateGeneric = (idx, value) => {
    setGenericAns((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const updateAi = (idx, value) => {
    setAiAns((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleGenerate = async () => {
    if (!user?.userId) {
      setError("You must be logged in to continue.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/advanced/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          genericAnswers: genericAns,
          targetCareer:
            useTargetCareer && targetCareer.trim()
              ? targetCareer.trim()
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data?.message || "Failed to generate follow-up questions",
        );
      const questions = Array.isArray(data.aiQuestions) ? data.aiQuestions : [];
      setAiQs(questions);
      setAiAns(Array(questions.length).fill(""));
      setStage("ai");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.userId) {
      setError("You must be logged in to submit.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        userId: user.userId,
        genericQuestions: genericQs,
        genericAnswers: genericAns,
        aiQuestions: aiQs,
        aiAnswers: aiAns,
      };
      const res = await fetch("/api/advanced/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to save responses");
      setStage("done");
      if (onDone) onDone();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="mb-3" style={{ fontFamily: '"Limelight", serif' }}>
                AI Questions
              </h2>
              <p className="text-muted">
                Answer 6 starter questions. We’ll then generate 8 personalized
                follow-ups tailored to a specific career.
              </p>
              {error && (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              )}

              {stage === "generic" && (
                <div>
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label
                        className="form-label fw-semibold m-0"
                        htmlFor="targetCareer"
                      >
                        Target Career (optional)
                      </label>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="useTargetCareer"
                          checked={useTargetCareer}
                          onChange={(e) => setUseTargetCareer(e.target.checked)}
                          aria-label="Toggle target career focus"
                        />
                        <label className="form-check-label" htmlFor="useTargetCareer">
                          {useTargetCareer ? "On" : "Off"}
                        </label>
                      </div>
                    </div>
                    <input
                      id="targetCareer"
                      className="form-control"
                      type="text"
                      value={targetCareer}
                      onChange={(e) => setTargetCareer(e.target.value)}
                      placeholder="e.g., Data Analyst, UX Designer, Supply Chain Analyst"
                      disabled={!useTargetCareer}
                      aria-disabled={!useTargetCareer}
                    />
                    <div className="form-text">
                      {useTargetCareer
                        ? "If provided, follow-up questions will be focused on this specific role."
                        : "Turn on the switch to focus questions on a specific target role."}
                    </div>
                  </div>
                  {genericQs.map((q, idx) => {
                    const checkboxIndices = new Set([0, 1, 2]); // Questions 1,2,3 as 2x2 checkboxes
                    const isSliderQ = idx === 5; // Question 6: slider 1–60 hours
                    const isCheckboxQ = checkboxIndices.has(idx);
                    const options =
                      idx === 0
                        ? ["Remote", "Hybrid", "On-Site", "Other"]
                        : idx === 1
                        ? ["Startup", "Mid-Size", "Large Enterprise", "Other"]
                        : idx === 2
                        ? ["Intership", "Full time", "Research", "Freelance"]
                        : ["Option A", "Option B", "Option C", "Option D"];

                    const tokens = (genericAns[idx] || "").split("; ").filter(Boolean);
                    const hasOther = tokens.some((t) => t === "Other" || t.startsWith("Other:"));
                    const otherToken = tokens.find((t) => t.startsWith("Other:"));
                    const otherValueFromAns = otherToken ? otherToken.slice(6).trim().replace(/^:\s*/, "") : "";
                    const otherText = otherInputs[idx] ?? otherValueFromAns;

                    const toggleSelect = (opt) => {
                      let nextTokens = [...tokens];
                      if (opt === "Other") {
                        // Remove any existing Other token
                        nextTokens = nextTokens.filter((t) => !(t === "Other" || t.startsWith("Other:")));
                        if (!hasOther) {
                          // Add a placeholder Other token; will be replaced by typed value if provided
                          nextTokens.push(otherText ? `Other: ${otherText}` : "Other");
                        } else {
                          // Toggling off Other clears stored text
                          setOtherInputs((prev) => ({ ...prev, [idx]: "" }));
                        }
                      } else {
                        const i = nextTokens.indexOf(opt);
                        if (i >= 0) nextTokens.splice(i, 1);
                        else nextTokens.push(opt);
                      }
                      updateGeneric(idx, nextTokens.join("; "));
                    };

                    const handleOtherChange = (val) => {
                      setOtherInputs((prev) => ({ ...prev, [idx]: val }));
                      // Update the answer string with the latest Other value if Other is selected
                      let nextTokens = tokens.filter((t) => !(t === "Other" || t.startsWith("Other:")));
                      if (hasOther) {
                        const trimmedVal = val.trim();
                        // Keep a token even if empty to preserve selection; backend expects non-empty answer overall
                        nextTokens.push(trimmedVal ? `Other: ${trimmedVal}` : "Other");
                        updateGeneric(idx, nextTokens.join("; "));
                      }
                    };

                    return (
                      <div className="mb-3" key={idx}>
                        <label className="form-label fw-semibold">
                          {idx + 1}. {q}
                        </label>

                        {isCheckboxQ ? (
                          <div className="container px-0">
                            <div className="row g-2">
                              {options.map((opt, i) => (
                                <div className="col-12 col-sm-6" key={i}>
                                  <div className="form-check">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`q${idx}-opt${i}`}
                                      checked={
                                        opt === "Other"
                                          ? hasOther
                                          : tokens.includes(opt)
                                      }
                                      onChange={() => toggleSelect(opt)}
                                    />
                                    <label className="form-check-label" htmlFor={`q${idx}-opt${i}`}>
                                      {opt}
                                    </label>
                                    {opt === "Other" && hasOther && (
                                      <div className="mt-2">
                                        <input
                                          type="text"
                                          className="form-control"
                                          placeholder="Please specify..."
                                          value={otherText}
                                          onChange={(e) => handleOtherChange(e.target.value)}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : isSliderQ ? (
                          <div className="d-flex align-items-center gap-3">
                            <input
                              className="form-control"
                              type="number"
                              min="1"
                              max="60"
                              step="1"
                              id={`q${idx}-num`}
                              value={genericAns[idx] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "") {
                                  updateGeneric(idx, "");
                                } else {
                                  const n = Number(v);
                                  if (!Number.isNaN(n)) {
                                    updateGeneric(idx, String(n));
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const v = e.target.value;
                                if (v !== "") {
                                  let n = Number(v);
                                  if (Number.isNaN(n)) n = 1;
                                  if (n < 1) n = 1;
                                  if (n > 60) n = 60;
                                  updateGeneric(idx, String(n));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                              }}
                              inputMode="numeric"
                            />
                            <span style={{ minWidth: 70 }}>{Number(genericAns[idx] || 1)} hrs</span>
                          </div>
                        ) : (
                          <input
                            className="form-control"
                            type="text"
                            value={genericAns[idx] || ""}
                            onChange={(e) => updateGeneric(idx, e.target.value)}
                            placeholder="Your answer..."
                          />
                        )}
                      </div>
                    );
                  })}
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerate}
                    disabled={loading || !canGenerate}
                  >
                    {loading
                      ? "Generating…"
                      : "Generate Personalized Questions"}
                  </button>
                </div>
              )}

              {stage === "ai" && (
                <div>
                  <div className="alert alert-info py-2">
                    We generated these based on your profile, answers, and
                    target career.
                  </div>
                  {aiQs.map((q, idx) => (
                    <div className="mb-3" key={idx}>
                      <label className="form-label fw-semibold">
                        {idx + 1}. {q}
                      </label>
                      <input
                        className="form-control"
                        type="text"
                        value={aiAns[idx] || ""}
                        onChange={(e) => updateAi(idx, e.target.value)}
                        placeholder="Your answer..."
                      />
                    </div>
                  ))}
                  <button
                    className="btn btn-success"
                    onClick={handleSubmit}
                    disabled={loading || !canSubmit}
                  >
                    {loading ? "Saving…" : "Submit Questionnaire"}
                  </button>
                </div>
              )}

              {stage === "done" && (
                <div className="alert alert-success">
                  Thanks! Your responses were saved.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
