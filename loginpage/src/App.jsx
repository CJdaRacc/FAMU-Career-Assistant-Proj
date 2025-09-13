import './App.css'
import { useEffect, useState } from 'react'
import Login from './components/Login.jsx'
import Quiz from './components/Quiz.jsx'
import Dashboard from './components/Dashboard.jsx'

function App() {
  const [route, setRoute] = useState(window.location.hash || '#/login')
  const [user, setUser] = useState(null) // { userId, email, questionnaireCompleted, createdAt }

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '#/login')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleAuth = (data) => {
    setUser({
      userId: data.userId,
      email: data.email,
      questionnaireCompleted: !!data.questionnaireCompleted,
      createdAt: data.createdAt,
    })
    if (data.questionnaireCompleted) {
      window.location.hash = '#/dashboard'
    } else {
      window.location.hash = '#/quiz'
    }
  }

  const handleQuestionnaireDone = () => {
    setUser((u) => (u ? { ...u, questionnaireCompleted: true } : u))
    window.location.hash = '#/dashboard'
  }

  const handleLogout = () => {
    setUser(null)
    window.location.hash = '#/login'
  }

  let content = null
  if (route.startsWith('#/quiz')) {
    content = <Quiz user={user} onDone={handleQuestionnaireDone} />
  } else if (route.startsWith('#/dashboard')) {
    content = <Dashboard user={user} onLogout={handleLogout} />
  } else {
    content = <Login onAuth={handleAuth} />
  }

  return (
    <>
      <h1 style={{ textAlign: 'center', marginTop: 20, fontFamily: '"Limelight", serif' }}>Login Page</h1>
      {content}
    </>
  )
}

export default App
