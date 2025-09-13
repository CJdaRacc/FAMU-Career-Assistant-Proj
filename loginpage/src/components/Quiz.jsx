import { useMemo, useState } from 'react'

const DEFAULT_QUESTIONS = [
  'Are you currently enrolled in college?',
  'Will you graduate within the next 12 months?',
  'Are you seeking an internship?',
  'Are you seeking a full-time role?',
  'Are you open to remote opportunities?',
  'Are you willing to relocate for the right role?',
  'Do you have work authorization in your target country?',
  'Do you prefer startup environments?',
  'Are you interested in Software Engineering roles?',
  'Are you interested in Data/Analytics roles?',
  'Are you interested in Product Management roles?',
  'Are you interested in Design/UX roles?',
  'Are you interested in Marketing/Sales roles?',
  'Are you interested in Operations roles?',
  'Are you interested in Finance/Accounting roles?',
  'Do you have prior internship or co-op experience?',
  'Do you have a portfolio (e.g., GitHub, Behance) to share?',
  'Would you like recruiters to be able to contact you?',
  'Would you like to receive job alerts via email?',
  'Are you open to contract or freelance work?'
]

export default function Quiz({ user, onDone }) {
  const questions = useMemo(() => DEFAULT_QUESTIONS, [])
  const [answers, setAnswers] = useState(Array(questions.length).fill(null))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (idx, val) => {
    const next = [...answers]
    next[idx] = val
    setAnswers(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!user?.userId) {
      setError('You must be logged in to take the questionnaire.')
      return
    }
    if (answers.some((a) => a === null)) {
      setError('Please answer all questions before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, answers }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'Failed to submit questionnaire')
      if (onDone) onDone()
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container my-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10">
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h2 className="mb-3" style={{ fontFamily: '"Limelight", serif' }}>Student Career Setup</h2>
              <p className="text-muted">Answer 20 quick yes/no questions to tailor your job search preferences (similar to LinkedIn onboarding).</p>
              {error && (
                <div className="alert alert-danger py-2" role="alert">{error}</div>
              )}
              <form onSubmit={handleSubmit}>
                {questions.map((q, idx) => (
                  <div className="mb-3" key={idx}>
                    <label className="form-label fw-semibold">{idx + 1}. {q}</label>
                    <div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name={`q${idx}`}
                          id={`q${idx}-yes`}
                          value="yes"
                          checked={answers[idx] === 'yes'}
                          onChange={() => handleChange(idx, 'yes')}
                          required
                        />
                        <label className="form-check-label" htmlFor={`q${idx}-yes`}>Yes</label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name={`q${idx}`}
                          id={`q${idx}-no`}
                          value="no"
                          checked={answers[idx] === 'no'}
                          onChange={() => handleChange(idx, 'no')}
                          required
                        />
                        <label className="form-check-label" htmlFor={`q${idx}-no`}>No</label>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Questionnaire'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
