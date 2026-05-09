'use client'
import Link from 'next/link'
import { NoctwaveLogo } from './ui/NoctwaveLogo'
import { WalletPill } from './WalletPill'

export function AppHeader() {
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
            <Link href="/creator/onboard">Become a creator</Link>
          </nav>

          <WalletPill />
        </div>
      </div>
    </header>
  )
}
