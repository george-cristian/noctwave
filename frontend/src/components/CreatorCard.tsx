'use client'
import { useState, useEffect } from 'react'
import { Avatar, seededGradient } from './ui/Avatar'
import { EncryptionBadge } from './ui/EncryptionBadge'

export interface Creator {
  ens: string
  subscribers: number
  price: number
  bio: string
  thumbnailCid?: string
  thumbs?: string[]
}

export function CreatorCard({
  creator,
  onOpen,
}: {
  creator: Creator
  onOpen?: (creator: Creator) => void
}) {
  const [hover, setHover] = useState(false)
  const [thumbIdx, setThumbIdx] = useState(0)
  const thumbs = creator.thumbs ?? [creator.ens, creator.ens + ':b', creator.ens + ':c']

  useEffect(() => {
    if (!hover || thumbs.length < 2) return
    const t = setTimeout(() => setThumbIdx(i => (i + 1) % thumbs.length), 1400)
    return () => clearTimeout(t)
  }, [hover, thumbIdx, thumbs.length])

  return (
    <button
      className="card"
      onClick={() => onOpen?.(creator)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setThumbIdx(0) }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        textAlign: 'left',
        padding: 0,
        overflow: 'hidden',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'transform 150ms ease-out, border-color 150ms ease-out',
        borderColor: hover ? 'var(--border-bright)' : 'var(--border)',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
        {thumbs.map((t, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              background: seededGradient(creator.ens + ':' + t),
              opacity: i === thumbIdx ? 1 : 0,
              transition: 'opacity 600ms ease-out',
            }}
          >
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(${(creator.ens.length * 17) % 180}deg, transparent 0 12px, rgba(255,255,255,0.04) 12px 13px)`,
            }} />
          </div>
        ))}
        <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', gap: 6 }}>
          <EncryptionBadge>Encrypted</EncryptionBadge>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar seed={creator.ens} size={28} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>{creator.ens}</span>
            <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {creator.subscribers.toLocaleString()} subs
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="num" style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>
              ${creator.price}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/mo</span>
          </div>
        </div>
        <p style={{
          margin: 0,
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {creator.bio}
        </p>
      </div>
    </button>
  )
}
