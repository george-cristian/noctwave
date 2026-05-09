export async function uploadToSwarm(
  data: Uint8Array,
  filename?: string,
  contentType?: string
): Promise<string> {
  const params = new URLSearchParams()
  if (filename) {
    params.set('type', 'file')
    params.set('name', filename)
  } else {
    params.set('type', 'data')
  }
  if (contentType) params.set('ct', contentType)

  const res = await fetch(`/api/swarm/upload?${params}`, {
    method: 'POST',
    body: data as unknown as BodyInit,
    headers: { 'Content-Type': 'application/octet-stream' },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`Swarm upload failed: ${err.error ?? res.statusText}`)
  }

  const { reference } = await res.json()
  return reference as string
}
