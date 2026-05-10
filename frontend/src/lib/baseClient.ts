import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

// Read-only viem client for Base Sepolia — used for vault + Superfluid reads.
// All wallet writes still go through wagmi.
export const baseClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? 'https://sepolia.base.org'),
})
