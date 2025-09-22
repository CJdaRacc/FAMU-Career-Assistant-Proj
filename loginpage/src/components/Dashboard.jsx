export default function Dashboard({ user, onLogout }) {
  const handleBackToLogin = () => {
    if (typeof onLogout === 'function') {
      onLogout()
    } else {
      window.location.hash = '#/login'
    }
  }
  const goToSave = () => {
    window.location.hash = '#/save'
  }

  return (
    <div className="container mt-2 mb-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-8">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h2 className="mb-3" style={{ fontFamily: '"Limelight", serif' }}>Dashboard</h2>
                  <p className="text-muted">Welcome{user?.email ? `, ${user.email}` : ''}!</p>
                </div>
                <button className="btn btn-outline-secondary" onClick={handleBackToLogin}>
                  <i className="fa-solid fa-arrow-right-from-bracket me-1"></i>
                  Back to Login
                </button>
              </div>
              {user?.createdAt && (
                <p className="mb-0"><strong>Account created:</strong> {new Date(user.createdAt).toLocaleString()}</p>
              )}
              {user?.questionnaireCompleted ? (
                <p className="text-success mt-2">Questionnaire completed. Thank you!</p>
              ) : (
                <p className="text-warning mt-2">Questionnaire not completed yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar with Sneak Peek (moved to the side) */}
        <div className="col-12 col-lg-4 mt-4 mt-lg-0">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="mb-1">Sneak peek: Save</h5>
              <small className="text-muted mb-3">View items you’ve saved for later.</small>
              <div className="mt-auto">
                <button className="btn btn-primary w-100" onClick={goToSave}>
                  Go to Save
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
