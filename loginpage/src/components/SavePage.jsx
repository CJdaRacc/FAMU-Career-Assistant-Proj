// loginpage/src/components/SavePage.jsx
import { useState } from "react";

export default function Save({ user }) {
  const handleBack = () => {
    window.location.hash = "#/dashboard";
  };

  const readSaved = () => {
    try {
      return JSON.parse(localStorage.getItem("savedJobs") || "[]");
    } catch {
      return [];
    }
  };

  // ✅ Declare once
  const [saved, setSaved] = useState(readSaved());
  const [selectedJob, setSelectedJob] = useState(null);
  const [managingId, setManagingId] = useState(null);

  const removeJob = (jobId) => {
    const job = saved.find((j) => j.id === jobId);
    const label = job?.title || "this item";
    const ok = window.confirm(
      `Are you sure you want to delete "${label}" from your saved items? This action cannot be undone.`,
    );
    if (!ok) return;

    const updated = saved.filter((j) => j.id !== jobId);
    setSaved(updated);
    try {
      localStorage.setItem("savedJobs", JSON.stringify(updated));
    } catch {}
    setSelectedJob(null);
  };

  const handleManage = (id) => {
    setManagingId((prev) => (prev === id ? null : id));
  };

  const handleDelete = (id) => {
    const job = saved.find((j) => j.id === id);
    const label = job?.title || "this item";
    const ok = window.confirm(
      `Are you sure you want to delete "${label}" from your saved items? This action cannot be undone.`,
    );
    if (!ok) return;

    const next = saved.filter((j) => j.id !== id);
    setSaved(next);
    try {
      localStorage.setItem("savedJobs", JSON.stringify(next));
    } catch {}
  };

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h2 className="mb-2" style={{ fontFamily: '"Limelight", serif' }}>
                    Save
                  </h2>
                  <p className="text-muted mb-0">
                    {user?.email
                      ? `Viewing saved items for ${user.email}`
                      : "Viewing your saved items"}
                  </p>
                </div>
                <button className="btn btn-outline-secondary" onClick={handleBack}>
                  ← Back
                </button>
              </div>

              <>
                <hr className="my-4" />

                <div className="text-start">
                  <h5 className="mb-3">Your saved items</h5>
                  {saved.length === 0 ? (
                    <p className="text-muted">
                      You haven’t saved anything yet. Explore jobs and click “Save” to see them
                      appear here.
                    </p>
                  ) : (
                    <ul className="list-group">
                      {saved.map((job) => (
                        <li
                          key={job.id}
                          className="list-group-item d-flex justify-content-between align-items-start"
                        >
                          <div>
                            <div className="fw-semibold">{job.title}</div>
                            <div className="text-muted small">
                              {job.company} • {job.location} • {job.type}
                            </div>
                          </div>
                          <div className="d-flex gap-2 align-items-center">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleManage(job.id)}
                              aria-expanded={managingId === job.id}
                              aria-controls={`manage-${job.id}`}
                            >
                              Manage
                            </button>
                            {managingId === job.id && (
                              <button
                                id={`manage-${job.id}`}
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(job.id)}
                              >
                                Delete
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-outline-success"
                              onClick={() => setSelectedJob(job)} // open modal
                            >
                              View
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Modal for managing saved job */}
      {selectedJob && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header border-0">
                <h5 className="modal-title">{selectedJob.title}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedJob(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Company:</strong> {selectedJob.company}
                </p>
                <p>
                  <strong>Location:</strong> {selectedJob.location}
                </p>
                <p>
                  <strong>Type:</strong> {selectedJob.type}
                </p>
                <p>
                  <strong>Match:</strong> {selectedJob.matchPercent ?? "N/A"}%
                </p>

                <p className="text-muted small">This job is currently saved in your list.</p>
              </div>

              <div className="modal-footer border-0">
                <button className="btn btn-secondary" onClick={() => setSelectedJob(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
