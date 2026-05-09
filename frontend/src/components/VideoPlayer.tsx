'use client'
import { useEffect, useRef, useState } from 'react'
import { decryptContent } from '@/lib/crypto'
import { EncryptionBadge } from './ui/EncryptionBadge'
import { Spinner } from './ui/Spinner'

interface Props {
  manifestCID: string
  contentKey: Uint8Array | null
}

export function VideoPlayer({ manifestCID, contentKey }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const blobUrlRef = useRef<string | null>(null)
  const [playerState, setPlayerState] = useState<'loading' | 'decrypting' | 'playing' | 'error'>('loading')
  const gateway = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? 'https://bzz.limo'

  useEffect(() => {
    if (!contentKey || !manifestCID) return
    let cancelled = false

    async function fetchAndDecrypt() {
      if (!contentKey) return
      setPlayerState('loading')
      try {
        // Fetch encrypted blob from Swarm gateway
        const res = await fetch(`${gateway}/bzz/${manifestCID}`)
        if (!res.ok) throw new Error(`Swarm fetch failed: ${res.status}`)
        const encrypted = new Uint8Array(await res.arrayBuffer())

        if (cancelled) return
        setPlayerState('decrypting')

        // Split IV (first 12 bytes) from ciphertext
        const iv = encrypted.slice(0, 12)
        const ciphertext = encrypted.slice(12)
        const decrypted = await decryptContent(ciphertext, iv, contentKey)

        if (cancelled) return

        // Revoke previous blob URL to free memory
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)

        const blob = new Blob([decrypted.buffer as ArrayBuffer], { type: 'video/mp4' })
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url

        if (videoRef.current) {
          videoRef.current.src = url
          videoRef.current.load()
        }
        setPlayerState('playing')
      } catch (err) {
        console.error('VideoPlayer error:', err)
        if (!cancelled) setPlayerState('error')
      }
    }

    fetchAndDecrypt()
    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [manifestCID, contentKey, gateway])

  return (
    <div style={{
      position: 'relative',
      background: '#000',
      borderRadius: 'var(--r-12)',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      aspectRatio: '16 / 9',
    }}>
      <video
        ref={videoRef}
        controls
        style={{ width: '100%', height: '100%', display: playerState === 'playing' ? 'block' : 'none' }}
      />

      {(playerState === 'loading' || playerState === 'decrypting') && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          background: 'rgba(10,11,15,0.6)', backdropFilter: 'blur(8px)',
        }}>
          <Spinner size={20} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {playerState === 'loading' ? 'Fetching from Swarm…' : 'Decrypting in your browser…'}
          </span>
        </div>
      )}

      {playerState === 'error' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 13,
        }}>
          Could not load video.
        </div>
      )}

      {playerState === 'playing' && (
        <div style={{ position: 'absolute', top: 14, left: 14, pointerEvents: 'none' }}>
          <EncryptionBadge state="decrypted">Decrypted in your browser</EncryptionBadge>
        </div>
      )}
    </div>
  )
}
