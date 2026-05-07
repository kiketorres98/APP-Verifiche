import { useLocation } from 'react-router-dom'

export default function CompletedPage() {
  const location = useLocation()
  const { autoSubmit, score, maxScore, percentage } = location.state || {}

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #FFF8F0 0%, #E8F5E9 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div className="card fade-in text-center" style={{ maxWidth: '500px', width: '100%' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '12px', color: 'var(--success)' }}>
          Verifica Consegnata!
        </h1>

        {autoSubmit && (
          <div style={{
            background: 'rgba(244, 162, 97, 0.15)', border: '1px solid var(--secondary)',
            borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '16px',
          }}>
            <p style={{ color: 'var(--secondary)', fontWeight: '600', fontSize: '0.95rem' }}>
              Il tempo era scaduto. La verifica e stata consegnata automaticamente.
            </p>
          </div>
        )}

        {score !== undefined && (
          <div style={{
            background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
            padding: '24px', border: '1px solid var(--border)', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '3rem', fontWeight: '700', color: 'var(--primary)' }}>
              {percentage != null ? `${percentage}%` : `${score}/${maxScore}`}
            </div>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              {score} su {maxScore} punti
            </p>
          </div>
        )}

        <p style={{ fontSize: '1.15rem', color: 'var(--text-light)', marginBottom: '8px' }}>
          Le tue risposte sono state inviate con successo.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Puoi chiudere questa pagina.
        </p>
      </div>
    </div>
  )
}
