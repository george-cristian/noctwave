'use client'
import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { parseAbi } from 'viem'

const CFA_ABI = parseAbi([
  'function getFlowrate(address token, address sender, address receiver) view returns (int96)',
])

export function StreamBalance({
  sender,
  receiver,
  since,
}: {
  sender: `0x${string}`
  receiver: `0x${string}`
  since?: Date
}) {
  const usdcx = process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}` | undefined
  const [total, setTotal] = useState(0)

  const { data: flowRate } = useReadContract({
    address: '0xcfA132E353cB4E398080B9700609bb008eceB125',
    abi: CFA_ABI,
    functionName: 'getFlowrate',
    args: usdcx ? [usdcx, sender, receiver] : undefined,
    query: { enabled: !!usdcx, refetchInterval: 5_000 },
  })

  useEffect(() => {
    if (!flowRate) return
    const ratePerMs = Number(flowRate) / 1e18 / 1000 // USDCx → USDC per ms
    const sinceMs = since?.getTime() ?? Date.now()

    const id = setInterval(() => {
      const elapsed = Date.now() - sinceMs
      setTotal(Math.max(0, elapsed * ratePerMs))
    }, 100)

    return () => clearInterval(id)
  }, [flowRate, since])

  const ratePerMonth = Number(flowRate ?? 0n) / 1e18 * 2_592_000

  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-dot" aria-hidden="true" />
          <span className="eyebrow" style={{ color: 'var(--success)', letterSpacing: '0.08em' }} aria-live="polite">
            Streaming · live
          </span>
        </div>
        <span className="eyebrow" style={{ color: 'var(--text-dim)' }}>USDC</span>
      </div>

      <div
        className="num"
        style={{ fontSize: 32, color: 'var(--text)', fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.02em' }}
        aria-label={`Total streamed: ${total.toFixed(6)} USDC`}
      >
        {total.toFixed(6)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Rate</span>
        <span className="num" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          ${ratePerMonth.toFixed(2)} / month
        </span>
      </div>
    </div>
  )
}
