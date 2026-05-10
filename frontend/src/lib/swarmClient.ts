import { Bee, NULL_STAMP, Utils } from '@ethersphere/bee-js'
import { keccak256, stringToBytes, hexToBytes } from 'viem'

export const GATEWAY = 'https://bzz.limo'
export const bee = new Bee(GATEWAY)

// Topic names — pass as strings to setJsonFeed/getJsonFeed
export const TOPIC_NAMES = {
  CONTENT_ROOT: 'noctwave-content-root',
  PROFILE: 'noctwave-profile',
}

// Keep TOPICS for any code that still uses the raw Uint8Array topics
export const TOPICS = {
  CONTENT_ROOT: hexToBytes(keccak256(stringToBytes('noctwave-content-root'))),
  PROFILE: hexToBytes(keccak256(stringToBytes('noctwave-profile'))),
}

export function swarmGatewayUrl(reference: string, path = ''): string {
  return path ? `${GATEWAY}/bzz/${reference}/${path}` : `${GATEWAY}/bzz/${reference}`
}

// Upload raw bytes — works in browser, no Bee node needed
export async function swarmUpload(data: Uint8Array): Promise<string> {
  const result = await bee.uploadData(NULL_STAMP, data)
  return result.reference.toString()
}

// Upload a named file — works in browser
export async function swarmUploadFile(data: Uint8Array, filename: string, contentType: string): Promise<string> {
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const file = new File([ab], filename, { type: contentType })
  const result = await bee.uploadFile(NULL_STAMP, file, filename, { contentType })
  return result.reference.toString()
}

// Download raw bytes from gateway
export async function swarmDownload(reference: string): Promise<Uint8Array> {
  return bee.downloadData(reference)
}

// Upload any JSON-serialisable value; returns the Swarm CID string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function uploadJson(data: any): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  const result = await bee.uploadData(NULL_STAMP, bytes)
  return result.reference.toString()
}

// Download and JSON-parse bytes at a Swarm CID
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function downloadJson<T = any>(cid: string): Promise<T> {
  const data = await bee.downloadData(cid)
  return data.json() as T
}

// ── High-level JSON feed API ──────────────────────────────────────────────────
// Uses bee.setJsonFeed / bee.getJsonFeed which handle upload + feed write/read
// internally. No BytesReference handling needed.

// Write any JSON-serialisable value to a feed.
// signer: result of makeFeedSigner(address)
// Write JSON to a Swarm Feed (replicates bee-js setJsonData internally)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function feedWriteJson(topicName: string, data: any, signer: any): Promise<void> {
  const serialized = new TextEncoder().encode(JSON.stringify(data))
  const { reference } = await bee.uploadData(NULL_STAMP, serialized)
  console.debug('[swarm] feedWriteJson uploaded data ref:', reference.toString().slice(0, 16) + '…')
  const topic = bee.makeFeedTopic(topicName)
  const writer = bee.makeFeedWriter('sequence', topic, signer)
  await writer.upload(NULL_STAMP, reference)
  console.debug('[swarm] feedWriteJson feed update written for topic:', topicName)
}

// Read JSON from a Swarm Feed owned by ownerAddress.
// Replicates bee-js getJsonData but fixes the BytesReference bug in v8.3.1:
// reader.download() returns reference as Uint8Array, but downloadData requires a hex string.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function feedReadJson<T = any>(topicName: string, ownerAddress: string): Promise<T> {
  const topic = bee.makeFeedTopic(topicName)
  const reader = bee.makeFeedReader('sequence', topic, ownerAddress)
  const feedUpdate = await reader.download()

  // bee-js 8.3.1 bug: feedUpdate.reference is BytesReference (Uint8Array) but
  // downloadData strictly requires a hex string — convert explicitly.
  const ref = feedUpdate.reference
  if (!ref) throw new Error('Feed not found on Swarm — no reference in feed update')

  const refHex = typeof ref === 'string'
    ? ref
    : Utils.bytesToHex(ref as unknown as Uint8Array)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const downloaded = await bee.downloadData(refHex) as any
  return downloaded.json() as T
}

// Create a signer from the user's connected wallet (EIP-1193 provider).
// Pass this to feedWriteJson — no private keys stored anywhere.
export async function makeFeedSigner(address: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Utils.makeEthereumWalletSigner((window as any).ethereum, address)
}
