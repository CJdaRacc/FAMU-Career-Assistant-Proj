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
    <nav className="navbar navbar-expand-lg navbar-famu">
      <div className="container">
        <span className="navbar-brand famu-brand">
          <span className="brand-pill">FAMU</span>
          <span className="brand-title ms-2">Career Assistant</span>
        </span>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNavbar"
          aria-controls="mainNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="mainNavbar">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <button className="nav-link btn btn-link text-white-50" onClick={() => go('#/dashboard')}>Dashboard</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link text-white-50" onClick={() => go('#/quiz')}>Profile</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link text-white-50" onClick={() => go('#/advanced')}>Advanced Questionnaire</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link text-white-50" onClick={() => go('#/myqa')}>My Q&A</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link text-white-50" onClick={() => go('#/jobs')}>Job Matches</button>
            </li>
          </ul>
          <div className="d-flex align-items-center gap-2">
            {user?.email && (
              <span className="text-white fw-semibold small d-none d-md-inline">{user.email}</span>
            )}
            <button className="btn btn-light btn-sm" onClick={handleBackToLogin}>
              <i className="fa-solid fa-arrow-right-from-bracket me-1"></i>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
