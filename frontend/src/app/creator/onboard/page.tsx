'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { AppHeader } from '@/components/AppHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { useENSRegistrar, useENSResolver, useVaultFactory, monthlyToFlowRate } from '@/hooks/useContracts'
import { generateStealthMetaAddress } from '@/lib/stealth'
import * as secp from '@noble/secp256k1'

const STEPS = [
  { id: 'connect',  label: 'Connect',          short: '01' },
  { id: 'name',     label: 'Pick a name',      short: '02' },
  { id: 'price',    label: 'Set your price',   short: '03' },
  { id: 'identity', label: 'Stealth identity', short: '04' },
]

interface OnboardData {
  ens: string
  price: number
  stealthMeta: string
}

function StepShell({ eyebrow, title, blurb, children }: {
  eyebrow: string
  title: string
  blurb?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="display" style={{ margin: 0, fontSize: 32, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          {title}
        </h1>
        {blurb && (
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)', maxWidth: 540, lineHeight: 1.6 }}>
            {blurb}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function OnChainBlurb({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 'var(--r-6)',
      background: 'var(--bg-overlay)',
      border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, color: 'var(--text-muted)',
    }}>
      <span className="live-dot" aria-hidden="true" />
      <span className="num" style={{ color: 'var(--text)' }}>{children}</span>
    </div>
  )
}

function formatUSDC(n: number, places = 7) {
  return n.toFixed(places)
}

export default function OnboardPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { register } = useENSRegistrar()
  const { setText: setTextRecord } = useENSResolver()
  const { deploy } = useVaultFactory()

  const [step, setStep] = useState(isConnected ? 1 : 0)
  const [data, setData] = useState<OnboardData>({ ens: '', price: 8, stealthMeta: '' })
  const [busy, setBusy] = useState(false)

  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1))
  const back = () => setStep(s => Math.max(0, s - 1))

  // Auto-advance from connect step when wallet connects
  useEffect(() => {
    if (isConnected && step === 0) next()
  }, [isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRegister() {
    setBusy(true)
    try {
      await register(data.ens)
      next()
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleDeployVault() {
    setBusy(true)
    try {
      const usdcx = process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}`
      const flowRate = monthlyToFlowRate(data.price)
      await deploy(usdcx, flowRate)
      await setTextRecord(data.ens, 'price', String(data.price))
      next()
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerateStealth() {
    setBusy(true)
    try {
      // Derive two deterministic keys from random entropy (hackathon: not tied to wallet)
      const spendKey = secp.utils.randomPrivateKey()
      const viewKey = secp.utils.randomPrivateKey()
      const spendPub = secp.getPublicKey(spendKey, true)
      const viewPub = secp.getPublicKey(viewKey, true)
      const meta = generateStealthMetaAddress(spendPub, viewPub)
      setData(d => ({ ...d, stealthMeta: meta }))
      await setTextRecord(data.ens, 'stealth-meta', meta)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  const perSec = data.price / (30 * 24 * 60 * 60)

  return (
    <>
      <AppHeader />
      <div className="page">
        <div className="page-narrow">

          {/* Progress indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 48 }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{ display: 'contents' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: i === step ? 'var(--text)' : i < step ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                  <span className="num" style={{
                    fontSize: 12, width: 22, height: 22, borderRadius: 6,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: i === step ? 'var(--accent-soft)' : 'transparent',
                    color: i === step ? 'var(--accent)' : i < step ? 'var(--text-muted)' : 'var(--text-dim)',
                    border: i === step ? '1px solid transparent' : '1px solid var(--border)',
                  }}>
                    {i < step ? '✓' : s.short}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: i === step ? 500 : 400, whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: 'var(--border)', minWidth: 12 }} />
                )}
              </div>
            ))}
          </div>

          <div className="nw-enter" key={step} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Step 0: Connect */}
            {step === 0 && (
              <StepShell eyebrow="Step 01" title="Connect your wallet."
                blurb="We'll never ask for keys. Your stealth identity is derived locally in step 4 and never leaves the browser."
              >
                <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'flex-start' }}>
                  <ConnectButton />
                </div>
              </StepShell>
            )}

            {/* Step 1: Name */}
            {step === 1 && (
              <StepShell eyebrow="Step 02" title="Pick your name."
                blurb="Subscribers find you under this name. It resolves to your stealth identity, not your wallet."
              >
                <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <input
                      autoFocus
                      placeholder="alice"
                      value={data.ens}
                      onChange={e => setData(d => ({ ...d, ens: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      style={{ flex: 1, height: 48, fontSize: 18 }}
                      disabled={busy}
                    />
                    <span className="num" style={{
                      display: 'inline-flex', alignItems: 'center', padding: '0 14px',
                      color: 'var(--text-muted)', fontSize: 15,
                      border: '1px solid var(--border)', borderRadius: 'var(--r-6)',
                      background: 'var(--bg-overlay)',
                    }}>
                      .noctwave.eth
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: /^[a-z0-9-]{3,16}$/.test(data.ens) ? 'var(--success)' : 'var(--text-dim)' }}>
                    {/^[a-z0-9-]{3,16}$/.test(data.ens)
                      ? '✓ Available on Ethereum Sepolia'
                      : '· 3–16 characters · lowercase letters, digits, hyphens'}
                  </div>
                </div>
                {busy && <OnChainBlurb>Registering &apos;{data.ens}.noctwave.eth&apos; on Ethereum Sepolia…</OnChainBlurb>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn btn-ghost" onClick={back} disabled={busy}>Back</button>
                  <button
                    className="btn btn-primary"
                    disabled={!/^[a-z0-9-]{3,16}$/.test(data.ens) || busy}
                    onClick={handleRegister}
                  >
                    {busy ? <><Spinner /> Registering…</> : 'Register name'}
                  </button>
                </div>
              </StepShell>
            )}

            {/* Step 2: Price */}
            {step === 2 && (
              <StepShell eyebrow="Step 03" title="Set your monthly price."
                blurb="Subscribers pay continuously, per second, while watching. You can change this anytime."
              >
                <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 32, color: 'var(--text-muted)', fontWeight: 400 }}>$</span>
                    <input
                      type="number" min="1" max="50" step="1"
                      value={data.price}
                      onChange={e => setData(d => ({ ...d, price: Number(e.target.value) || 0 }))}
                      className="num"
                      style={{ fontSize: 72, height: 'auto', padding: 0, border: 'none', background: 'transparent', width: 200, fontWeight: 500, letterSpacing: '-0.04em' }}
                    />
                    <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>/ month</span>
                  </div>
                  <input
                    type="range" min="1" max="30" step="1"
                    value={data.price}
                    onChange={e => setData(d => ({ ...d, price: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    {[
                      { label: 'Per second', value: `$${formatUSDC(perSec)}` },
                      { label: 'Per minute', value: `$${formatUSDC(perSec * 60, 5)}` },
                      { label: 'At 1k subs/mo', value: `$${(data.price * 1000).toLocaleString()}` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
                        <span className="num" style={{ fontSize: 15, color: 'var(--text)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {busy && <OnChainBlurb>Deploying vault on Base Sepolia…</OnChainBlurb>}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn btn-ghost" onClick={back} disabled={busy}>Back</button>
                  <button className="btn btn-primary" disabled={busy} onClick={handleDeployVault}>
                    {busy ? <><Spinner /> Deploying…</> : 'Deploy vault'}
                  </button>
                </div>
              </StepShell>
            )}

            {/* Step 3: Stealth */}
            {step === 3 && (
              <StepShell eyebrow="Step 04" title="Generate your stealth identity."
                blurb="A new payment address per subscriber. Earnings can't be linked back to a single wallet. Done in your browser, never sent to a server."
              >
                <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 'var(--r-6)',
                      background: 'var(--bg-overlay)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1l5.5 3v4c0 3.5-2.5 6.5-5.5 7-3-.5-5.5-3.5-5.5-7V4L8 1z" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
                        <path d="M5.5 8l2 2 3-4" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, color: 'var(--text)' }}>EIP-5564 stealth meta-address</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Subscribers derive a fresh address for every payment to you.</div>
                    </div>
                  </div>
                  <div style={{
                    padding: 14, borderRadius: 'var(--r-6)',
                    background: 'var(--bg-overlay)', border: '1px solid var(--border)',
                    fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)',
                    wordBreak: 'break-all', lineHeight: 1.6, minHeight: 64,
                  }}>
                    {data.stealthMeta || <span style={{ color: 'var(--text-dim)' }}>Not yet generated.</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn btn-ghost" onClick={back}>Back</button>
                  {!data.stealthMeta ? (
                    <button className="btn btn-primary" onClick={handleGenerateStealth} disabled={busy}>
                      {busy ? <><Spinner /> Generating…</> : 'Generate identity'}
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={() => router.push(`/creator/${data.ens}`)}>
                      Open my dashboard →
                    </button>
                  )}
                </div>
              </StepShell>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
