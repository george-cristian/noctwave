import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createConfig } from 'wagmi'
import { baseSepolia, sepolia } from 'wagmi/chains'
import { http } from 'viem'

// Coinbase Base Account SDK is excluded — it conflicts with the COOP: same-origin
// header required by ffmpeg.wasm on the creator dashboard.
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, rainbowWallet, walletConnectWallet, injectedWallet],
    },
  ],
  {
    appName: 'Noctwave',
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'noctwave-dev',
  }
)

// baseSepolia = primary chain (Superfluid, Vaults)
// sepolia     = Ethereum Sepolia for ENS (subname registration, text records)
export const wagmiConfig = createConfig({
  connectors,
  chains: [baseSepolia, sepolia],
  transports: {
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
})
