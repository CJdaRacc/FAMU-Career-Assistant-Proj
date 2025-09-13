export default function Dashboard({ user, onLogout }) {
  const handleBackToLogin = () => {
    if (typeof onLogout === 'function') {
      onLogout()
    } else {
      window.location.hash = '#/login'
    }
  }

  return (
    <div className="container my-5">
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
      </div>
    </div>
  )
}
