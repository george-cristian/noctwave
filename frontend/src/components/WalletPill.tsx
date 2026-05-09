'use client'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Avatar } from './ui/Avatar'

export function WalletPill() {
  const { address, isConnected } = useAccount()
  const [copied, setCopied] = useState(false)

  if (!isConnected || !address) {
    return <ConnectButton />
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`

  return (
    <button
      className="btn btn-quiet btn-sm"
      onClick={() => {
        navigator.clipboard?.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      }}
      aria-label={`Wallet ${short}, click to copy address`}
      style={{ gap: 10, paddingLeft: 8 }}
    >
      <Avatar seed={address} size={20} />
      <span className="mono" style={{ color: 'var(--text)', fontSize: 12 }}>
        {copied ? 'copied' : short}
      </span>
    </button>
  )
}
