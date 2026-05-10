import { parseAbi, parseAbiItem } from 'viem'
import { ensClient } from './ensClient'
import { downloadJson } from './swarmClient'
import type { CreatorFeed, PostMetadata } from './types'

const REGISTRAR_ABI = parseAbi([
  'function getTextRecord(string calldata label, string calldata key) view returns (string)',
])

const SUBDOMAIN_REGISTERED_EVENT = parseAbiItem(
  'event SubdomainRegistered(string label, address indexed owner, bytes32 indexed node)'
)

export interface DiscoveredCreator {
  ens: string         // alice.noctwave.eth
  label: string       // alice
  owner: `0x${string}`
  price: number       // monthly USDC; 0 if creator hasn't set one yet
  bio: string
  latestPost: PostMetadata | null
  postCount: number
}

export async function fetchCreators(): Promise<DiscoveredCreator[]> {
  const registrarAddress = process.env.NEXT_PUBLIC_ENS_REGISTRAR_ADDRESS as `0x${string}` | undefined
  if (!registrarAddress) return []

  const logs = await ensClient.getLogs({
    address: registrarAddress,
    event: SUBDOMAIN_REGISTERED_EVENT,
    fromBlock: 0n,
    toBlock: 'latest',
  })

  // Deduplicate: a single owner can only hold one label, but the event is keyed
  // by label which is already unique by contract logic.
  const creators = await Promise.all(logs.map(async (log) => {
    const label = log.args.label as string
    const owner = log.args.owner as `0x${string}`

    const [priceStr, bio, feedCID] = await Promise.all([
      ensClient.readContract({
        address: registrarAddress,
        abi: REGISTRAR_ABI,
        functionName: 'getTextRecord',
        args: [label, 'price'],
      }) as Promise<string>,
      ensClient.readContract({
        address: registrarAddress,
        abi: REGISTRAR_ABI,
        functionName: 'getTextRecord',
        args: [label, 'description'],
      }) as Promise<string>,
      ensClient.readContract({
        address: registrarAddress,
        abi: REGISTRAR_ABI,
        functionName: 'getTextRecord',
        args: [label, 'swarm-feed'],
      }) as Promise<string>,
    ])

    let latestPost: PostMetadata | null = null
    let postCount = 0
    if (feedCID) {
      try {
        const feed = await downloadJson<CreatorFeed>(feedCID)
        // feed.posts is unshift'd on publish, so [0] is newest
        latestPost = feed.posts[0] ?? null
        postCount = feed.posts.length
      } catch {
        // Swarm gateway might be temporarily unavailable; render the creator anyway
      }
    }

    return {
      ens: `${label}.noctwave.eth`,
      label,
      owner,
      price: Number(priceStr) || 0,
      bio: bio || 'New creator on Noctwave.',
      latestPost,
      postCount,
    }
  }))

  // Creators with content first, then by recency
  return creators.sort((a, b) => {
    if (a.latestPost && !b.latestPost) return -1
    if (!a.latestPost && b.latestPost) return 1
    return (b.latestPost?.published_at ?? 0) - (a.latestPost?.published_at ?? 0)
  })
}
