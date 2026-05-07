import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = '/api'

const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Scelta Multipla',
  true_false: 'Vero o Falso',
  fill_blank: 'Completamento',
  open_answer: 'Risposta Aperta',
  matching: 'Abbinamento',
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function StudentQuiz() {
  const { quizId } = useParams()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [studentName, setStudentName] = useState('')
  const [studentSurname, setStudentSurname] = useState('')
  const [started, setStarted] = useState(false)
  const [startedAt, setStartedAt] = useState(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const timerRef = useRef(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await axios.get(`${API}/quizzes/${quizId}`)
        setQuiz(res.data)
        if (res.data.time_limit_minutes) {
          setTimeLeft(res.data.time_limit_minutes * 60)
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Verifica non trovata.')
      } finally {
        setLoading(false)
      }
    }
    fetchQuiz()
  }, [quizId])

  const doSubmit = useCallback(async (auto = false) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    setShowConfirm(false)

    try {
      const questions = quiz?.questions || []
      const answersArray = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] !== undefined ? answers[q.id] : null,
      }))

      const res = await axios.post(`${API}/quizzes/${quizId}/submit`, {
        student_name: studentName,
        student_surname: studentSurname,
        started_at: startedAt,
        answers: answersArray,
      })

      if (timerRef.current) clearInterval(timerRef.current)
      navigate(`/quiz/${quizId}/completed`, {
        state: {
          autoSubmit: auto,
          score: res.data.score,
          maxScore: res.data.max_score,
          percentage: res.data.percentage,
        },
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Errore durante la consegna.')
      setSubmitting(false)
      submittedRef.current = false
    }
  }, [answers, quizId, studentName, studentSurname, startedAt, navigate, quiz])

  useEffect(() => {
    if (!started || timeLeft === null || timeLeft <= 0) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          doSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [started])

  const setAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleStart = () => {
    if (studentName.trim() && studentSurname.trim()) {
      setStarted(true)
      setStartedAt(new Date().toISOString())
    }
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.2rem' }}>Caricamento verifica...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="card text-center" style={{ maxWidth: '500px' }}>
          <h2 style={{ marginBottom: '12px' }}>Errore</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!quiz) return null

  const questions = quiz.questions || []
  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0

  if (!started) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card fade-in" style={{ maxWidth: '500px', width: '100%' }}>
          <div className="text-center" style={{ marginBottom: '32px' }}>
            <h2 style={{ marginBottom: '8px' }}>{quiz.title}</h2>
            {quiz.description && <p style={{ marginBottom: '8px' }}>{quiz.description}</p>}
            {quiz.time_limit_minutes && (
              <p style={{ color: 'var(--secondary)', fontWeight: '600' }}>
                Tempo: {quiz.time_limit_minutes} minuti
              </p>
            )}
            <p style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {totalQuestions} domande
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input
              className="form-input"
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Inserisci il tuo nome"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Cognome *</label>
            <input
              className="form-input"
              type="text"
              value={studentSurname}
              onChange={(e) => setStudentSurname(e.target.value)}
              placeholder="Inserisci il tuo cognome"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && studentName.trim() && studentSurname.trim()) handleStart()
              }}
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={!studentName.trim() || !studentSurname.trim()}
            style={{ width: '100%', marginTop: '16px' }}
          >
            Inizia la Verifica →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'white', borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>
            Domanda {currentIndex + 1} di {totalQuestions}
          </span>
          {timeLeft !== null && (
            <span style={{
              fontWeight: '700', fontSize: '1.1rem',
              padding: '6px 16px', borderRadius: '8px',
              background: timeLeft < 120 ? 'var(--danger)' : 'var(--bg)',
              color: timeLeft < 120 ? 'white' : 'var(--text)',
              animation: timeLeft < 120 ? 'pulse 1s infinite' : 'none',
            }}>
              {formatTime(timeLeft)}
            </span>
          )}
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="container" style={{ maxWidth: '700px', paddingTop: '32px', paddingBottom: '120px' }}>
        {currentQuestion && (
          <div className="card fade-in" key={currentIndex}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{
                background: 'var(--secondary)', color: 'white',
                padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
              }}>
                {QUESTION_TYPE_LABELS[currentQuestion.type] || currentQuestion.type}
              </span>
              {currentQuestion.points && (
                <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {currentQuestion.points} {currentQuestion.points === 1 ? 'punto' : 'punti'}
                </span>
              )}
            </div>

            <h3 style={{ fontSize: '1.3rem', marginBottom: '24px', marginTop: '12px', lineHeight: '1.4' }}>
              {currentQuestion.text}
            </h3>

            {/* Multiple Choice */}
            {currentQuestion.type === 'multiple_choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(currentQuestion.options || []).map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setAnswer(currentQuestion.id, opt)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      padding: '18px 20px', borderRadius: 'var(--radius-sm)',
                      border: `2px solid ${answers[currentQuestion.id] === opt ? 'var(--primary)' : 'var(--border)'}`,
                      background: answers[currentQuestion.id] === opt ? 'rgba(230, 57, 70, 0.08)' : 'white',
                      cursor: 'pointer', textAlign: 'left', fontSize: '1.05rem',
                      transition: 'all 0.2s', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '0.9rem',
                      background: answers[currentQuestion.id] === opt ? 'var(--primary)' : 'var(--border)',
                      color: answers[currentQuestion.id] === opt ? 'white' : 'var(--text)',
                    }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* True/False */}
            {currentQuestion.type === 'true_false' && (
              <div style={{ display: 'flex', gap: '16px' }}>
                {['Vero', 'Falso'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAnswer(currentQuestion.id, val)}
                    style={{
                      flex: 1, padding: '24px', borderRadius: 'var(--radius)',
                      border: `3px solid ${answers[currentQuestion.id] === val ? (val === 'Vero' ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`,
                      background: answers[currentQuestion.id] === val
                        ? (val === 'Vero' ? 'rgba(42, 157, 143, 0.1)' : 'rgba(230, 57, 70, 0.1)')
                        : 'white',
                      cursor: 'pointer', fontSize: '1.3rem', fontWeight: '700',
                      fontFamily: 'inherit', transition: 'all 0.2s',
                      color: answers[currentQuestion.id] === val
                        ? (val === 'Vero' ? 'var(--success)' : 'var(--danger)')
                        : 'var(--text)',
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            )}

            {/* Fill Blank */}
            {currentQuestion.type === 'fill_blank' && (
              <div>
                <p style={{ fontSize: '1rem', marginBottom: '16px', color: 'var(--text-light)', fontStyle: 'italic' }}>
                  Completa con la parola mancante
                </p>
                <input
                  className="form-input"
                  type="text"
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                  placeholder="Scrivi qui la tua risposta..."
                  style={{ fontSize: '1.2rem', padding: '18px' }}
                  autoFocus
                />
              </div>
            )}

            {/* Open Answer */}
            {currentQuestion.type === 'open_answer' && (
              <textarea
                className="form-input"
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                placeholder="Scrivi qui la tua risposta..."
                rows={5}
                style={{ fontSize: '1.1rem', minHeight: '150px' }}
                autoFocus
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '1px solid var(--border)',
        padding: '16px 24px', zIndex: 100,
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
          >
            ← Indietro
          </button>

          {currentIndex < totalQuestions - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
            >
              Avanti →
            </button>
          ) : (
            <button
              className="btn btn-success btn-lg"
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
            >
              Consegna
            </button>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '24px',
        }}>
          <div className="card fade-in" style={{ maxWidth: '450px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '12px' }}>Conferma Consegna</h3>
            <p style={{ marginBottom: '8px' }}>
              Sei sicuro di voler consegnare la verifica?
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Hai risposto a {Object.keys(answers).length} di {totalQuestions} domande.
              {Object.keys(answers).length < totalQuestions && (
                <span style={{ color: 'var(--danger)', display: 'block', marginTop: '4px' }}>
                  Attenzione: ci sono domande senza risposta!
                </span>
              )}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>
                Torna alla verifica
              </button>
              <button
                className="btn btn-success"
                onClick={() => doSubmit(false)}
                disabled={submitting}
              >
                {submitting ? 'Invio...' : 'Consegna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
