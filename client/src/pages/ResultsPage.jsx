import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = '/api'

export default function ResultsPage() {
  const { quizId, teacherLinkId } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [questions, setQuestions] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedStudent, setExpandedStudent] = useState(null)
  const [gradingLoading, setGradingLoading] = useState(false)

  const fetchResults = async () => {
    try {
      const res = await axios.get(`${API}/quizzes/${quizId}/teacher/${teacherLinkId}`)
      setData(res.data)
      setQuestions(res.data.questions || [])
      setSubmissions(res.data.submissions || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Impossibile caricare i risultati.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [quizId, teacherLinkId])

  const gradeAnswer = async (answerId, isCorrect, questionPoints) => {
    setGradingLoading(true)
    try {
      await axios.put(`${API}/answers/${answerId}/grade`, {
        is_correct: isCorrect,
        points_earned: isCorrect ? questionPoints : 0,
      })
      await fetchResults()
    } catch (err) {
      alert('Errore nella valutazione: ' + (err.response?.data?.error || 'Errore sconosciuto'))
    } finally {
      setGradingLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API}/quizzes/${quizId}/results/${teacherLinkId}/export`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `risultati_${data?.title || 'verifica'}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Errore durante l\'esportazione.')
    }
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <p style={{ fontSize: '1.2rem' }}>Caricamento risultati...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="card text-center" style={{ maxWidth: '500px' }}>
          <h2 style={{ marginBottom: '12px' }}>Errore</h2>
          <p>{error}</p>
          <button className="btn btn-ghost mt-3" onClick={() => navigate('/')}>
            ← Torna alla Home
          </button>
        </div>
      </div>
    )
  }

  const scores = submissions.map((s) => s.percentage ?? 0)
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0
  const maxScoreVal = scores.length > 0 ? Math.max(...scores).toFixed(1) : 0
  const minScoreVal = scores.length > 0 ? Math.min(...scores).toFixed(1) : 0

  const getRowColor = (percentage) => {
    if (percentage >= 60) return 'rgba(42, 157, 143, 0.1)'
    if (percentage >= 40) return 'rgba(244, 162, 97, 0.1)'
    return 'rgba(230, 57, 70, 0.1)'
  }

  const getScoreColor = (percentage) => {
    if (percentage >= 60) return 'var(--success)'
    if (percentage >= 40) return 'var(--secondary)'
    return 'var(--danger)'
  }

  const getAnswerStatus = (answer) => {
    if (answer.is_correct === null) return 'pending'
    return answer.is_correct ? 'correct' : 'incorrect'
  }

  const getAnswerBg = (status) => {
    if (status === 'correct') return '#E8F5E9'
    if (status === 'incorrect') return '#FFEBEE'
    return '#FFF8E1'
  }

  const getAnswerBorder = (status) => {
    if (status === 'correct') return '#4CAF50'
    if (status === 'incorrect') return '#F44336'
    return '#FFC107'
  }

  const getQuestionById = (qId) => questions.find((q) => q.id === qId)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '16px 24px' }}>
        <div className="container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Home
          </button>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Risultati</h2>
          <button className="btn btn-success btn-sm" onClick={handleExport}>
            Esporta Excel
          </button>
        </div>
      </div>

      <div className="container-wide">
        <div className="card text-center" style={{ marginBottom: '24px', marginTop: '24px' }}>
          <h2 style={{ marginBottom: '8px' }}>{data?.title || 'Verifica'}</h2>
          {data?.description && <p style={{ marginBottom: '16px' }}>{data.description}</p>}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)' }}>{submissions.length}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Studenti</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--secondary)' }}>{avgScore}%</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Media</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)' }}>{maxScoreVal}%</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Massimo</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--danger)' }}>{minScoreVal}%</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Minimo</div>
            </div>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="card text-center" style={{ padding: '48px' }}>
            <h3 style={{ marginBottom: '8px' }}>Nessuna consegna ancora</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Gli studenti non hanno ancora completato la verifica.
            </p>
            <button className="btn btn-outline btn-sm mt-3" onClick={fetchResults}>
              Aggiorna
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px 160px',
              padding: '16px 20px', background: 'var(--bg)', fontWeight: '600',
              fontSize: '0.9rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
            }}>
              <div>Nome</div>
              <div>Cognome</div>
              <div style={{ textAlign: 'center' }}>Punteggio</div>
              <div style={{ textAlign: 'center' }}>%</div>
              <div style={{ textAlign: 'center' }}>Data</div>
            </div>

            {submissions.map((sub) => (
              <div key={sub.id}>
                <div
                  onClick={() => setExpandedStudent(expandedStudent === sub.id ? null : sub.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px 160px',
                    padding: '16px 20px', cursor: 'pointer',
                    background: getRowColor(sub.percentage ?? 0),
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.2s',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontWeight: '500' }}>{sub.student_name}</div>
                  <div style={{ fontWeight: '500' }}>{sub.student_surname}</div>
                  <div style={{ textAlign: 'center', fontWeight: '600' }}>
                    {sub.score ?? '-'} / {sub.max_score ?? '-'}
                  </div>
                  <div style={{
                    textAlign: 'center', fontWeight: '700',
                    color: getScoreColor(sub.percentage ?? 0),
                  }}>
                    {sub.percentage != null ? `${sub.percentage}%` : '-'}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('it-IT', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }) : '-'}
                  </div>
                </div>

                {expandedStudent === sub.id && (
                  <div className="fade-in" style={{ padding: '20px', background: 'white', borderBottom: '2px solid var(--border)' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.05rem' }}>
                      Risposte di {sub.student_name} {sub.student_surname}
                    </h3>
                    {(sub.answers || []).map((answer, ai) => {
                      const question = getQuestionById(answer.question_id)
                      const status = getAnswerStatus(answer)
                      const questionPoints = question?.points || 1

                      return (
                        <div key={answer.id || ai} style={{
                          padding: '14px', marginBottom: '10px', borderRadius: 'var(--radius-sm)',
                          background: getAnswerBg(status),
                          border: `1px solid ${getAnswerBorder(status)}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                              {ai + 1}. {question?.text || 'Domanda'}
                            </span>
                            <span style={{
                              padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
                              background: status === 'correct' ? '#4CAF50' : status === 'incorrect' ? '#F44336' : '#FFC107',
                              color: 'white', whiteSpace: 'nowrap', marginLeft: '8px',
                            }}>
                              {status === 'correct' ? 'Corretto' : status === 'incorrect' ? 'Errato' : 'Da Correggere'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.9rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Risposta: </span>
                            <span style={{ fontWeight: '500' }}>
                              {typeof answer.student_answer === 'object'
                                ? JSON.stringify(answer.student_answer)
                                : (answer.student_answer || '(nessuna risposta)')}
                            </span>
                          </div>
                          {question?.correct_answer && status !== 'pending' && (
                            <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Risposta corretta: </span>
                              <span style={{ fontWeight: '500', color: 'var(--success)' }}>
                                {typeof question.correct_answer === 'object'
                                  ? JSON.stringify(question.correct_answer)
                                  : question.correct_answer}
                              </span>
                            </div>
                          )}

                          {status === 'pending' && (
                            <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  gradeAnswer(answer.id, true, questionPoints)
                                }}
                                disabled={gradingLoading}
                                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                              >
                                Segna Corretto
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  gradeAnswer(answer.id, false, questionPoints)
                                }}
                                disabled={gradingLoading}
                                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                              >
                                Segna Errato
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {submissions.length > 0 && (
          <div className="text-center mt-3 mb-4">
            <button className="btn btn-outline btn-sm" onClick={fetchResults}>
              Aggiorna Risultati
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
