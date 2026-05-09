'use client'
import Hls from 'hls.js'
import { useEffect, useRef } from 'react'
import { decryptContent } from '@/lib/crypto'
import { EncryptionBadge } from './ui/EncryptionBadge'
import { Spinner } from './ui/Spinner'

interface Props {
  manifestCID: string
  contentKey: Uint8Array | null
  state?: 'loading' | 'decrypting' | 'playing'
}

export function VideoPlayer({ manifestCID, contentKey, state = 'playing' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const gateway = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? 'https://api.gateway.ethswarm.org'

  useEffect(() => {
    if (!contentKey || !videoRef.current || !manifestCID) return
    const video = videoRef.current
    const key = contentKey

    if (hlsRef.current) {
      hlsRef.current.destroy()
    }

    // Custom loader that intercepts TS segments and decrypts them in-flight
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DefaultLoader = Hls.DefaultConfig.loader as any

    class DecryptLoader {
      private inner: InstanceType<typeof DefaultLoader>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(config: any) { this.inner = new DefaultLoader(config) }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      load(context: any, config: any, callbacks: any) {
        const isSegment = !context.url.endsWith('.m3u8') && !context.url.includes('playlist')
        if (!isSegment) {
          this.inner.load(context, config, callbacks)
          return
        }
        const origSuccess = callbacks.onSuccess
        this.inner.load(context, config, {
          ...callbacks,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSuccess: (response: any, stats: any, ctx: any, networkDetails: any) => {
            const encrypted = new Uint8Array(response.data as ArrayBuffer)
            const iv = encrypted.slice(0, 12)
            const cipher = encrypted.slice(12)
            decryptContent(cipher, iv, key).then(decrypted => {
              response.data = decrypted.buffer
              origSuccess(response, stats, ctx, networkDetails)
            }).catch(() => {
              origSuccess(response, stats, ctx, networkDetails)
            })
          },
        })
      }

      abort() { this.inner.abort?.() }
      destroy() { this.inner.destroy?.() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get context() { return (this.inner as any).context }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get stats() { return (this.inner as any).stats }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hls = new Hls({ loader: DecryptLoader as any })
    hlsRef.current = hls
    hls.loadSource(`${gateway}/bzz/${manifestCID}`)
    hls.attachMedia(video)

    return () => { hls.destroy(); hlsRef.current = null }
  }, [manifestCID, contentKey, gateway])

  return (
    <div
      style={{
        position: 'relative',
        background: '#000',
        borderRadius: 'var(--r-12)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        aspectRatio: '16 / 9',
      }}
    >
      <video
        ref={videoRef}
        controls
        style={{ width: '100%', height: '100%', display: state === 'playing' ? 'block' : 'none' }}
      />

      {(state === 'loading' || state === 'decrypting') && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--text)',
          background: 'rgba(10,11,15,0.6)',
          backdropFilter: 'blur(8px)',
        }}>
          <Spinner size={20} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {state === 'loading' ? 'Fetching from Swarm…' : 'Decrypting in your browser…'}
          </span>
        </div>
      )}

      {state === 'playing' && (
        <div style={{ position: 'absolute', top: 14, left: 14, pointerEvents: 'none' }}>
          <EncryptionBadge state="decrypted">Decrypted in your browser</EncryptionBadge>
        </div>
      )}
    </div>
  )
}
