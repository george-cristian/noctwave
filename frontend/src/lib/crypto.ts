import { keccak256, stringToBytes, toBytes, hexToBytes, toHex } from 'viem'

export function computeLookupAddress(
  creatorAddress: string,
  subscriberAddress: string,
  postCID: string
): string {
  const input = `${creatorAddress.toLowerCase()}${subscriberAddress.toLowerCase()}${postCID}`
  return keccak256(stringToBytes(input))
}

export async function deriveSharedSecret(
  creatorAddress: string,
  postCID: string,
  signMessage: (message: string) => Promise<string>
): Promise<Uint8Array> {
  const message = `noctwave-decrypt:${creatorAddress.toLowerCase()}:${postCID}`
  const signature = await signMessage(message)
  return hexToBytes(keccak256(toBytes(signature as `0x${string}`)))
}

// Web Crypto requires ArrayBuffer, not ArrayBufferLike — .buffer on a sliced Uint8Array
// may be a SharedArrayBuffer. buf() forces a plain ArrayBuffer copy.
function buf(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer
}

export async function encryptKey(
  contentKey: Uint8Array,
  sharedSecret: Uint8Array
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cryptoKey = await crypto.subtle.importKey(
    'raw', buf(sharedSecret.slice(0, 32)), { name: 'AES-GCM' }, false, ['encrypt']
  )
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, cryptoKey, buf(contentKey))
  const result = new Uint8Array(12 + encrypted.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(encrypted), 12)
  return result
}

export async function decryptKey(
  encryptedKey: Uint8Array,
  sharedSecret: Uint8Array
): Promise<Uint8Array> {
  const iv = encryptedKey.slice(0, 12)
  const ciphertext = encryptedKey.slice(12)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', buf(sharedSecret.slice(0, 32)), { name: 'AES-GCM' }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, cryptoKey, buf(ciphertext))
  return new Uint8Array(decrypted)
}

export async function encryptContent(
  data: Uint8Array,
  contentKey: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cryptoKey = await crypto.subtle.importKey(
    'raw', buf(contentKey), { name: 'AES-GCM' }, false, ['encrypt']
  )
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, cryptoKey, buf(data))
  return { ciphertext: new Uint8Array(encrypted), iv }
}

export async function decryptContent(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  contentKey: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', buf(contentKey), { name: 'AES-GCM' }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, cryptoKey, buf(ciphertext))
  return new Uint8Array(decrypted)
}

export function generateContentKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}
