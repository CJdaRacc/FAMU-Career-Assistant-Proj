import { useState } from "react";

export default function JobMatcher({ onMatch }) {
  const [form, setForm] = useState({
    remote: "",
    type: "",
    location: "",
    degree: "",
    experience: "",
    interest: "",
  });

  const [matched, setMatched] = useState(false);
  const [jobs, setJobs] = useState([]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Here we simulate matching — in real use, you’d call your backend
    const base = import.meta.env.VITE_API_BASE || "http://localhost:5002";
    const resp = await fetch(`${base}/api/job-postings`);
    const data = await resp.json();

    // fake filtering by user choices
    const filtered = data.items.filter((j) => {
      if (form.type && !j.title.toLowerCase().includes(form.type.toLowerCase())) return false;
      if (form.remote === "yes" && !j.title.toLowerCase().includes("remote")) return false;
      return true;
    });

    setJobs(filtered.slice(0, 5)); // top 5 results
    setMatched(true);
  };

  const containerStyle = {
    backgroundColor: "#fff",
    color: "#333",
    padding: "20px",
    borderRadius: "8px",
    maxWidth: 700,
    margin: "40px auto",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    position: "relative",
  };

  const robotStyle = {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 80,
    height: 80,
  };

  return (
    <div style={containerStyle}>
      {!matched ? (
        <>
          <h2 style={{ color: "#2e7d32", textAlign: "center" }}>Job Matcher Assistant 🤖</h2>
          <p style={{ textAlign: "center", color: "#555" }}>
            Answer a few questions and let our robot match you with the best jobs!
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <label>
              Are you willing to work remote?
              <select name="remote" onChange={handleChange} required>
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label>
              What type of job are you looking for?
              <select name="type" onChange={handleChange} required>
                <option value="">Select</option>
                <option value="software">Software Developer</option>
                <option value="frontend">Front End</option>
                <option value="backend">Back End</option>
                <option value="data">Data Analytics</option>
                <option value="database">Database</option>
              </select>
            </label>

            <label>
              Preferred work location:
              <input
                type="text"
                name="location"
                placeholder="e.g. Orlando, FL"
                onChange={handleChange}
                required
              />
            </label>

            <label>
              What degree do you have?
              <select name="degree" onChange={handleChange} required>
                <option value="">Select</option>
                <option value="bachelors">Bachelor’s</option>
                <option value="masters">Master’s</option>
                <option value="phd">Ph.D</option>
                <option value="none">None</option>
              </select>
            </label>

            <label>
              How many years of experience do you have?
              <select name="experience" onChange={handleChange}>
                <option value="">Select</option>
                <option value="0-1">0–1 years</option>
                <option value="2-4">2–4 years</option>
                <option value="5+">5+ years</option>
              </select>
            </label>

            <label>
              What are you most interested in learning or doing?
              <input
                type="text"
                name="interest"
                placeholder="e.g. AI, cloud, mobile"
                onChange={handleChange}
              />
            </label>

            <button
              type="submit"
              style={{
                backgroundColor: "#ff9800",
                color: "white",
                fontWeight: "bold",
                padding: "12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
              }}
            >
              MATCH ME WITH JOBS
            </button>
          </form>

          <img src="/robot-thinking.png" alt="Thinking Robot" style={robotStyle} />
        </>
      ) : (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#2e7d32" }}>Here are your best matches!</h2>
          <img src="/robot-smile.png" alt="Happy Robot" style={robotStyle} />
          {jobs.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {jobs.map((job) => (
                <li
                  key={job.id}
                  style={{
                    background: "#fafafa",
                    border: "2px solid #2e7d32",
                    borderLeft: "8px solid #ff9800",
                    padding: "12px",
                    borderRadius: "6px",
                    margin: "12px 0",
                    textAlign: "left",
                  }}
                >
                  <strong>{job.title}</strong> – {job.company}
                </li>
              ))}
            </ul>
          ) : (
            <p>No jobs matched your answers, but check back soon!</p>
          )}
          <button
            onClick={() => setMatched(false)}
            style={{
              marginTop: 20,
              padding: "10px 15px",
              backgroundColor: "#ff9800",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
