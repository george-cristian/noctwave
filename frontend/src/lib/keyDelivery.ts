import { createPublicClient, http, parseAbi } from 'viem'
import { baseSepolia } from 'viem/chains'
import { Bee } from '@ethersphere/bee-js'
import { encryptKey, computeLookupAddress } from './crypto'
import { keccak256, stringToBytes, hexToBytes } from 'viem'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? 'https://sepolia.base.org'),
})

const VAULT_ABI = parseAbi([
  'event SubscriberAdded(address indexed subscriber)',
])

function keyFeedTopic(lookupAddress: string): Uint8Array {
  return hexToBytes(keccak256(stringToBytes(`noctwave-key:${lookupAddress}`)))
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

export async function syncSubscriberKeys(params: {
  creatorAddress: string
  vaultAddress: string
  postKeys: Map<string, Uint8Array>
  gatewayUrl: string
  batchId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feedSigner: any
  encryptForSubscriber: (contentKey: Uint8Array, subscriberAddress: string, postCID: string) => Promise<Uint8Array>
}): Promise<void> {
  const { creatorAddress, vaultAddress, postKeys, gatewayUrl, batchId, feedSigner, encryptForSubscriber } = params
  const subscribers = await getSubscribersFromChain(vaultAddress)
  // bee-js v8 feed writes require Dev A's signer adapter — stub returns early
  if (!feedSigner) return

  const bee = new Bee(gatewayUrl)

  for (const subscriber of subscribers) {
    for (const [postCID, contentKey] of postKeys.entries()) {
      const lookupAddress = computeLookupAddress(creatorAddress, subscriber, postCID)
      const topic = keyFeedTopic(lookupAddress)

      try {
        const reader = bee.makeFeedReader('sequence', topic, creatorAddress)
        await reader.download()
        continue // already delivered
      } catch {
        // not yet written — fall through
      }

      const encryptedKey = await encryptForSubscriber(contentKey, subscriber, postCID)
      const { reference } = await bee.uploadData(batchId, encryptedKey)
      const writer = bee.makeFeedWriter('sequence', topic, creatorAddress, feedSigner)
      await writer.upload(batchId, reference)
    }
  }
}

export async function fetchEncryptedKey(params: {
  creatorAddress: string
  subscriberAddress: string
  postCID: string
  gatewayUrl: string
}): Promise<Uint8Array | null> {
  const { creatorAddress, subscriberAddress, postCID, gatewayUrl } = params
  const lookupAddress = computeLookupAddress(creatorAddress, subscriberAddress, postCID)
  const topic = keyFeedTopic(lookupAddress)

  const bee = new Bee(gatewayUrl)
  try {
    const reader = bee.makeFeedReader('sequence', topic, creatorAddress)
    const { reference } = await reader.download()
    const data = await bee.downloadData(reference)
    return data
  } catch {
    return null
  }
}
