// loginpage/src/components/SavePage.jsx
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

  const saved = readSaved();

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h2
                    className="mb-2"
                    style={{ fontFamily: '"Limelight", serif' }}
                  >
                    Save
                  </h2>
                  <p className="text-muted mb-0">
                    {user?.email
                      ? `Viewing saved items for ${user.email}`
                      : "Viewing your saved items"}
                  </p>
                </div>
                <button
                  className="btn btn-outline-secondary"
                  onClick={handleBack}
                >
                  Back to Dashboard
                </button>
              </div>

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
                        <a
                          className="btn btn-sm btn-outline-primary"
                          href="#/dashboard"
                          title="Back to dashboard to manage"
                        >
                          Manage
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
