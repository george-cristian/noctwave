import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // COOP/COEP required for ffmpeg.wasm SharedArrayBuffer — only on creator dashboard
        // Applying globally breaks Coinbase Smart Wallet popup auth on other pages
        source: '/creator/:ens',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}

export default nextConfig
