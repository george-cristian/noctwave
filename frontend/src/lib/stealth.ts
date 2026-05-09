import * as secp from '@noble/secp256k1'
import { keccak256, toHex, hexToBytes } from 'viem'

export function parseStealthMetaAddress(metaAddress: string): {
  spendingPublicKey: Uint8Array
  viewingPublicKey: Uint8Array
} {
  const hex = metaAddress.replace('st:eth:0x', '').replace('st:base:0x', '')
  const spendingPublicKey = hexToBytes(`0x${hex.slice(0, 66)}`)
  const viewingPublicKey = hexToBytes(`0x${hex.slice(66)}`)
  return { spendingPublicKey, viewingPublicKey }
}

export function generateStealthMetaAddress(
  spendingPublicKey: Uint8Array,
  viewingPublicKey: Uint8Array
): string {
  return `st:eth:0x${toHex(spendingPublicKey).slice(2)}${toHex(viewingPublicKey).slice(2)}`
}

export function generateStealthAddress(stealthMetaAddress: string): {
  stealthAddress: string
  ephemeralPublicKey: Uint8Array
  viewTag: number
} {
  const { spendingPublicKey, viewingPublicKey } = parseStealthMetaAddress(stealthMetaAddress)

  const ephemeralPrivKey = secp.utils.randomPrivateKey()
  const ephemeralPubKey = secp.getPublicKey(ephemeralPrivKey, true)

  const sharedSecretPoint = secp.getSharedSecret(ephemeralPrivKey, viewingPublicKey)
  const sharedSecretHex = keccak256(toHex(sharedSecretPoint.slice(1, 33)))
  const sharedSecret = hexToBytes(sharedSecretHex)

  const viewTag = sharedSecret[0]

  const sharedSecretScalar = BigInt(sharedSecretHex)
  const spendPoint = secp.ProjectivePoint.fromHex(spendingPublicKey)
  const addend = secp.ProjectivePoint.BASE.multiply(sharedSecretScalar)
  const stealthPoint = spendPoint.add(addend)
  const stealthPublicKey = stealthPoint.toRawBytes(true)

  const stealthAddress = publicKeyToAddress(stealthPublicKey)

  return { stealthAddress, ephemeralPublicKey: ephemeralPubKey, viewTag }
}

export function checkStealthAddress(
  ephemeralPublicKey: Uint8Array,
  viewTag: number,
  viewingPrivateKey: Uint8Array,
  spendingPublicKey: Uint8Array
): { isForMe: boolean; stealthAddress?: string } {
  const sharedSecretPoint = secp.getSharedSecret(viewingPrivateKey, ephemeralPublicKey)
  const sharedSecretHex = keccak256(toHex(sharedSecretPoint.slice(1, 33)))
  const sharedSecret = hexToBytes(sharedSecretHex)

  if (sharedSecret[0] !== viewTag) return { isForMe: false }

  const sharedSecretScalar = BigInt(sharedSecretHex)
  const spendPoint = secp.ProjectivePoint.fromHex(spendingPublicKey)
  const addend = secp.ProjectivePoint.BASE.multiply(sharedSecretScalar)
  const stealthPoint = spendPoint.add(addend)
  const stealthPublicKey = stealthPoint.toRawBytes(true)
  const stealthAddress = publicKeyToAddress(stealthPublicKey)

  return { isForMe: true, stealthAddress }
}

function publicKeyToAddress(compressedPublicKey: Uint8Array): string {
  const point = secp.ProjectivePoint.fromHex(compressedPublicKey)
  const uncompressed = point.toRawBytes(false)
  const hash = keccak256(toHex(uncompressed.slice(1)))
  return `0x${hash.slice(-40)}`
}
