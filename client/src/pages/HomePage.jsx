import { useNavigate } from 'react-router-dom'

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'linear-gradient(135deg, #FFF8F0 0%, #FFF0E0 100%)',
  },
  logo: {
    fontSize: '3.5rem',
    marginBottom: '8px',
  },
  title: {
    fontSize: '2.8rem',
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: '8px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#6B6B6B',
    marginBottom: '48px',
    textAlign: 'center',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    width: '100%',
    maxWidth: '400px',
  },
  studentNote: {
    marginTop: '48px',
    padding: '24px',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #E8E0D8',
    maxWidth: '500px',
    textAlign: 'center',
  },
  studentNoteTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#2D2D2D',
    marginBottom: '8px',
  },
  studentNoteText: {
    fontSize: '0.95rem',
    color: '#6B6B6B',
    lineHeight: '1.5',
  },
}

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div style={styles.page}>
      <div style={styles.logo}>📝</div>
      <h1 style={styles.title}>Quiz Verifiche</h1>
      <p style={styles.subtitle}>Crea e gestisci verifiche in modo semplice</p>

      <div style={styles.buttonGroup}>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => navigate('/teacher')}
          style={{ width: '100%' }}
        >
          📋 Crea una Verifica
        </button>
      </div>

      <div style={styles.studentNote}>
        <p style={styles.studentNoteTitle}>🎓 Sei uno studente?</p>
        <p style={styles.studentNoteText}>
          Per svolgere una verifica, hai bisogno del link che ti fornisce il tuo insegnante.
          Chiedi al tuo professore il link della verifica.
        </p>
      </div>
    </div>
  )
}
