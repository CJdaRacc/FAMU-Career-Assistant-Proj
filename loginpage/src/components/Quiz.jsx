import { useMemo, useState } from "react";

// General fields of study mapped to related interests
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

export default function Quiz({ user, onDone }) {
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(now + i));
  }, []);

  const [major, setMajor] = useState("");
  const [classYear, setClassYear] = useState("");

  // New: selected fields and per-field interests
  const [selectedFields, setSelectedFields] = useState([]); // e.g., ['Computer Science & Engineering']
  const [fieldSelections, setFieldSelections] = useState({}); // { fieldName: ['Software Engineering', ...] }

  const [otherText, setOtherText] = useState(""); // comma-separated custom interests
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const anyOtherSelected = Object.values(fieldSelections).some((arr) =>
    (arr || []).includes("Other"),
  );

  const toggleField = (field) => {
    setSelectedFields((prev) => {
      const has = prev.includes(field);
      const next = has ? prev.filter((f) => f !== field) : [...prev, field];
      // If unchecking, also remove its selections
      setFieldSelections((old) => {
        if (has) {
          const copy = { ...old };
          delete copy[field];
          return copy;
        }
        return old;
      });
      return next;
    });
  };

  const handleFieldInterestChange = (field, e) => {
    const values = Array.from(e.target.selectedOptions || []).map((o) => o.value);
    setFieldSelections((prev) => ({ ...prev, [field]: values }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!user?.userId) {
      setError("You must be logged in to complete your profile.");
      return;
    }
    if (selectedFields.length === 0) {
      setError("Please select at least one major.");
      return;
    }
    if (!classYear) {
      setError("Please select your class year.");
      return;
    }

    // Build final interests from all selected field dropdowns
    const preset = Object.values(fieldSelections)
      .flat()
      .filter((i) => i && i !== "Other");
    const custom =
      anyOtherSelected && otherText.trim()
        ? otherText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const finalInterests = Array.from(new Set([...preset, ...custom]));

    setSubmitting(true);
    try {
      const payload = {
        userId: user.userId,
        major: selectedFields.join(", "),
        interests: finalInterests,
        classYear,
      };
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to save profile");
      if (onDone) onDone();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldNames = Object.keys(FIELD_INTERESTS);

  return (
    <div className="container my-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="mb-3" style={{ fontFamily: '"Limelight", serif' }}>
                Student Profile Setup
              </h2>
              <p className="text-muted">Tell us your major, related interests, and class year.</p>
              {error && (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                {/* General fields as checkboxes */}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Major</label>
                  <div className="row">
                    {fieldNames.map((field) => (
                      <div className="col-12 col-md-6" key={field}>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`field-${field}`}
                            checked={selectedFields.includes(field)}
                            onChange={() => toggleField(field)}
                          />
                          <label className="form-check-label" htmlFor={`field-${field}`}>
                            {field}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="form-text">
                    Select one or more fields. Interest options will appear below for each selected
                    field.
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
                      Hold Ctrl (Windows) or Command (Mac) to select multiple. Choose "Other" to add
                      custom interests.
                    </div>
                  </div>
                ))}

                {anyOtherSelected && (
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

                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="classYear">
                    Class Year
                  </label>
                  <select
                    id="classYear"
                    className="form-select"
                    value={classYear}
                    onChange={(e) => setClassYear(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select your class year…
                    </option>
                    {years.map((y) => (
                      <option value={y} key={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving…" : "Save and Continue"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
