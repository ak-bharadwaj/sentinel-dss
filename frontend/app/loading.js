export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#020617',
      color: '#22c55e',
      fontFamily: 'var(--font-brand), sans-serif'
    }}>
      <div className="welcome-scanner" style={{ marginBottom: '20px' }}>
        <div className="scanner-line"></div>
      </div>
      <h2 style={{ letterSpacing: '2px', textTransform: 'uppercase' }}>Initializing Sentinel HUD...</h2>
      <p style={{ opacity: 0.7, fontFamily: 'var(--font-mono), monospace', fontSize: '14px', marginTop: '10px' }}>
        Establishing connection to command network...
      </p>
    </div>
  )
}
