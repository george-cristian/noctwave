import { Bee } from '@ethersphere/bee-js'
import { keccak256, stringToBytes, hexToBytes } from 'viem'

const GATEWAY = process.env.NEXT_PUBLIC_SWARM_GATEWAY ?? 'https://api.gateway.ethswarm.org'

// Read-only Bee instance — uses public gateway, safe in browser
const readBee = new Bee(GATEWAY)

function makeTopicHash(input: string): Uint8Array {
  return hexToBytes(keccak256(stringToBytes(input)))
}

export const TOPICS = {
  CONTENT_ROOT: makeTopicHash('noctwave-content-root'),
  PROFILE: makeTopicHash('noctwave-profile'),
}

export function swarmGatewayUrl(reference: string, path = ''): string {
  return path ? `${GATEWAY}/bzz/${reference}/${path}` : `${GATEWAY}/bzz/${reference}`
}

// Read a Swarm Feed — works client-side via public gateway
export async function feedRead(topic: Uint8Array, ownerAddress: string): Promise<Uint8Array> {
  const reader = readBee.makeFeedReader('sequence', topic, ownerAddress)
  const { reference } = await reader.download()
  const data = await readBee.downloadData(reference)
  return data
}

// Download raw bytes from gateway — works client-side
export async function swarmDownload(reference: string): Promise<Uint8Array> {
  const data = await readBee.downloadData(reference)
  return data
}

// Write functions below are server-side only (require Bee node + batch ID).
// Called from /api/swarm/upload route, not from browser directly.

function getWriteBee(): Bee {
  const url = process.env.SWARM_BEE_URL
  if (!url) throw new Error('SWARM_BEE_URL not set — Swarm writes are server-side only')
  return new Bee(url)
}

function getBatchId(): string {
  const id = process.env.SWARM_POSTAGE_BATCH_ID
  if (!id) throw new Error('SWARM_POSTAGE_BATCH_ID not set')
  return id
}

export async function swarmUpload(data: Uint8Array): Promise<string> {
  const bee = getWriteBee()
  const result = await bee.uploadData(getBatchId(), data)
  return result.reference.toString()
}

export async function swarmUploadFile(data: Uint8Array, filename: string, contentType: string): Promise<string> {
  const bee = getWriteBee()
  // Ensure plain ArrayBuffer for File constructor (ES2020 lib types require it)
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const file = new File([ab], filename, { type: contentType })
  const result = await bee.uploadFile(getBatchId(), file, filename, { contentType })
  return result.reference.toString()
}

export async function feedUpdate(
  topic: Uint8Array,
  ownerAddress: string,
  data: Uint8Array,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any
): Promise<void> {
  const bee = getWriteBee()
  const batchId = getBatchId()
  // Upload raw data first, then write the reference to the feed
  const { reference } = await bee.uploadData(batchId, data)
  // bee-js v8 makeFeedWriter requires a PrivateKey instance — Dev A resolves this
  const writer = bee.makeFeedWriter('sequence', topic, ownerAddress, signer)
  await writer.upload(batchId, reference)
}
