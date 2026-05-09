import { NextRequest } from 'next/server'
import { Bee } from '@ethersphere/bee-js'

export async function POST(req: NextRequest) {
  const beeUrl = process.env.SWARM_BEE_URL
  const batchId = process.env.SWARM_POSTAGE_BATCH_ID

  if (!beeUrl || !batchId) {
    return Response.json(
      { error: 'Swarm not configured — set SWARM_BEE_URL and SWARM_POSTAGE_BATCH_ID' },
      { status: 501 }
    )
  }

  const bee = new Bee(beeUrl)
  const type = req.nextUrl.searchParams.get('type') ?? 'data'
  const name = req.nextUrl.searchParams.get('name') ?? 'upload'
  const ct = req.nextUrl.searchParams.get('ct') ?? 'application/octet-stream'

  const body = await req.arrayBuffer()
  const data = new Uint8Array(body)

  try {
    let reference: string
    if (type === 'file') {
      const file = new File([data], name, { type: ct })
      const result = await bee.uploadFile(batchId, file, name, { contentType: ct })
      reference = result.reference.toString()
    } else {
      const result = await bee.uploadData(batchId, data)
      reference = result.reference.toString()
    }
    return Response.json({ reference })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 502 })
  }
}
