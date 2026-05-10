'use client'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useCFAForwarder, useSubscriptionVault, useUSDCxWrap, monthlyToFlowRate } from '@/hooks/useContracts'
import { Spinner } from './ui/Spinner'

type SubState = 'idle' | 'confirming' | 'streaming'

interface Props {
  vaultAddress: `0x${string}`
  monthlyPrice: number
  state: SubState
  onSuccess?: () => void
  onStop?: () => void
}

export function SubscribeButton({ vaultAddress, monthlyPrice, state, onSuccess, onStop }: Props) {
  const { address } = useAccount()
  const { openStream, closeStream } = useCFAForwarder()
  const { recordSubscriber } = useSubscriptionVault(vaultAddress)
  const { ensureWrapped } = useUSDCxWrap()
  const [hover, setHover] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubscribe() {
    if (!address) return
    setErrorMsg(null)
    try {
      await ensureWrapped(address, monthlyPrice)
      const flowRate = monthlyToFlowRate(monthlyPrice)
      await openStream(vaultAddress, flowRate)
      await recordSubscriber(address, true).catch(() => {}) // best-effort
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Subscribe failed:', err)
      setErrorMsg(msg.split('\n')[0])
    }
  }

  async function handleStop() {
    try {
      await closeStream(vaultAddress)
      onStop?.()
    } catch (err) {
      console.error('Stop stream failed:', err)
    }
  }

  if (state === 'streaming') {
    return (
      <button
        className="btn btn-lg"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={handleStop}
        style={{
          background: hover ? 'rgba(248,113,113,0.10)' : 'rgba(74,222,128,0.08)',
          color: hover ? 'var(--danger)' : 'var(--success)',
          border: `1px solid ${hover ? 'rgba(248,113,113,0.25)' : 'rgba(74,222,128,0.22)'}`,
          fontWeight: 500,
          minWidth: 200,
        }}
        aria-label="Streaming active. Click to stop stream."
      >
        {hover ? (
          'Stop stream'
        ) : (
          <>
            <span className="live-dot" aria-hidden="true" />
            Streaming · ${monthlyPrice}/mo
          </>
        )}
      </button>
    )
  }

  if (state === 'confirming') {
    return (
      <button className="btn btn-lg btn-quiet" disabled style={{ minWidth: 240 }}>
        <Spinner /> Confirm in wallet…
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', width: '100%' }}>
      <button className="btn btn-primary btn-lg" onClick={handleSubscribe} style={{ minWidth: 240 }}>
        Subscribe · ${monthlyPrice}/month
      </button>
      {errorMsg && (
        <span style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>
          {errorMsg}
        </span>
      )}
    </div>
  )
}
