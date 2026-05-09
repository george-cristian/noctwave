import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia, sepolia } from 'wagmi/chains'

// baseSepolia = primary chain (Superfluid, Vaults)
// sepolia = Ethereum Sepolia for ENS (subname registration, text records)
export const wagmiConfig = getDefaultConfig({
  appName: 'Noctwave',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'noctwave-dev',
  chains: [baseSepolia, sepolia],
  ssr: true,
})
