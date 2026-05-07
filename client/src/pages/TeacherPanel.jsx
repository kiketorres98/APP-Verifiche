import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = '/api'

const TIMER_OPTIONS = [
  { value: 0, label: 'Nessun limite' },
  { value: 10, label: '10 minuti' },
  { value: 15, label: '15 minuti' },
  { value: 20, label: '20 minuti' },
  { value: 30, label: '30 minuti' },
  { value: 45, label: '45 minuti' },
  { value: 60, label: '60 minuti' },
]

const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Scelta Multipla',
  true_false: 'Vero o Falso',
  fill_blank: 'Completamento',
  open_answer: 'Risposta Aperta',
  matching: 'Abbinamento',
}

const TEACHER_PASSWORD = '333Madrid03'

export default function TeacherPanel() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem('teacher_auth') === 'true'
  )
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimit, setTimeLimit] = useState(0)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdQuiz, setCreatedQuiz] = useState(null)
  const [copied, setCopied] = useState('')

  const handleLogin = () => {
    if (passwordInput === TEACHER_PASSWORD) {
      setAuthenticated(true)
      sessionStorage.setItem('teacher_auth', 'true')
      setPasswordError('')
    } else {
      setPasswordError('Password errata')
    }
  }

  const handleFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await axios.post(`${API}/quizzes/parse-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setQuestions(res.data.questions || [])
      const fileName = selectedFile.name.replace(/\.(xlsx|xls)$/i, '')
      setTitle(fileName)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Errore durante il caricamento del file. Verifica che sia un file Excel valido.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFile(droppedFile)
  }, [handleFile])

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleManualStart = () => {
    setQuestions([])
    setStep(2)
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const updateOption = (qIndex, optIndex, value) => {
    const updated = [...questions]
    const opts = [...(updated[qIndex].options || [])]
    opts[optIndex] = value
    updated[qIndex] = { ...updated[qIndex], options: opts }
    setQuestions(updated)
  }

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleCreate = async () => {
    setLoading(true)
    setError('')

    try {
      const payload = {
        title,
        description: description || null,
        time_limit_minutes: timeLimit || null,
        questions: questions.map((q, idx) => ({
          type: q.type,
          text: q.text,
          options: q.options ? JSON.stringify(q.options) : null,
          correct_answer: q.correct_answer || '',
          points: q.points || 1,
          order_num: idx + 1,
        })),
      }

      const res = await axios.post(`${API}/quizzes`, payload)
      const baseUrl = window.location.origin
      setCreatedQuiz({
        id: res.data.id,
        teacher_link_id: res.data.teacher_link_id,
        studentLink: `${baseUrl}/quiz/${res.data.id}`,
        teacherLink: `${baseUrl}/teacher/results/${res.data.id}/${res.data.teacher_link_id}`,
      })
      setStep(5)
    } catch (err) {
      setError(err.response?.data?.error || 'Errore nella creazione della verifica.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    }
  }

  const stepLabels = ['Carica', 'Configura', 'Anteprima', 'Crea']

  if (!authenticated) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="card text-center" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 style={{ marginBottom: '8px' }}>Pannello Insegnante</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            Inserisci la password per accedere
          </p>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <input
              className="form-input"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Password"
              style={{ textAlign: 'center', fontSize: '1.1rem' }}
            />
          </div>
          {passwordError && (
            <p style={{ color: 'var(--danger)', marginBottom: '16px', fontWeight: '500' }}>
              {passwordError}
            </p>
          )}
          <button className="btn btn-primary btn-lg" onClick={handleLogin} style={{ width: '100%' }}>
            Accedi
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ marginTop: '16px' }}>
            ← Torna alla Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '16px 24px' }}>
        <div className="container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Torna alla Home
          </button>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Crea Verifica</h2>
          <div style={{ width: 140 }} />
        </div>
      </div>

      {step < 5 && (
        <div className="container" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px', marginTop: '16px' }}>
            {stepLabels.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '0.9rem',
                  background: step > i + 1 ? 'var(--success)' : step === i + 1 ? 'var(--primary)' : 'var(--border)',
                  color: step >= i + 1 ? 'white' : 'var(--text-muted)',
                }}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: '0.9rem', fontWeight: step === i + 1 ? '600' : '400',
                  color: step === i + 1 ? 'var(--text)' : 'var(--text-muted)',
                }}>
                  {label}
                </span>
                {i < 3 && <div style={{ width: 40, height: 2, background: step > i + 1 ? 'var(--success)' : 'var(--border)', margin: '0 4px' }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="container">
        {error && (
          <div className="fade-in" style={{
            background: '#FEE', border: '1px solid #E63946', borderRadius: 'var(--radius-sm)',
            padding: '16px', marginBottom: '24px', color: '#C0392B', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="fade-in">
            <div className="card text-center" style={{ marginBottom: '20px' }}>
              <h2 style={{ marginBottom: '8px' }}>Carica il tuo file Excel</h2>
              <p style={{ marginBottom: '24px' }}>Prepara le domande in un file Excel e caricalo qui</p>

              <a
                href={`${API}/template`}
                download
                className="btn btn-outline btn-sm"
                style={{ marginBottom: '24px' }}
              >
                Scarica Template Excel
              </a>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `3px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  padding: '48px 24px',
                  cursor: 'pointer',
                  background: dragOver ? 'rgba(230, 57, 70, 0.05)' : 'var(--bg)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>
                  {loading ? '...' : file ? '✓' : ''}
                </div>
                <p style={{ fontWeight: '600', fontSize: '1.1rem', color: 'var(--text)' }}>
                  {loading ? 'Caricamento in corso...' : file ? file.name : 'Trascina qui il file Excel'}
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  oppure clicca per selezionare un file (.xlsx)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </div>

            <div className="text-center">
              <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>oppure</p>
              <button className="btn btn-ghost" onClick={handleManualStart}>
                Inserisci titolo manualmente (senza Excel)
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <div className="fade-in">
            <div className="card">
              <h2 style={{ marginBottom: '24px' }}>Configura la Verifica</h2>

              <div className="form-group">
                <label className="form-label">Titolo della Verifica *</label>
                <input
                  className="form-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Es: Verifica di Spagnolo - Unidad 3"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descrizione (opzionale)</label>
                <textarea
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Istruzioni aggiuntive per gli studenti..."
                  rows={3}
                  style={{ minHeight: '80px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tempo massimo</label>
                <select
                  className="form-input"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                >
                  {TIMER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginTop: '32px' }}>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>
                  ← Indietro
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setStep(3)}
                  disabled={!title.trim()}
                >
                  Avanti →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preview Questions */}
        {step === 3 && (
          <div className="fade-in">
            <div className="card" style={{ marginBottom: '20px' }}>
              <h2 style={{ marginBottom: '8px' }}>Anteprima Domande</h2>
              <p style={{ marginBottom: '24px' }}>
                {questions.length > 0
                  ? `${questions.length} domande caricate. Puoi modificarle prima di creare la verifica.`
                  : 'Nessuna domanda caricata dal file.'
                }
              </p>

              {questions.map((q, qi) => (
                <div key={qi} className="slide-in" style={{
                  background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                  padding: '20px', marginBottom: '16px', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{
                      background: 'var(--primary)', color: 'white',
                      padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                    }}>
                      {QUESTION_TYPE_LABELS[q.type] || q.type} - Domanda {qi + 1}
                    </span>
                    <button
                      onClick={() => removeQuestion(qi)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--danger)',
                        cursor: 'pointer', fontSize: '1.2rem', padding: '4px 8px',
                      }}
                    >
                      X
                    </button>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>Testo della domanda</label>
                    <input
                      className="form-input"
                      value={q.text || ''}
                      onChange={(e) => updateQuestion(qi, 'text', e.target.value)}
                      style={{ fontSize: '1rem' }}
                    />
                  </div>

                  {q.type === 'multiple_choice' && q.options && (
                    <div>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Opzioni</label>
                      {q.options.map((opt, oi) => (
                        <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8rem', fontWeight: '700', flexShrink: 0,
                            background: q.correct_answer === opt ? 'var(--success)' : 'var(--border)',
                            color: q.correct_answer === opt ? 'white' : 'var(--text)',
                          }}>
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <input
                            className="form-input"
                            value={opt}
                            onChange={(e) => updateOption(qi, oi, e.target.value)}
                            style={{ fontSize: '0.95rem', padding: '10px 14px' }}
                          />
                        </div>
                      ))}
                      <div style={{ marginTop: '8px' }}>
                        <label className="form-label" style={{ fontSize: '0.85rem' }}>Risposta corretta</label>
                        <select
                          className="form-input"
                          value={q.correct_answer || ''}
                          onChange={(e) => updateQuestion(qi, 'correct_answer', e.target.value)}
                          style={{ fontSize: '0.95rem' }}
                        >
                          <option value="">-- Seleziona --</option>
                          {(q.options || []).map((opt, oi) => (
                            <option key={oi} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {q.type === 'true_false' && (
                    <div>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Risposta corretta</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {['Vero', 'Falso'].map((val) => (
                          <button
                            key={val}
                            className={`btn ${q.correct_answer === val ? 'btn-success' : 'btn-ghost'} btn-sm`}
                            onClick={() => updateQuestion(qi, 'correct_answer', val)}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.type === 'fill_blank' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem' }}>Risposta corretta (separa alternative con virgola)</label>
                      <input
                        className="form-input"
                        value={q.correct_answer || ''}
                        onChange={(e) => updateQuestion(qi, 'correct_answer', e.target.value)}
                        style={{ fontSize: '0.95rem' }}
                      />
                    </div>
                  )}

                  {q.type === 'open_answer' && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Le risposte aperte saranno corrette manualmente dall'insegnante.
                    </p>
                  )}

                  <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.85rem' }}>Punti</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      value={q.points || 1}
                      onChange={(e) => updateQuestion(qi, 'points', Number(e.target.value))}
                      style={{ width: '100px', fontSize: '0.95rem' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}>
                ← Indietro
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(4)}
                disabled={questions.length === 0}
              >
                Avanti →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="fade-in">
            <div className="card text-center">
              <h2 style={{ marginBottom: '16px' }}>Tutto pronto!</h2>
              <p style={{ marginBottom: '32px' }}>
                Verifica: <strong>{title}</strong><br />
                {questions.length} domande<br />
                {timeLimit > 0 && <>Tempo: {timeLimit} minuti<br /></>}
                {description && <>Descrizione: {description}</>}
              </p>

              <button
                className="btn btn-primary btn-lg"
                onClick={handleCreate}
                disabled={loading}
                style={{ minWidth: '250px' }}
              >
                {loading ? 'Creazione in corso...' : 'Crea Verifica!'}
              </button>

              <div style={{ marginTop: '24px' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(3)}>
                  ← Torna indietro
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 5 && createdQuiz && (
          <div className="fade-in">
            <div className="card text-center">
              <h2 style={{ marginBottom: '8px', color: 'var(--success)' }}>Verifica Creata!</h2>
              <p style={{ marginBottom: '32px' }}>Condividi il link con i tuoi studenti</p>

              <div style={{
                background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                padding: '20px', marginBottom: '16px', border: '1px solid var(--border)',
              }}>
                <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
                  Link per gli Studenti
                </p>
                <div style={{
                  background: 'white', padding: '12px 16px', borderRadius: '8px',
                  border: '1px solid var(--border)', wordBreak: 'break-all',
                  fontSize: '0.9rem', color: 'var(--text-light)', marginBottom: '12px',
                }}>
                  {createdQuiz.studentLink}
                </div>
                <button
                  className={`btn ${copied === 'student' ? 'btn-success' : 'btn-primary'}`}
                  onClick={() => copyToClipboard(createdQuiz.studentLink, 'student')}
                  style={{ width: '100%' }}
                >
                  {copied === 'student' ? 'Copiato!' : 'Copia Link Studenti'}
                </button>
              </div>

              <div style={{
                background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                padding: '20px', marginBottom: '24px', border: '1px solid var(--border)',
              }}>
                <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
                  Link per Vedere i Risultati
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Salva questo link! Ti serve per vedere i risultati degli studenti.
                </p>
                <div style={{
                  background: 'white', padding: '12px 16px', borderRadius: '8px',
                  border: '1px solid var(--border)', wordBreak: 'break-all',
                  fontSize: '0.9rem', color: 'var(--text-light)', marginBottom: '12px',
                }}>
                  {createdQuiz.teacherLink}
                </div>
                <button
                  className={`btn ${copied === 'teacher' ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => copyToClipboard(createdQuiz.teacherLink, 'teacher')}
                  style={{ width: '100%' }}
                >
                  {copied === 'teacher' ? 'Copiato!' : 'Copia Link Risultati'}
                </button>
              </div>

              <div style={{
                background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                padding: '20px', marginBottom: '24px', border: '1px solid var(--border)',
              }}>
                <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
                  Invia il link via Email
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Apri la tua email con il link della verifica già pronto da inviare
                </p>
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Verifica: ${title}`)}&body=${encodeURIComponent(`Ciao!\n\nEcco il link per completare la verifica "${title}":\n\n${createdQuiz.studentLink}\n\nBuon lavoro!`)}`}
                  className="btn btn-secondary"
                  style={{ width: '100%', display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}
                >
                  Invia via Email
                </a>
              </div>

              <button className="btn btn-ghost" onClick={() => navigate('/')}>
                ← Torna alla Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
