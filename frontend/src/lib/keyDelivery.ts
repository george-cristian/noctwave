import { createPublicClient, http, parseAbi } from 'viem'
import { baseSepolia } from 'viem/chains'
import { bee, feedWriteJson, feedReadJson, makeFeedSigner } from './swarmClient'
import { encryptKey, computeLookupAddress } from './crypto'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? 'https://sepolia.base.org'),
})

const VAULT_ABI = parseAbi([
  'event SubscriberAdded(address indexed subscriber)',
])

// Derive feed topic name for a specific key slot — unique per (creator, subscriber, post)
function keyTopicName(lookupAddress: string): string {
  return `noctwave-key:${lookupAddress}`
}

export async function getSubscribersFromChain(vaultAddress: string): Promise<string[]> {
  const logs = await client.getLogs({
    address: vaultAddress as `0x${string}`,
    event: {
      type: 'event',
      name: 'SubscriberAdded',
      inputs: [{ type: 'address', name: 'subscriber', indexed: true }],
    },
    fromBlock: 0n,
  })
  return [...new Set(logs.map(log => (log.args as { subscriber: string }).subscriber))]
}

// Called from creator dashboard after subscribing or on load.
// Encrypts content keys for each subscriber and stores them in Swarm Feeds.
export async function syncSubscriberKeys(params: {
  creatorAddress: string
  vaultAddress: string
  postKeys: Map<string, Uint8Array>
  encryptForSubscriber: (contentKey: Uint8Array, subscriberAddress: string, postCID: string) => Promise<Uint8Array>
}): Promise<void> {
  const { creatorAddress, vaultAddress, postKeys, encryptForSubscriber } = params
  const subscribers = await getSubscribersFromChain(vaultAddress)
  const signer = await makeFeedSigner(creatorAddress)

  for (const subscriber of subscribers) {
    for (const [postCID, contentKey] of postKeys.entries()) {
      const lookupAddress = computeLookupAddress(creatorAddress, subscriber, postCID)
      const topicName = keyTopicName(lookupAddress)

      // Skip if already delivered
      try {
        await feedReadJson<{ key: string }>(topicName, creatorAddress)
        continue
      } catch {
        // Not yet written — fall through
      }

      const encryptedKey = await encryptForSubscriber(contentKey, subscriber, postCID)
      // Store as base64 JSON — avoids binary/BytesReference issues
      const keyB64 = btoa(String.fromCharCode(...encryptedKey))
      await feedWriteJson(topicName, { key: keyB64 }, signer)
    }
  }
}

// Called from subscriber's browser — reads encrypted key from creator's Swarm Feed
export async function fetchEncryptedKey(params: {
  creatorAddress: string
  subscriberAddress: string
  postCID: string
}): Promise<Uint8Array | null> {
  const { creatorAddress, subscriberAddress, postCID } = params
  const lookupAddress = computeLookupAddress(creatorAddress, subscriberAddress, postCID)
  const topicName = keyTopicName(lookupAddress)

  try {
    const { key } = await feedReadJson<{ key: string }>(topicName, creatorAddress)
    return Uint8Array.from(atob(key), c => c.charCodeAt(0))
  } catch {
    return null  // creator hasn't synced yet
  }
}
