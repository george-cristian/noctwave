import { bee } from './swarmClient'
import { NULL_STAMP } from '@ethersphere/bee-js'

// Upload data or a named file directly to Swarm via bzz.limo — no API route needed
export async function uploadToSwarm(
  data: Uint8Array,
  filename?: string,
  contentType?: string
): Promise<string> {
  if (filename) {
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    const file = new File([ab], filename, { type: contentType ?? 'application/octet-stream' })
    const result = await bee.uploadFile(NULL_STAMP, file, filename, {
      contentType: contentType ?? 'application/octet-stream',
    })
    return result.reference.toString()
  }

  const result = await bee.uploadData(NULL_STAMP, data)
  return result.reference.toString()
}
