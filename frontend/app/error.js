'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Sentinel Engine Error:', error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#020617',
      color: '#ef4444',
      fontFamily: 'var(--font-brand), sans-serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '10px', textShadow: '0 0 10px rgba(239, 68, 68, 0.5)' }}>SYSTEM FAILURE</h1>
      <p style={{ opacity: 0.8, fontFamily: 'var(--font-sans), sans-serif', maxWidth: '600px', marginBottom: '30px' }}>
        A critical failure occurred in the Sentinel Command HUD. The connection to the simulation engine may have been lost.
      </p>
      
      <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '4px', border: '1px solid #ef4444', marginBottom: '30px', fontFamily: 'var(--font-mono), monospace', fontSize: '12px', color: '#fca5a5' }}>
        {error.message || 'Unknown exception'}
      </div>

      <button
        onClick={() => reset()}
        style={{
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '4px',
          fontFamily: 'var(--font-brand), sans-serif',
          fontWeight: 'bold',
          cursor: 'pointer',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)'
        }}
      >
        REBOOT SYSTEM
      </button>
    </div>
  )
}
