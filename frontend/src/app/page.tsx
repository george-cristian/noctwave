'use client'
export const dynamic = 'force-dynamic'
import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { parseAbi } from 'viem'
import { AppHeader } from '@/components/AppHeader'
import { CreatorCard, type Creator } from '@/components/CreatorCard'
import { Spinner } from '@/components/ui/Spinner'

const MOCK_CREATORS: Creator[] = [
  { ens: 'aurelia.noctwave.eth',  subscribers: 1284, price: 8,  bio: 'Field recordings + essays on disappearing radio frequencies.' },
  { ens: 'kovacs.noctwave.eth',   subscribers: 412,  price: 5,  bio: 'Investigative video. Two longforms a month, encrypted end-to-end.' },
  { ens: 'mira.noctwave.eth',     subscribers: 3890, price: 12, bio: 'Cinematographer. Shot on 16mm, paid by the second.' },
  { ens: 'nine.noctwave.eth',     subscribers: 178,  price: 3,  bio: 'Daily voice notes from a country that doesn\'t want me to write.' },
  { ens: 'palette.noctwave.eth',  subscribers: 2104, price: 9,  bio: 'Color theory, slowly. New essay each Sunday.' },
  { ens: 'salim.noctwave.eth',    subscribers: 631,  price: 6,  bio: 'Architecture lectures, recorded in the buildings themselves.' },
  { ens: 'tide.noctwave.eth',     subscribers: 5602, price: 15, bio: 'Long-form documentary, one film a quarter.' },
  { ens: 'verena.noctwave.eth',   subscribers: 219,  price: 4,  bio: 'Synth patches and process tapes. For people who like the wires.' },
]

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'Creator encrypts and publishes',
    body: 'The creator uploads a video. It gets transcoded and encrypted in their browser using AES-256 — the key never leaves their device. The encrypted file is pinned to Swarm, a decentralised storage network. Nobody can watch it without the key.',
  },
  {
    n: '02',
    title: 'You open a payment stream',
    body: 'Hit subscribe and a real-time USDC payment stream opens on Base — charged per second, not per month. The moment your stream is live, Noctwave proves you\'re paying and hands your browser the decryption key for that video.',
  },
  {
    n: '03',
    title: 'Your browser decrypts, live',
    body: 'Segments arrive encrypted over Swarm. Your browser decrypts each one on the fly before it hits the video player. No server ever holds the key or sees your viewing. Stop the stream any second and billing stops instantly.',
  },
  {
    n: '04',
    title: 'Payments are private',
    body: 'Every subscriber gets a unique stealth address (EIP-5564). Earnings land in the creator\'s wallet without linking the creator\'s public identity to their on-chain income. Censorship-resistant publishing, end to end.',
  },
]

const REGISTRAR_ABI = parseAbi(['function ownerToLabel(address) view returns (string)'])
type Filter = 'all' | 'affordable' | 'popular'

export default function DiscoveryPage() {
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const [filter, setFilter] = useState<Filter>('all')
  const [creatorLabel, setCreatorLabel] = useState<string | null>(null)
  const [checkingCreator, setCheckingCreator] = useState(false)

  // Check if connected wallet already has a creator account
  useEffect(() => {
    if (!isConnected || !address) { setCreatorLabel(null); return }
    const registrarAddress = process.env.NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS as `0x${string}`
    if (!registrarAddress) return

    setCheckingCreator(true)
    import('@/lib/ensClient').then(({ ensClient }) => {
      ensClient.readContract({
        address: registrarAddress,
        abi: REGISTRAR_ABI,
        functionName: 'ownerToLabel',
        args: [address],
      }).then(label => {
        setCreatorLabel((label as string) || null)
      }).catch(() => {
        setCreatorLabel(null)
      }).finally(() => setCheckingCreator(false))
    })
  }, [isConnected, address])

  const filtered = useMemo(() => {
    if (filter === 'affordable') return MOCK_CREATORS.filter(c => c.price < 5)
    if (filter === 'popular') return MOCK_CREATORS.filter(c => c.subscribers > 1000)
    return MOCK_CREATORS
  }, [filter])

  return (
    <>
      <AppHeader />
      <div className="page">
        <div className="shell">

          {/* Hero */}
          <section style={{ padding: '40px 0 56px', display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 760, position: 'relative' }}>
            <div aria-hidden="true" style={{
              position: 'absolute',
              inset: '-40px -80px',
              background: 'radial-gradient(600px 240px at 20% 50%, var(--accent-soft), transparent 60%)',
              filter: 'blur(20px)',
              zIndex: 0,
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 28 }}>
              <span className="eyebrow">Censorship-resistant publishing · ETHPrague 2026</span>
              <h1 className="display" style={{
                fontSize: 'clamp(40px, 8vw, 72px)',
                lineHeight: 1.0,
                margin: 0,
                letterSpacing: '-0.045em',
                background: 'linear-gradient(180deg, #F5F7FA 0%, #BFC4CE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Pay per second.<br />Watch forever.<br />Stay unseen.
              </h1>
              <p style={{ fontSize: 18, color: 'var(--text-muted)', margin: 0, maxWidth: 560, lineHeight: 1.55 }}>
                Encrypted video, direct crypto support, and a feed that never turns you into the product.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                {!isConnected ? (
                  <ConnectButton />
                ) : checkingCreator ? (
                  <Spinner />
                ) : creatorLabel ? (
                  <button className="btn btn-primary btn-lg" onClick={() => router.push(`/creator/${creatorLabel}`)}>
                    Go to dashboard
                  </button>
                ) : (
                  <button className="btn btn-primary btn-lg" onClick={() => router.push('/creator/onboard')}>
                    Become a creator
                  </button>
                )}
                <button className="btn btn-ghost btn-lg" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                  How it works
                </button>
              </div>
            </div>
          </section>

          <hr className="hr" />

          {/* Creator grid */}
          <section id="grid" style={{ paddingTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Top creators
              </h2>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { id: 'all' as Filter,        label: 'All' },
                  { id: 'affordable' as Filter, label: 'Under $5' },
                  { id: 'popular' as Filter,    label: 'Most subscribed' },
                ] as const).map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className="btn btn-sm"
                    style={{
                      background: filter === f.id ? 'var(--bg-raised)' : 'transparent',
                      color: filter === f.id ? 'var(--text)' : 'var(--text-muted)',
                      border: '1px solid ' + (filter === f.id ? 'var(--border-bright)' : 'transparent'),
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {filtered.map(c => (
                <CreatorCard
                  key={c.ens}
                  creator={c}
                  onOpen={() => router.push(`/watch/${c.ens}/post_001`)}
                />
              ))}
            </div>
          </section>

          {/* How it works */}
          <section id="how-it-works" style={{ padding: '56px 0 16px' }}>
            <hr className="hr" style={{ marginBottom: 48 }} />
            <h2 style={{ margin: '0 0 32px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>How it works</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {HOW_IT_WORKS.map(step => (
                <div key={step.n} className="card" style={{ padding: '22px 22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="num eyebrow" style={{ color: 'var(--accent)', fontSize: 11 }}>{step.n}</span>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)', lineHeight: 1.3 }}>{step.title}</div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <section style={{
            marginTop: 80,
            padding: '24px 0',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            color: 'var(--text-dim)',
            fontSize: 12,
          }}>
            <span>Noctwave · ETHPrague 2026 demo</span>
            <span className="num">Swarm · ENS · EIP-5564 · Superfluid · Base Sepolia · Ethereum Sepolia</span>
          </section>

        </div>
      </div>
    </>
  )
}
