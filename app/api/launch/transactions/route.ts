import { buildFeeTransaction, isPublicKey, launchSettings } from '@/lib/server/solana'
import { modelAvailable } from '@/lib/server/llm'

export const runtime = 'nodejs'

/**
 * Builds the two transactions a launch needs, for the creator's wallet to sign:
 * the pump.fun create (via PumpPortal) and the launch fee transfer.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })
  const { creator, mint, metadataUri } = body
  // resuming a launch whose coin already exists: only the fee is still owed
  if (body.feeOnly === true) {
    if (!isPublicKey(creator)) return Response.json({ error: 'bad request' }, { status: 400 })
    if (!launchSettings().treasury) return Response.json({ error: 'launching is not configured' }, { status: 503 })
    return Response.json({ feeTx: await buildFeeTransaction(creator) })
  }
  const name = String(body.name ?? '').slice(0, 32)
  const symbol = String(body.symbol ?? '').slice(0, 10)
  const devBuy = Math.max(0, Math.min(5, Number(body.devBuySol) || 0))
  if (!isPublicKey(creator) || !isPublicKey(mint) || typeof metadataUri !== 'string' || !metadataUri.startsWith('https://')) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  if (!launchSettings().treasury) return Response.json({ error: 'launching is not configured' }, { status: 503 })
  // check before anything is signed or paid
  if (!modelAvailable(String(body.model ?? ''))) return Response.json({ error: 'that brain is not available right now; pick another' }, { status: 400 })
  try {
    const res = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        publicKey: creator,
        action: 'create',
        tokenMetadata: { name, symbol, uri: metadataUri },
        mint,
        denominatedInSol: 'true',
        amount: devBuy,
        slippage: 10,
        priorityFee: 0.0005,
        pool: 'pump',
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return Response.json({ error: `pump.fun create failed (${res.status}): ${(await res.text()).slice(0, 200)}` }, { status: 502 })
    const createTx = Buffer.from(await res.arrayBuffer()).toString('base64')
    const feeTx = await buildFeeTransaction(creator)
    return Response.json({ createTx, feeTx })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'could not build transactions' }, { status: 502 })
  }
}
