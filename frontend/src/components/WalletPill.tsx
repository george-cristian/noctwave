'use client'
import { useState, useEffect, useRef } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Avatar } from './ui/Avatar'

export function WalletPill() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!isConnected || !address) {
    return <ConnectButton />
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`

  function copyAddress() {
    navigator.clipboard?.writeText(address!)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  function handleDisconnect() {
    setOpen(false)
    disconnect()
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className="btn btn-quiet btn-sm"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Wallet ${short}, click for menu`}
        style={{ gap: 10, paddingLeft: 8 }}
      >
        <Avatar seed={address} size={20} />
        <span className="mono" style={{ color: 'var(--text)', fontSize: 12 }}>
          {short}
        </span>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ marginLeft: -2, opacity: 0.7 }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 200,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 50,
            background: 'var(--bg-raised)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <button
            role="menuitem"
            onClick={copyAddress}
            className="btn btn-quiet btn-sm"
            style={{ justifyContent: 'flex-start', gap: 10, padding: '8px 10px', width: '100%' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            <span style={{ fontSize: 13 }}>{copied ? 'Copied' : 'Copy address'}</span>
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

          <button
            role="menuitem"
            onClick={handleDisconnect}
            className="btn btn-quiet btn-sm"
            style={{ justifyContent: 'flex-start', gap: 10, padding: '8px 10px', width: '100%', color: 'var(--text)' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 11l3-3-3-3M13 8H6M9 13H4a1 1 0 01-1-1V4a1 1 0 011-1h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 13 }}>Disconnect</span>
          </button>
        </div>
      )}
    </div>
  )
}
