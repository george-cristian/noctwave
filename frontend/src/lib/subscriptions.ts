import { parseAbi } from 'viem'
import { baseClient } from './baseClient'

const VAULT_FACTORY_ABI = parseAbi([
  'function creatorVault(address) view returns (address)',
])

const CFA_ABI = parseAbi([
  'function getFlowrate(address token, address sender, address receiver) view returns (int96)',
])

const CFA_ADDRESS = '0xcfA132E353cB4E398080B9700609bb008eceB125' as const
const ZERO = '0x0000000000000000000000000000000000000000'

// Returns a map: creatorAddress (lowercased) → true if `user` has an active
// Superfluid flow into that creator's vault. Looks up each creator's vault
// from the factory, then queries CFA.getFlowrate.
export async function fetchSubscriptionStatus(
  user: `0x${string}`,
  creatorAddresses: `0x${string}`[]
): Promise<Record<string, boolean>> {
  const factory = process.env.NEXT_PUBLIC_VAULT_FACTORY_ADDRESS as `0x${string}` | undefined
  const usdcx = process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}` | undefined
  if (!factory || !usdcx || creatorAddresses.length === 0) return {}

  const result: Record<string, boolean> = {}

  await Promise.all(creatorAddresses.map(async (creator) => {
    const key = creator.toLowerCase()
    try {
      const vault = await baseClient.readContract({
        address: factory,
        abi: VAULT_FACTORY_ABI,
        functionName: 'creatorVault',
        args: [creator],
      }) as `0x${string}`

      if (!vault || vault.toLowerCase() === ZERO) {
        result[key] = false
        return
      }

      const flow = await baseClient.readContract({
        address: CFA_ADDRESS,
        abi: CFA_ABI,
        functionName: 'getFlowrate',
        args: [usdcx, user, vault],
      }) as bigint

      result[key] = flow > 0n
    } catch {
      result[key] = false
    }
  }))

  return result
}
