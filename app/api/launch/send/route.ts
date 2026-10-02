import { rpc } from '@/lib/server/solana'

export const runtime = 'nodejs'

/** Relays a signed transaction to the Solana RPC (keeps the RPC key server-side). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { tx?: string } | null
  if (!body?.tx || body.tx.length > 3000) return Response.json({ error: 'bad request' }, { status: 400 })
  try {
    const signature = await rpc().sendRawTransaction(Buffer.from(body.tx, 'base64'), { maxRetries: 3 })
    return Response.json({ signature })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message.slice(0, 300) : 'send failed' }, { status: 502 })
  }
}

/** Confirmation status for a signature: pending | confirmed | failed. */
export async function GET(req: Request) {
  const sig = new URL(req.url).searchParams.get('sig') ?? ''
  if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) return Response.json({ error: 'bad signature' }, { status: 400 })
  try {
    const { value } = await rpc().getSignatureStatuses([sig])
    const s = value[0]
    if (!s) return Response.json({ status: 'pending' })
    if (s.err) return Response.json({ status: 'failed', error: JSON.stringify(s.err).slice(0, 200) })
    return Response.json({ status: s.confirmationStatus === 'processed' ? 'pending' : 'confirmed' })
  } catch {
    return Response.json({ status: 'pending' })
  }
}
