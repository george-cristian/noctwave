'use client'
import { useReadContract, useWriteContract, useSwitchChain } from 'wagmi'
import { parseAbi } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { getTextRecord, getAddressRecord } from '@ensdomains/ensjs/public'
import { ensClient } from '@/lib/ensClient'
import { baseClient } from '@/lib/baseClient'
import { sepolia, baseSepolia } from 'viem/chains'

// Dev A's subdomain registrar on Ethereum Sepolia — grants alice.noctwave.eth
// Also proxies setText so the registrar (which owns the subnode) can set records
const REGISTRAR_ABI = parseAbi([
  'function register(string calldata label) external',
  'function setTextRecord(string calldata label, string calldata key, string calldata value) external',
])

const VAULT_FACTORY_ABI = parseAbi([
  'function deploy(address token, int96 flowRate) external returns (address)',
  'function creatorVault(address) view returns (address)',
])

const CFA_FORWARDER_ABI = parseAbi([
  'function createFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)',
  'function deleteFlow(address token, address sender, address receiver, bytes userData) external returns (bool)',
  'function getFlowrate(address token, address sender, address receiver) view returns (int96)',
])

const VAULT_ABI = parseAbi([
  'function recordSubscriber(address subscriber, bool active) external',
  'function isSubscribed(address subscriber) view returns (bool)',
  'function getSubscribers() view returns (address[])',
])

const CFA_ADDRESS = '0xcfA132E353cB4E398080B9700609bb008eceB125' as const
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
])

const SUPER_TOKEN_ABI = parseAbi([
  'function upgrade(uint256 amount)',
  'function balanceOf(address) view returns (uint256)',
])

export function monthlyToFlowRate(usdcPerMonth: number): bigint {
  // USDCx has 18 decimals
  const monthlyWei = BigInt(Math.floor(usdcPerMonth * 1e18))
  return monthlyWei / 2_592_000n
}

// ENS subname registration — claims alice.noctwave.eth via Dev A's registrar on Ethereum Sepolia
export function useENSRegistrar() {
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const registrarAddress = process.env.NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS as `0x${string}` | undefined

  return {
    register: async (label: string) => {
      await switchChainAsync({ chainId: sepolia.id })
      return writeContractAsync({
        chainId: sepolia.id,
        address: registrarAddress!,
        abi: REGISTRAR_ABI,
        functionName: 'register',
        args: [label],
        gas: 500_000n,
      })
    },
  }
}

// ENS text record writes — routes through the registrar which owns the subnode
export function useENSResolver() {
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const registrarAddress = process.env.NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS as `0x${string}` | undefined

  return {
    // label = bare subdomain (e.g. "alice"), not the full ENS name
    setText: async (label: string, key: string, value: string) => {
      await switchChainAsync({ chainId: sepolia.id })
      return writeContractAsync({
        chainId: sepolia.id,
        address: registrarAddress!,
        abi: REGISTRAR_ABI,
        functionName: 'setTextRecord',
        args: [label, key, value],
        gas: 300_000n,
      })
    },
  }
}

// ENS text record reads — hits Ethereum Sepolia via public RPC, no wallet needed
export function useENSTextRecord(name: string | undefined, key: string) {
  return useQuery({
    queryKey: ['ens-text', name, key],
    queryFn: () => getTextRecord(ensClient, { name: name!, key }),
    enabled: !!name,
    staleTime: 30_000,
  })
}

// Resolve ENS name → owner address on Ethereum Sepolia
export function useENSAddress(name: string | undefined) {
  return useQuery({
    queryKey: ['ens-addr', name],
    queryFn: () => getAddressRecord(ensClient, { name: name! }),
    enabled: !!name,
    staleTime: 30_000,
  })
}

export function useVaultFactory() {
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const factoryAddress = process.env.NEXT_PUBLIC_VAULT_FACTORY_ADDRESS as `0x${string}` | undefined

  return {
    deploy: async (token: `0x${string}`, flowRate: bigint) => {
      await switchChainAsync({ chainId: baseSepolia.id })
      return writeContractAsync({
        chainId: baseSepolia.id,
        address: factoryAddress!,
        abi: VAULT_FACTORY_ABI,
        functionName: 'deploy',
        args: [token, flowRate],
      })
    },
  }
}

export function useCreatorVault(creatorAddress?: `0x${string}`) {
  const factoryAddress = process.env.NEXT_PUBLIC_VAULT_FACTORY_ADDRESS as `0x${string}` | undefined
  return useReadContract({
    address: factoryAddress,
    abi: VAULT_FACTORY_ABI,
    functionName: 'creatorVault',
    args: creatorAddress ? [creatorAddress] : undefined,
    query: { enabled: !!factoryAddress && !!creatorAddress },
  })
}

export function useCFAForwarder() {
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const usdcxAddress = process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}` | undefined

  const openStream = async (receiverVault: `0x${string}`, flowRate: bigint) => {
    await switchChainAsync({ chainId: baseSepolia.id })
    return writeContractAsync({
      chainId: baseSepolia.id,
      address: CFA_ADDRESS,
      abi: CFA_FORWARDER_ABI,
      functionName: 'createFlow',
      args: [
        usdcxAddress!,
        ZERO_ADDRESS,    // sender = address(0), CFA uses msg.sender
        receiverVault,
        flowRate,
        '0x',
      ],
    })
  }

  const closeStream = async (receiverVault: `0x${string}`) => {
    await switchChainAsync({ chainId: baseSepolia.id })
    return writeContractAsync({
      chainId: baseSepolia.id,
      address: CFA_ADDRESS,
      abi: CFA_FORWARDER_ABI,
      functionName: 'deleteFlow',
      args: [
        usdcxAddress!,
        ZERO_ADDRESS,
        receiverVault,
        '0x',
      ],
    })
  }

  return { openStream, closeStream }
}

// Ensures the user has at least one month of USDCx before opening a stream.
// Approves USDC and upgrades to USDCx if their wrapped balance is insufficient.
// USDC = 6 decimals, USDCx = 18 decimals; upgrade(x) on the super token pulls
// x / 1e12 of underlying USDC and mints x of USDCx.
export function useUSDCxWrap() {
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined
  const usdcx = process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}` | undefined

  return {
    ensureWrapped: async (user: `0x${string}`, monthlyPrice: number) => {
      if (!usdc || !usdcx) throw new Error('USDC/USDCx env vars missing')
      await switchChainAsync({ chainId: baseSepolia.id })

      // Target buffer: one month of stream — covers Superfluid's 4-hour deposit
      // requirement on testnets and gives a comfortable runway.
      const targetX = BigInt(Math.ceil(monthlyPrice)) * 10n ** 18n

      const balanceX = await baseClient.readContract({
        address: usdcx,
        abi: SUPER_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [user],
      })
      if (balanceX >= targetX) return

      const wrapAmountX = targetX - balanceX
      const wrapAmountUnderlying = wrapAmountX / 10n ** 12n  // USDCx 18d → USDC 6d

      const usdcBalance = await baseClient.readContract({
        address: usdc,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [user],
      })
      if (usdcBalance < wrapAmountUnderlying) {
        const need = Number(wrapAmountUnderlying) / 1e6
        const have = Number(usdcBalance) / 1e6
        throw new Error(
          `Insufficient test USDC on Base Sepolia. Need ${need.toFixed(2)}, have ${have.toFixed(2)}. ` +
          `Get test USDC from a Base Sepolia faucet (e.g. faucet.circle.com).`
        )
      }

      const allowance = await baseClient.readContract({
        address: usdc,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [user, usdcx],
      })
      if (allowance < wrapAmountUnderlying) {
        // Approve a generous amount so future top-ups don't need re-approval
        await writeContractAsync({
          chainId: baseSepolia.id,
          address: usdc,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [usdcx, wrapAmountUnderlying * 100n],
        })
      }

      await writeContractAsync({
        chainId: baseSepolia.id,
        address: usdcx,
        abi: SUPER_TOKEN_ABI,
        functionName: 'upgrade',
        args: [wrapAmountX],
      })
    },
  }
}

export function useFlowRate(
  sender?: `0x${string}`,
  receiver?: `0x${string}`
) {
  const usdcxAddress = process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}` | undefined
  return useReadContract({
    address: CFA_ADDRESS,
    abi: CFA_FORWARDER_ABI,
    functionName: 'getFlowrate',
    args: usdcxAddress && sender && receiver ? [usdcxAddress, sender, receiver] : undefined,
    query: {
      enabled: !!usdcxAddress && !!sender && !!receiver,
      refetchInterval: 10_000,
    },
  })
}

export function useIsSubscribed(
  sender?: `0x${string}`,
  vault?: `0x${string}`
): boolean {
  const usdcxAddress = process.env.NEXT_PUBLIC_USDCX_ADDRESS as `0x${string}` | undefined
  const { data } = useReadContract({
    address: CFA_ADDRESS,
    abi: CFA_FORWARDER_ABI,
    functionName: 'getFlowrate',
    args: usdcxAddress && sender && vault ? [usdcxAddress, sender, vault] : undefined,
    query: {
      enabled: !!usdcxAddress && !!sender && !!vault,
      refetchInterval: 10_000,
    },
  })
  return (data ?? 0n) > 0n
}

export function useSubscriptionVault(vaultAddress?: `0x${string}`) {
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  return {
    recordSubscriber: async (subscriber: `0x${string}`, active: boolean) => {
      await switchChainAsync({ chainId: baseSepolia.id })
      return writeContractAsync({
        chainId: baseSepolia.id,
        address: vaultAddress!,
        abi: VAULT_ABI,
        functionName: 'recordSubscriber',
        args: [subscriber, active],
      })
    },
  }
}
