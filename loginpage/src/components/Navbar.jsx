export default function Navbar({ user, onLogout }) {
  const go = (hash) => {
    window.location.hash = hash
  }

  const handleBackToLogin = () => {
    if (typeof onLogout === 'function') {
      onLogout()
    } else {
      go('#/login')
    }
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <span className="navbar-brand" style={{ fontFamily: '"Limelight", serif' }}>FAMU Career Assistant</span>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar" aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="mainNavbar">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => go('#/dashboard')}>Dashboard</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => go('#/quiz')}>Profile</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => go('#/advanced')}>Advanced Questionnaire</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => go('#/myqa')}>My Q&A</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => go('#/jobs')}>Job Matches</button>
            </li>
          </ul>
          <div className="d-flex align-items-center gap-2">
            {user?.email && (
              <span className="text-light small d-none d-md-inline">{user.email}</span>
            )}
            <button className="btn btn-outline-light" onClick={handleBackToLogin}>
              <i className="fa-solid fa-arrow-right-from-bracket me-1"></i>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
