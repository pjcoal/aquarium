export const runtime = 'nodejs'

const MAX_IMAGE = 2 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/** Uploads the coin image + metadata to IPFS through pump.fun, returning the metadata URI. */
export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'expected a form upload' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File) || !TYPES.includes(file.type) || file.size > MAX_IMAGE) {
    return Response.json({ error: 'the image must be a png, jpg, gif or webp under 2 MB' }, { status: 400 })
  }
  const out = new FormData()
  out.append('file', file, file.name || 'coin.png')
  for (const k of ['name', 'symbol', 'description']) out.append(k, String(form.get(k) ?? '').slice(0, 300))
  out.append('showName', 'true')
  try {
    const res = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: out, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return Response.json({ error: `metadata upload failed (${res.status})` }, { status: 502 })
    const data = (await res.json()) as { metadataUri?: string; metadata?: { image?: string } }
    if (!data.metadataUri) return Response.json({ error: 'metadata upload returned no uri' }, { status: 502 })
    return Response.json({ metadataUri: data.metadataUri, image: data.metadata?.image ?? null })
  } catch {
    return Response.json({ error: 'metadata upload timed out' }, { status: 504 })
  }
}
