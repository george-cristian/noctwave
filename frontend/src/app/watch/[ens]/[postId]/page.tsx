'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { parseAbi } from 'viem'
import { AppHeader } from '@/components/AppHeader'
import { Avatar } from '@/components/ui/Avatar'
import { VideoPlayer } from '@/components/VideoPlayer'
import { StreamBalance } from '@/components/StreamBalance'
import { SubscribeButton } from '@/components/SubscribeButton'
import { Spinner } from '@/components/ui/Spinner'
import { useIsSubscribed, useCreatorVault } from '@/hooks/useContracts'
import { deriveSharedSecret, decryptKey } from '@/lib/crypto'
import { fetchEncryptedKey } from '@/lib/keyDelivery'
import { feedReadJson, TOPIC_NAMES } from '@/lib/swarmClient'
import { ensClient } from '@/lib/ensClient'
import type { PostMetadata, CreatorFeed } from '@/lib/types'

type SubState = 'idle' | 'confirming' | 'streaming'

const REGISTRAR_ABI = parseAbi([
  'function resolve(string label) view returns (address)',
  'function getTextRecord(string label, string key) view returns (string)',
])

function formatUSDC(n: number, places = 7) { return n.toFixed(places) }

// Creator's content key is stored in localStorage during upload
function loadCreatorKey(manifestCID: string): Uint8Array | null {
  try {
    const b64 = localStorage.getItem(`noctwave-key-${manifestCID}`)
    if (!b64) return null
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  } catch { return null }
}

export default function WatchPage() {
  const params = useParams()
  const router = useRouter()
  const ens = params.ens as string
  const postId = params.postId as string

  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [subState, setSubState] = useState<SubState>('idle')
  const [streamSince, setStreamSince] = useState<Date | undefined>()
  const [contentKey, setContentKey] = useState<Uint8Array | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  const [post, setPost] = useState<PostMetadata | null>(null)
  const [creatorAddress, setCreatorAddress] = useState<`0x${string}` | null>(null)
  const [monthlyPrice, setMonthlyPrice] = useState(0)
  const [loadingPost, setLoadingPost] = useState(true)

  // Is the connected wallet the creator of this content?
  const isCreator = !!(address && creatorAddress &&
    address.toLowerCase() === creatorAddress.toLowerCase())

  // Load creator address + post metadata from registrar + Swarm Feed
  useEffect(() => {
    let cancelled = false
    const registrarAddress = process.env.NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS as `0x${string}`

    async function load() {
      try {
        const addr = await ensClient.readContract({
          address: registrarAddress,
          abi: REGISTRAR_ABI,
          functionName: 'resolve',
          args: [ens],
        }) as `0x${string}`

        if (!addr || addr === '0x0000000000000000000000000000000000000000') return
        if (cancelled) return
        setCreatorAddress(addr)

        const priceStr = await ensClient.readContract({
          address: registrarAddress,
          abi: REGISTRAR_ABI,
          functionName: 'getTextRecord',
          args: [ens, 'price'],
        }) as string
        if (!cancelled) setMonthlyPrice(Number(priceStr) || 0)

        // Read creator's Swarm Feed — primary source of truth
        const feed = await feedReadJson<CreatorFeed>(TOPIC_NAMES.CONTENT_ROOT, addr)
        const found = feed.posts.find(p => p.id === postId)
        if (!cancelled) setPost(found ?? null)
      } catch (err) {
        console.error('[watch] Failed to load post:', err)
      } finally {
        if (!cancelled) setLoadingPost(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [ens, postId])

  // If the viewer is the creator, load their content key directly from localStorage
  useEffect(() => {
    if (!isCreator || !post) return
    const key = loadCreatorKey(post.manifest_cid)
    if (key) setContentKey(key)
  }, [isCreator, post])

  const { data: vaultAddress } = useCreatorVault(creatorAddress ?? undefined)
  const isSubscribed = useIsSubscribed(address, vaultAddress as `0x${string}` | undefined)

  // Auto-decrypt if already subscribed (subscriber flow)
  useEffect(() => {
    if (isCreator) return  // creator doesn't need subscription
    if (isSubscribed && subState === 'idle' && post && creatorAddress) {
      setSubState('streaming')
      setStreamSince(new Date())
      handleDecrypt()
    }
  }, [isSubscribed, post, creatorAddress, isCreator]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDecrypt() {
    if (!address || !post || !creatorAddress) return
    try {
      const encryptedKey = await fetchEncryptedKey({
        creatorAddress,
        subscriberAddress: address,
        postCID: post.manifest_cid,
      })
      if (!encryptedKey) return

      const sharedSecret = await deriveSharedSecret(
        creatorAddress,
        post.manifest_cid,
        msg => signMessageAsync({ message: msg })
      )
      const key = await decryptKey(encryptedKey, sharedSecret)
      setContentKey(key)
    } catch (err) {
      console.error('Decrypt failed:', err)
    }
  }

  function handleSubscribeSuccess() {
    setSubState('streaming')
    setStreamSince(new Date())
    setCelebrate(true)
    setTimeout(() => setCelebrate(false), 700)
    setTimeout(() => handleDecrypt(), 1200)
  }

  function handleStop() {
    setSubState('idle')
    setContentKey(null)
    setStreamSince(undefined)
  }

  // Creator always sees the video; subscribers need an active stream
  const canWatch = isCreator || subState === 'streaming'

  if (loadingPost) {
    return (
      <>
        <AppHeader />
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <Spinner />
        </div>
      </>
    )
  }

  if (!post) {
    return (
      <>
        <AppHeader />
        <div className="page">
          <div className="shell" style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>
            <p>Post not found.</p>
            <button className="btn btn-ghost" onClick={() => router.push('/')}>← Back to discover</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader />
      <div className="page">
        <div className="shell">
          <button
            onClick={() => router.back()}
            className="btn btn-sm"
            style={{ color: 'var(--text-muted)', marginBottom: 24, paddingLeft: 0 }}
          >
            ← Back
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 32, alignItems: 'start' }} className="watch-grid">

            {/* Left: video */}
            <div style={{
              transform: celebrate ? 'scale(1.005)' : 'scale(1)',
              transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}>
              {!canWatch ? (
                <div
                  className="nw-enter"
                  style={{
                    position: 'relative', aspectRatio: '16/9',
                    borderRadius: 'var(--r-12)', overflow: 'hidden',
                    border: '1px solid var(--border)', background: '#000',
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 40% 40%, rgba(255,45,85,0.18), transparent 60%)', filter: 'blur(28px)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.25), rgba(0,0,0,0.6))' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 999, background: 'rgba(232,234,238,0.06)', border: '1px solid rgba(232,234,238,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="var(--text-muted)" strokeWidth="1.4" />
                        <path d="M5 7V5a3 3 0 016 0v2" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 18, color: 'var(--text)', fontWeight: 500 }}>Encrypted on Swarm</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360 }}>
                      Subscribe to begin a payment stream. Your browser decrypts the video locally.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="nw-enter">
                  <VideoPlayer manifestCID={post.manifest_cid} contentKey={contentKey} />
                </div>
              )}

              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h1 className="display" style={{ fontSize: 28, margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em' }}>
                  {post.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Avatar seed={ens} size={32} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>{ens}.noctwave.eth</span>
                    <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {post.views.toLocaleString()} views · {new Date(post.published_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    {isCreator && (
                      <span className="pill" style={{ color: 'var(--success)' }}>Your video</span>
                    )}
                    <span className="pill">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6" /></svg>
                      Swarm
                    </span>
                  </div>
                </div>
                {post.description && (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.65 }}>
                    {post.description}
                  </p>
                )}
              </div>
            </div>

            {/* Right: creator info or subscribe sidebar */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 84 }}>
              {isCreator ? (
                <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="eyebrow">Creator view</span>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    You are watching your own video. Subscribers see this content after opening a payment stream.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    {[
                      { label: 'Price', value: `$${monthlyPrice}/month` },
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
              ) : subState !== 'streaming' ? (
                <div className="nw-enter card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="eyebrow">Subscription</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span className="num display" style={{ fontSize: 48, color: 'var(--text)' }}>${monthlyPrice}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>/ month</span>
                    </div>
                  </div>

                  <SubscribeButton
                    vaultAddress={(vaultAddress as `0x${string}`) ?? '0x0000000000000000000000000000000000000000'}
                    monthlyPrice={monthlyPrice}
                    state={subState === 'confirming' ? 'confirming' : 'idle'}
                    onSuccess={handleSubscribeSuccess}
                  />

                  <div style={{ padding: 14, background: 'var(--bg-overlay)', borderRadius: 'var(--r-6)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Per second', value: monthlyPrice ? `$${formatUSDC(monthlyPrice / (30 * 24 * 60 * 60))}` : '—' },
                      { label: 'Network', value: 'Base Sepolia' },
                      { label: 'Storage', value: 'Swarm' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                        <span className="num" style={{ fontSize: 13, color: 'var(--text)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Charged per second while the stream is open. Cancel any time.
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
                    monthlyPrice={monthlyPrice}
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
