'use client'

export function NoctwaveLogo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="nw-frame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16181F" />
          <stop offset="100%" stopColor="#0A0B0F" />
        </linearGradient>
        <filter id="nw-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0.5" y="0.5" width="27" height="27" rx="6" fill="url(#nw-frame)" stroke="rgba(255,45,85,0.35)" />
      <line x1="3" y1="22.5" x2="25" y2="22.5" stroke="rgba(255,45,85,0.35)" strokeWidth="0.6" />
      <path
        d="M3 14 Q 7 6, 11 14 T 19 14 T 25 14"
        fill="none"
        stroke="#FF2D55"
        strokeWidth="1.6"
        strokeLinecap="round"
        filter="url(#nw-glow)"
      />
      <path
        d="M3 17 Q 7 11, 11 17 T 19 17 T 25 17"
        fill="none"
        stroke="rgba(255,45,85,0.25)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path d="M22 2 L26 2 L26 6" fill="none" stroke="#FF2D55" strokeWidth="0.8" />
    </svg>
  )
}
