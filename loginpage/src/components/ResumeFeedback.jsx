import { useState } from "react";

const SAVED_KEY = "savedJobs";

function readSavedJobs() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

export default function ResumeFeedback({ user }) {
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const savedJobs = readSavedJobs();

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setResult(null);
    setError("");
  };

  async function extractFromFile() {
    if (!file) return;
    setExtracting(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/resume/extract", { method: "POST", body: fd });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.message || "Failed to extract text");
      }
      setResumeText(data.text || "");
    } catch (err) {
      setError(err?.message || "Error extracting resume text");
    } finally {
      setExtracting(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const payload = { resumeText, savedJobs };
      const resp = await fetch("/api/resume/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || "Failed to analyze resume");
      setResult(data);
    } catch (err) {
      setError(err?.message || "Error analyzing resume");
    } finally {
      setAnalyzing(false);
    }
  }

  const disabledAnalyze = !resumeText || !savedJobs.length || analyzing;

  return (
    <div className="container">
      <div className="row">
        <div className="col-12 col-lg-10 mx-auto">
          <div className="card shadow-sm">
            <div className="card-body">
              <h3 className="card-title mb-2">Resume Feedback</h3>
              <p className="text-muted mb-3">
                Upload a PDF or DOCX, or paste your resume text. We will automatically detect skills in your resume and highlight them while scoring matches against your saved jobs.
              </p>

              <div className="mb-3">
                <label className="form-label">Upload PDF or DOCX</label>
                <input
                  className="form-control"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={onPickFile}
                  disabled={extracting || analyzing}
                />
                <div className="d-flex gap-2 mt-2">
                  <button className="btn btn-outline-primary btn-sm" onClick={extractFromFile} disabled={!file || extracting}>
                    {extracting ? "Extracting..." : "Extract Text"}
                  </button>
                  {file && (
                    <span className="small text-muted">Selected: {file.name}</span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Or paste resume text</label>
                <textarea
                  className="form-control"
                  rows={8}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume text here..."
                  disabled={analyzing}
                />
                <div className="form-text">Characters: {resumeText.length}</div>
              </div>


              <div className="mb-3">
                <label className="form-label">Saved jobs to compare</label>
                {savedJobs.length ? (
                  <ul className="list-group">
                    {savedJobs.map((j) => (
                      <li key={j.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>
                          <strong>{j.title}</strong>
                          {j.company ? <span className="text-muted"> @ {j.company}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="alert alert-warning">
                    No saved jobs found. Go to Job Postings or Dashboard to save some jobs first.
                  </div>
                )}
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-primary" onClick={analyze} disabled={disabledAnalyze}>
                  {analyzing ? "Analyzing..." : "Analyze Resume"}
                </button>
              </div>

              {error && (
                <div className="alert alert-danger mt-3">{error}</div>
              )}

              {result && (
                <div className="mt-4">
                  <h5>Keywords</h5>
                  <div className="mb-3">
                    {(result.keywords || []).map((k) => (
                      <span key={k} className="badge rounded-pill text-bg-secondary me-1 mb-1">{k}</span>
                    ))}
                  </div>

                  <h5>Match Scores</h5>
                  <div className="list-group">
                    {result.jobs?.map((r) => (
                      <div key={r.id} className="list-group-item">
                        <div className="d-flex justify-content-between">
                          <div>
                            <strong>{r.title}</strong>
                            {r.company ? <span className="text-muted"> @ {r.company}</span> : null}
                          </div>
                          <div>
                            <span className={`badge ${r.score >= 70 ? "text-bg-success" : r.score >= 40 ? "text-bg-warning" : "text-bg-danger"}`}>
                              {r.score}% match
                            </span>
                          </div>
                        </div>
                        {r.matchedKeywords?.length ? (
                          <div className="mt-2">
                            <div className="small text-muted">Matched keywords:</div>
                            <div>
                              {r.matchedKeywords.map((k, i) => (
                                <span key={i} className="badge text-bg-light border me-1 mb-1">{k}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {r.notes ? (
                          <div className="mt-2 small text-muted">{r.notes}</div>
                        ) : null}
                      </div>
                    ))}
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
