import type { CoinRecord } from '@/types/coin'
import { normalizeLaunch } from '@/lib/launchInput'
import { KEYS, getStore } from '@/lib/server/store'
import { isPublicKey, verifyLaunch } from '@/lib/server/solana'

export const runtime = 'nodejs'
export const maxDuration = 30

const isSig = (s: unknown): s is string => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(s)

/**
 * Registers a launched coin so its fish is dropped into everyone's tank.
 * Only after the pump.fun create and the fee payment are verified on-chain.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ error: 'bad request' }, { status: 400 })
  const { mint, creator, createSig, feeSig, metadataUri } = body
  if (!isPublicKey(mint) || !isPublicKey(creator) || !isSig(createSig) || !isSig(feeSig)) return Response.json({ error: 'bad request' }, { status: 400 })
  const input = normalizeLaunch(body)
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 })

  const store = getStore()
  if (store.kind === 'memory' && process.env.NODE_ENV === 'production') return Response.json({ error: 'the database is not connected yet' }, { status: 503 })
  if (await store.hget<CoinRecord>(KEYS.coins, mint)) return Response.json({ error: 'this coin is already in the tank' }, { status: 409 })

  // local development can skip the chain (never in production)
  const skip = process.env.AQUARIUM_DEV_SKIP_CHAIN === '1' && process.env.NODE_ENV !== 'production'
  if (!skip) {
    const v = await verifyLaunch({ mint, creator, createSig, feeSig })
    if (!v.ok) return Response.json({ error: v.reason }, { status: 422 })
  }
  // a fee payment can only ever pay for one fish
  if (!(await store.sadd(KEYS.usedSigs, feeSig))) return Response.json({ error: 'that fee payment was already used' }, { status: 409 })

  const coin: CoinRecord = {
    mint,
    ...input.value,
    image: typeof body.image === 'string' && body.image.startsWith('https://') ? body.image.slice(0, 300) : null,
    metadataUri: typeof metadataUri === 'string' ? metadataUri.slice(0, 300) : '',
    creator,
    createdAt: Date.now(),
    createSig,
    feeSig,
  }
  await store.hset(KEYS.coins, mint, coin)
  await store.lpush(KEYS.memory(mint), 'was dropped into the tank', 8)
  return Response.json({ coin })
}
