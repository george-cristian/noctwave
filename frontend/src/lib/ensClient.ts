import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { addEnsContracts } from '@ensdomains/ensjs'

// Read-only viem client for Ethereum Sepolia — used for ENS resolution only.
// addEnsContracts adds the required contracts + subgraphs fields that ClientWithEns requires.
// All transactions still go through Base Sepolia via wagmi.
export const ensClient = createPublicClient({
  chain: addEnsContracts(sepolia),
  transport: http(
    process.env.NEXT_PUBLIC_ENS_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com'
  ),
})
