'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { parseAbi } from 'viem'
import { NoctwaveLogo } from './ui/NoctwaveLogo'
import { WalletPill } from './WalletPill'

const REGISTRAR_ABI = parseAbi(['function ownerToLabel(address) view returns (string)'])

export function AppHeader() {
  const router = useRouter()
  const { isConnected, address } = useAccount()
  const [creatorLabel, setCreatorLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address) { setCreatorLabel(null); return }
    const registrarAddress = process.env.NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS as `0x${string}`
    if (!registrarAddress) return

    import('@/lib/ensClient').then(({ ensClient }) => {
      ensClient.readContract({
        address: registrarAddress,
        abi: REGISTRAR_ABI,
        functionName: 'ownerToLabel',
        args: [address],
      }).then(label => {
        setCreatorLabel((label as string) || null)
      }).catch(() => setCreatorLabel(null))
    })
  }, [isConnected, address])

  return (
    <header className="app-header">
      <div className="shell">
        <div className="app-header-inner">
          <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
            <NoctwaveLogo size={26} />
            Noctwave
          </Link>

          <nav className="nav">
            <Link href="/">Discover</Link>
            {creatorLabel ? (
              <button className="btn btn-ghost" style={{ padding: 0 }} onClick={() => router.push(`/creator/${creatorLabel}`)}>
                Go to dashboard
              </button>
            ) : (
              <Link href="/creator/onboard">Become a creator</Link>
            )}
          </nav>

          <WalletPill />
        </div>
      </div>
    </header>
  )
}
