'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { AppHeader } from '@/components/AppHeader'
import { Avatar } from '@/components/ui/Avatar'
import { EncryptionBadge } from '@/components/ui/EncryptionBadge'
import { VideoPlayer } from '@/components/VideoPlayer'
import { StreamBalance } from '@/components/StreamBalance'
import { SubscribeButton } from '@/components/SubscribeButton'
import { useIsSubscribed, useCreatorVault } from '@/hooks/useContracts'
import { deriveSharedSecret, decryptKey } from '@/lib/crypto'
import { fetchEncryptedKey } from '@/lib/keyDelivery'

type SubState = 'idle' | 'confirming' | 'streaming'
type DecryptState = 'idle' | 'loading' | 'decrypting' | 'playing'

function formatUSDC(n: number, places = 7) {
  return n.toFixed(places)
}

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const ens = params.ens as string
  const postId = params.postId as string

  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [subState, setSubState] = useState<SubState>('idle')
  const [decryptState, setDecryptState] = useState<DecryptState>('idle')
  const [streamSince, setStreamSince] = useState<Date | undefined>()
  const [contentKey, setContentKey] = useState<Uint8Array | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  // Placeholder post data — real version reads from Swarm Feed
  const post = {
    id: postId,
    title: 'River, with no name — chapter 3',
    description: 'A new transmission. Encrypted on Swarm, streamed to subscribers per second on Base.',
    price: 8,
    subscribers: 1820,
    publishedAgo: '2 days ago',
    manifestCID: '',   // fill from Swarm Feed
    thumbnailCID: '',
    creatorAddress: '' as `0x${string}`,
  }

  const { data: vaultAddress } = useCreatorVault(post.creatorAddress || undefined)
  const isSubscribed = useIsSubscribed(
    address,
    vaultAddress as `0x${string}` | undefined
  )

  // When already subscribed on mount, trigger decryption flow
  useEffect(() => {
    if (isSubscribed && subState === 'idle') {
      setSubState('streaming')
      setStreamSince(new Date())
      handleDecrypt()
    }
  }, [isSubscribed]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDecrypt() {
    if (!address || !post.manifestCID) return
    setDecryptState('loading')
    try {
      const gateway = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? 'https://api.gateway.ethswarm.org'
      const encryptedKey = await fetchEncryptedKey({
        creatorAddress: post.creatorAddress,
        subscriberAddress: address,
        postCID: post.manifestCID,
        gatewayUrl: gateway,
      })
      if (!encryptedKey) { setDecryptState('idle'); return }

      setDecryptState('decrypting')
      const sharedSecret = await deriveSharedSecret(
        post.creatorAddress,
        post.manifestCID,
        msg => signMessageAsync({ message: msg })
      )
      const key = await decryptKey(encryptedKey, sharedSecret)
      setContentKey(key)
      setDecryptState('playing')
    } catch (err) {
      console.error('Decrypt failed:', err)
      setDecryptState('idle')
    }
  }

  function handleSubscribeSuccess() {
    setSubState('streaming')
    setStreamSince(new Date())
    setCelebrate(true)
    setTimeout(() => setCelebrate(false), 700)
    setDecryptState('loading')
    setTimeout(() => setDecryptState('decrypting'), 900)
    // After key is fetched and decrypted, state transitions to 'playing' inside handleDecrypt
    setTimeout(() => handleDecrypt(), 900)
  }

  function handleStop() {
    setSubState('idle')
    setDecryptState('idle')
    setContentKey(null)
    setStreamSince(undefined)
  }

  const isSub = subState === 'streaming'

  return (
    <>
      <AppHeader />
      <div className="page">
        <div className="shell">
          <button
            onClick={() => router.push('/')}
            className="btn btn-sm"
            style={{ color: 'var(--text-muted)', marginBottom: 24, paddingLeft: 0 }}
          >
            ← Back to discover
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 32, alignItems: 'start' }} className="watch-grid">

            {/* Left: video or locked placeholder */}
            <div style={{
              position: 'relative',
              transform: celebrate ? 'scale(1.005)' : 'scale(1)',
              transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}>
              {!isSub ? (
                <div
                  className="nw-enter"
                  style={{
                    position: 'relative', aspectRatio: '16/9',
                    borderRadius: 'var(--r-12)', overflow: 'hidden',
                    border: '1px solid var(--border)', background: '#000',
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(ellipse at 40% 40%, rgba(255,45,85,0.18), transparent 60%)`,
                    filter: 'blur(28px)',
                  }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.25), rgba(0,0,0,0.6))' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 999, background: 'rgba(232,234,238,0.06)', border: '1px solid rgba(232,234,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="var(--text-muted)" strokeWidth="1.4" />
                        <path d="M5 7V5a3 3 0 016 0v2" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 18, color: 'var(--text)', fontWeight: 500, letterSpacing: '-0.01em' }}>Encrypted on Swarm</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360 }}>
                      Subscribe to begin a payment stream. Your browser will decrypt segments on the fly.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="nw-enter">
                  <VideoPlayer
                    manifestCID={post.manifestCID}
                    contentKey={contentKey}
                    state={decryptState === 'playing' ? 'playing' : decryptState === 'idle' ? 'loading' : decryptState}
                  />
                </div>
              )}

              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h1 className="display" style={{ fontSize: 32, margin: 0, lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                  {post.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Avatar seed={ens} size={32} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>{ens}</span>
                    <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {post.subscribers.toLocaleString()} subscribers · published {post.publishedAgo}
                    </span>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <span className="pill">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6" /></svg>
                      Swarm
                    </span>
                  </div>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.65 }}>
                  {post.description}
                </p>
              </div>
            </div>

            {/* Right: subscribe CTA or stream balance */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 84 }}>
              {!isSub ? (
                <div className="nw-enter card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="eyebrow">Subscription</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span className="num display" style={{ fontSize: 48, color: 'var(--text)' }}>${post.price}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>/ month</span>
                    </div>
                  </div>

                  <SubscribeButton
                    vaultAddress={(vaultAddress as `0x${string}`) ?? '0x0000000000000000000000000000000000000000'}
                    monthlyPrice={post.price}
                    state={subState === 'confirming' ? 'confirming' : 'idle'}
                    onSuccess={handleSubscribeSuccess}
                  />

                  <div style={{ padding: '14px', background: 'var(--bg-overlay)', borderRadius: 'var(--r-6)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Per second', value: `$${formatUSDC(post.price / (30 * 24 * 60 * 60))}` },
                      { label: 'Network', value: 'Base Sepolia' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                        <span className="num" style={{ fontSize: 13, color: 'var(--text)' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Charged{' '}
                    <span className="num" style={{ color: 'var(--text)' }}>${formatUSDC(post.price / (30 * 24 * 60 * 60))}</span>
                    {' '}per second while the stream is open. Stop any time.
                  </p>
                </div>
              ) : (
                <div className="nw-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {address && vaultAddress && (
                    <StreamBalance
                      sender={address}
                      receiver={vaultAddress as `0x${string}`}
                      since={streamSince}
                    />
                  )}
                  <SubscribeButton
                    vaultAddress={(vaultAddress as `0x${string}`) ?? '0x0000000000000000000000000000000000000000'}
                    monthlyPrice={post.price}
                    state="streaming"
                    onStop={handleStop}
                  />
                  <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Flow → creator', value: ens },
                      { label: 'Cipher', value: 'AES-256-GCM' },
                      { label: 'Storage', value: 'Swarm' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                        <span className="num" style={{ fontSize: 13, color: 'var(--text)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>

          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .watch-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
