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

  webpack(config) {
    // pino-pretty: optional pretty-printer for WalletConnect's logger — not installed, not needed
    // @react-native-async-storage: MetaMask SDK's React Native code path — never runs in browser
    // Aliasing to false tells webpack to skip the import silently instead of emitting an error
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    }
    return config
  },
}

export default nextConfig
