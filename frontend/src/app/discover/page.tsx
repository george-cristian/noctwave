'use client'
export const dynamic = 'force-dynamic'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { AppHeader } from '@/components/AppHeader'
import { CreatorCard } from '@/components/CreatorCard'
import { Spinner } from '@/components/ui/Spinner'
import { fetchCreators, type DiscoveredCreator } from '@/lib/creators'
import { fetchSubscriptionStatus } from '@/lib/subscriptions'

function CreatorGrid({
  creators,
  router,
}: {
  creators: DiscoveredCreator[]
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {creators.map(c => (
        <CreatorCard
          key={c.ens}
          creator={{
            ens: c.ens,
            price: c.price,
            bio: c.bio,
            postCount: c.postCount,
            thumbnailCid: c.latestPost?.thumbnail_cid,
            hasContent: !!c.latestPost,
          }}
          onOpen={() => router.push(`/creator/${c.label}`)}
        />
      ))}
    </div>
  )
}

export default function DiscoverPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()

  const { data: creators, isLoading: loadingCreators } = useQuery({
    queryKey: ['creators'],
    queryFn: fetchCreators,
    staleTime: 30_000,
  })

  const { data: subscriptions, isLoading: loadingSubs } = useQuery({
    queryKey: ['subscriptions', address, (creators ?? []).map(c => c.owner)],
    queryFn: () => fetchSubscriptionStatus(
      address!,
      (creators ?? []).map(c => c.owner),
    ),
    enabled: !!address && !!creators && creators.length > 0,
    refetchInterval: 15_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const { mySubs, topCreators } = useMemo(() => {
    if (!creators) return { mySubs: [] as DiscoveredCreator[], topCreators: [] as DiscoveredCreator[] }
    const subs = subscriptions ?? {}
    const mine: DiscoveredCreator[] = []
    const others: DiscoveredCreator[] = []
    for (const c of creators) {
      if (address && c.owner.toLowerCase() === address.toLowerCase()) continue  // hide self
      if (subs[c.owner.toLowerCase()]) mine.push(c)
      else others.push(c)
    }
    return { mySubs: mine, topCreators: others }
  }, [creators, subscriptions, address])

  return (
    <>
      <AppHeader />
      <div className="page">
        <div className="shell">

          <section style={{ padding: '32px 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="eyebrow">Discover</span>
            <h1 className="display" style={{ margin: 0, fontSize: 36, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Your subscriptions and what&apos;s new.
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)', maxWidth: 560, lineHeight: 1.6 }}>
              Active streams unlock instantly. Top creators are everyone you&apos;re not already watching.
            </p>
          </section>

          {/* My subscriptions */}
          <section style={{ paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
                My subscriptions
              </h2>
              {isConnected && mySubs.length > 0 && (
                <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {mySubs.length} active
                </span>
              )}
            </div>

            {!isConnected ? (
              <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Connect your wallet to see who you&apos;re currently streaming to.
                </span>
                <ConnectButton />
              </div>
            ) : loadingCreators || loadingSubs ? (
              <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
                <Spinner />
              </div>
            ) : mySubs.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
                No active streams. Pick a creator below to start watching.
              </div>
            ) : (
              <CreatorGrid creators={mySubs} router={router} />
            )}
          </section>

          <hr className="hr" style={{ margin: '48px 0' }} />

          {/* Top creators */}
          <section>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
                Top creators
              </h2>
              <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {loadingCreators ? '…' : `${topCreators.length} available`}
              </span>
            </div>

            {loadingCreators ? (
              <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
                <Spinner />
              </div>
            ) : topCreators.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
                {creators && creators.length === 0
                  ? 'No creators yet. Be the first — register your name and publish.'
                  : 'You\'re subscribed to everyone. That\'s some commitment.'}
              </div>
            ) : (
              <CreatorGrid creators={topCreators} router={router} />
            )}
          </section>

        </div>
      </div>
    </>
  )
}
