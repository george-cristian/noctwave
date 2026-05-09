'use client'

export function EncryptionBadge({
  children = 'Encrypted',
  state = 'default',
}: {
  children?: React.ReactNode
  state?: 'default' | 'decrypted'
}) {
  const isDecrypted = state === 'decrypted'
  return (
    <span
      className="pill"
      style={{
        color: isDecrypted ? 'var(--success)' : 'var(--text-muted)',
        borderColor: isDecrypted ? 'rgba(74,222,128,0.18)' : 'var(--border)',
        background: isDecrypted ? 'rgba(74,222,128,0.06)' : 'var(--bg-overlay)',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {children}
    </span>
  )
}
