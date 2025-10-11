import { useMemo, useState } from "react";

const SAVED_KEY = "savedJobs";

function readSavedJobs() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function computeManualChecks(text) {
  const t = (text || "").trim();
  const lc = t.toLowerCase();

  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phoneRe = /(\+?\d{1,2}[\s.-]?)?(\(?\d{3}\)?[\s.-]?){2}\d{4}/;
  const linkedinRe = /linkedin\.com\/in\//i;
  const githubRe = /github\.com\//i;

  const experienceHeaderRe = /(\bwork\s+experience\b|\bexperience\b|\bemployment\s+history\b|\bprofessional\s+experience\b)/i;
  const yearRe = /\b(19|20)\d{2}\b/;
  const monthYearRe = /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(19|20)\d{2}/i;

  const educationRe = /(\beducation\b|\bbachelor'?s\b|\bmaster'?s\b|\bb\.\s?s\.?\b|\bm\.\s?s\.?\b|\buniversity\b|\bcollege\b|\bgpa\b)/i;

  const skillsHeaderRe = /(\bskills\b|\btechnical\s+skills\b|\btechnologies\b|\btooling\b)/i;

  // Contact info check
  const hasEmail = emailRe.test(t);
  const hasPhone = phoneRe.test(t);
  const hasLink = linkedinRe.test(t) || githubRe.test(t);
  const contactOk = hasEmail && (hasPhone || hasLink);
  const contactMissing = [];
  if (!hasEmail) contactMissing.push("email address");
  if (!hasPhone && !hasLink) contactMissing.push("phone or professional link (LinkedIn/GitHub)");

  // Work experience check
  const hasExpHeader = experienceHeaderRe.test(t);
  const hasDates = monthYearRe.test(lc) || yearRe.test(t);
  const experienceOk = hasExpHeader && hasDates;

  // Education check
  const educationOk = educationRe.test(t);

  // Skills check
  const skillsOk = skillsHeaderRe.test(t);

  const checks = [
    {
      key: "contact",
      title: "Contact Information",
      ok: contactOk,
      details: contactOk
        ? "Found contact details (email and phone/link)."
        : `Missing ${contactMissing.join(", ")}. Add a professional header with your name, email, and phone/LinkedIn.`,
      suggestions: [
        "Use a professional email (e.g., firstname.lastname@domain.com)",
        "Include a phone number with area code",
        "Add a LinkedIn profile URL; GitHub if relevant",
      ],
    },
    {
      key: "experience",
      title: "Work Experience",
      ok: experienceOk,
      details: experienceOk
        ? "Found work experience section with dates."
        : hasExpHeader
        ? "Experience section detected but dates may be missing. Include month/year ranges (e.g., Jun 2023 – Present)."
        : "No experience section detected. Add a 'Work Experience' section with role, company, location, and dated bullet points.",
      suggestions: [
        "Use accomplishment bullets starting with strong verbs",
        "Quantify impact (numbers, %, $, time saved)",
        "Include dates (Month YYYY – Month YYYY or Present)",
      ],
    },
    {
      key: "education",
      title: "Education",
      ok: educationOk,
      details: educationOk
        ? "Found education details."
        : "No education section found. Include degree, institution, graduation date, and GPA if strong.",
      suggestions: [
        "List degree (e.g., B.S. in Computer Science)",
        "Include institution and expected/actual graduation date",
        "Add relevant coursework if space allows",
      ],
    },
    {
      key: "skills",
      title: "Skills (Technical)",
      ok: skillsOk,
      details: skillsOk
        ? "Found skills section."
        : "No skills section detected. Add a concise 'Skills' section with tools, languages, and frameworks.",
      suggestions: [
        "Group by category (Languages, Frameworks, Tools)",
        "Match skills to target job descriptions",
        "Avoid listing outdated or unrelated technologies",
      ],
    },
  ];

  const summaryOk = checks.every((c) => c.ok);

  return { checks, summaryOk };
}

// Escape HTML special characters to safely inject user text
function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function regexEscape(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Common English stopwords we do not want to highlight
const STOPWORDS = new Set([
  "the","and","or","a","an","to","of","in","on","for","with","by","at","from","is","are","was","were","be","been","being","this","that","these","those","as","it","its","but","if","not","no","yes","you","your","we","our","they","their","he","she","him","her","them","i","me","my","mine","ours"
]);

// Highlight keywords inside a block of text using <mark>
function highlightKeywordsIn(text, keywords) {
  let html = escapeHtml(text);
  const list = (keywords || [])
    .filter(Boolean)
    .map((k) => String(k))
    .filter((k) => k.length >= 2)
    // Do not highlight common stopwords (case-insensitive)
    .filter((k) => !STOPWORDS.has(k.toLowerCase()));
  // Sort by length desc to avoid partial masking (e.g., js before javascript)
  list.sort((a, b) => b.length - a.length);
  for (const k of list) {
    try {
      const re = new RegExp(`\\b(${regexEscape(k)})\\b`, "gi");
      html = html.replace(re, "<mark>$1</mark>");
    } catch (_) {
      // skip malformed regex
    }
  }
  return html;
}

// Build an HTML preview that highlights keywords only in Experience and Skills sections
function buildHighlightedResume(text, keywords) {
  const t = String(text || "");
  const lc = t.toLowerCase();
  const expMatch = lc.match(/(work\s+experience|experience|employment\s+history|professional\s+experience)/i);
  const skillsMatch = lc.match(/(technical\s+skills|skills|technologies|tooling)/i);
  const indices = [];
  if (expMatch) indices.push({ name: "Experience", start: expMatch.index });
  if (skillsMatch) indices.push({ name: "Skills", start: skillsMatch.index });
  if (!indices.length) {
    // If no recognizable sections, fallback to highlighting entire text
    return `<div class="resume-preview">${highlightKeywordsIn(t, keywords)}</div>`;
  }
  indices.sort((a, b) => a.start - b.start);
  const parts = [];
  for (let i = 0; i < indices.length; i++) {
    const cur = indices[i];
    const nextStart = indices[i + 1]?.start ?? t.length;
    const beforeStart = i === 0 ? 0 : indices[i - 1].end;
    // Non-section gap before the first section
    if (i === 0 && cur.start > 0) {
      parts.push({ html: escapeHtml(t.slice(0, cur.start)) });
    }
    const sectionText = t.slice(cur.start, nextStart);
    parts.push({ html: highlightKeywordsIn(sectionText, keywords) });
    cur.end = nextStart; // for gap calculation
    // Add gap to next section if exists
    if (i < indices.length - 1 && nextStart > cur.start) {
      const gapStart = nextStart; // actually nextStart belongs to next header; gap will be added on next loop start via previous slice handling
    }
  }
  // Append any remaining tail after last section
  const last = indices[indices.length - 1];
  if (last && last.end < t.length) {
    parts.push({ html: escapeHtml(t.slice(last.end)) });
  }
  return `<div class="resume-preview">${parts.map((p) => p.html).join("")}</div>`;
}

export default function ResumeFeedback({ user }) {
  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [compareToJobs, setCompareToJobs] = useState(true);

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
      const compare = compareToJobs && savedJobs.length > 0;
      const payload = { resumeText, savedJobs: compare ? savedJobs : [], compareToJobs: compare };
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

  const disabledAnalyze = !resumeText || analyzing;
  const manual = useMemo(() => computeManualChecks(resumeText), [resumeText]);

  return (
    <div className="container">
      <div className="row">
        <div className="col-12 col-lg-10 mx-auto">
          <div className="card shadow-sm">
            <div className="card-body">
              <h3 className="card-title mb-2">Resume Feedback</h3>
              <p className="text-muted mb-3">
                Upload a PDF or DOCX, or paste your resume text. We will automatically detect technical skills in your resume and score matches against your saved jobs.
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

              {resumeText ? (
                <details className="mb-3">
                  <summary className="d-flex justify-content-between align-items-center">
                    <span><strong>Manual Checks</strong></span>
                    <span className={"badge " + (manual.summaryOk ? "text-bg-success" : "text-bg-warning")}>
                      {manual.summaryOk ? "All good" : "Needs review"}
                    </span>
                  </summary>
                  <div className={"alert mt-2 " + (manual.summaryOk ? "alert-success" : "alert-warning")}>
                    {manual.summaryOk
                      ? "All core sections detected. You can proceed to Analyze to see keyword matches against your saved jobs."
                      : "Some core sections appear to be missing or incomplete. Review the items below."
                    }
                  </div>
                  <div className="list-group">
                    {manual.checks.map((c) => (
                      <div key={c.key} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-center">
                          <strong>{c.title}</strong>
                          <span className={"badge " + (c.ok ? "text-bg-success" : "text-bg-danger")}>{c.ok ? "OK" : "Needs attention"}</span>
                        </div>
                        <div className="small mt-1">{c.details}</div>
                        {!c.ok && (
                          <ul className="small mt-2 mb-0">
                            {c.suggestions.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

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
                    No saved jobs found. You can still analyze your resume without comparing to jobs by selecting the option below.
                  </div>
                )}
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="noCompare"
                    checked={!compareToJobs}
                    onChange={(e) => setCompareToJobs(!e.target.checked ? true : false)}
                    disabled={analyzing}
                  />
                  <label className="form-check-label" htmlFor="noCompare">
                    Don't compare to saved jobs (extract keywords only)
                  </label>
                </div>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-primary" onClick={analyze} disabled={disabledAnalyze}>
                  {analyzing ? "Analyzing..." : `Analyze Resume${compareToJobs ? " vs Jobs" : " (Keywords Only)"}`}
                </button>
              </div>

              {error && (
                <div className="alert alert-danger mt-3">{error}</div>
              )}

              {result && (
                <div className="mt-4">
                  <h5>Keywords (technical skills prioritized)</h5>
                  <div className="mb-3">
                    {(result.keywords || []).map((k) => (
                      <span key={k} className="badge rounded-pill text-bg-secondary me-1 mb-1">{k}</span>
                    ))}
                  </div>

                  {Array.isArray(result.jobs) && result.jobs.length > 0 ? (
                    <>
                      <h5>Match Scores</h5>
                      <div className="list-group">
                        {result.jobs.map((r) => (
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
                    </>
                  ) : null
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
