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

    const [saved, setSaved] = useState(readSaved());
    const [selectedJob, setSelectedJob] = useState(null); // ✅ added for modal handling

    const removeJob = (jobId) => {
        const updated = saved.filter((j) => j.id !== jobId);
        setSaved(updated);
        localStorage.setItem("savedJobs", JSON.stringify(updated));
        setSelectedJob(null);
    };

  const [saved, setSaved] = useState(readSaved());
  const [managingId, setManagingId] = useState(null);

  const handleManage = (id) => {
    setManagingId((prev) => (prev === id ? null : id));
  };

  const handleDelete = (id) => {
    const next = saved.filter((j) => j.id !== id);
    setSaved(next);
    try {
      localStorage.setItem("savedJobs", JSON.stringify(next));
    } catch {}
  };

                            <hr className="my-4" />

                            <div className="text-start">
                                <h5 className="mb-3">Your saved items</h5>
                                {saved.length === 0 ? (
                                    <p className="text-muted">
                                        You haven’t saved anything yet. Explore jobs and click
                                        “Save” to see them appear here.
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
                                                <button
                                                    className="btn btn-sm btn-outline-primary"
                                                    title="Manage this saved job"
                                                    onClick={() => setSelectedJob(job)} // ✅ opens modal
                                                >
                                                    Manage
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
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
                                    <strong>Match:</strong>{" "}
                                    {selectedJob.matchPercent ?? "N/A"}%
                                </p>

                                <p className="text-muted small">
                                    This job is currently saved in your list.
                                </p>
                            </div>

                            <div className="modal-footer border-0">
                                <button
                                    className="btn btn-danger"
                                    onClick={() => removeJob(selectedJob.id)}
                                >
                                    Remove
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setSelectedJob(null)}
                                >
                                    Close
                                </button>
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
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
    );
}


