'use client'

function seededGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hueA = h % 360
  const hueB = (hueA + 40 + (h >>> 8) % 80) % 360
  const angle = (h >>> 4) % 360
  return `linear-gradient(${angle}deg, oklch(0.32 0.06 ${hueA}) 0%, oklch(0.18 0.04 ${hueB}) 100%)`
}

export { seededGradient }

export function Avatar({
  seed = 'noctwave',
  size = 36,
  style,
}: {
  seed?: string
  size?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: seededGradient(seed),
        ...style,
      }}
      aria-hidden="true"
    />
  )
}
