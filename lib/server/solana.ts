import 'server-only'
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, type VersionedTransactionResponse } from '@solana/web3.js'

/** pump.fun's bonding-curve program, invoked by every create transaction */
export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'

let conn: Connection | null = null
export function rpc(): Connection {
  conn ??= new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed')
  return conn
}

export function launchSettings() {
  const raw = (process.env.NEXT_PUBLIC_TREASURY_WALLET ?? '').trim()
  let treasury: string | null = null
  try {
    treasury = raw ? new PublicKey(raw).toBase58() : null
  } catch {
    treasury = null
  }
  const feeSol = Number(process.env.NEXT_PUBLIC_LAUNCH_FEE_SOL || 0.05)
  return { treasury, feeSol: Number.isFinite(feeSol) && feeSol >= 0 ? feeSol : 0.05 }
}

export function isPublicKey(s: unknown): s is string {
  if (typeof s !== 'string' || s.length < 32 || s.length > 44) return false
  try {
    new PublicKey(s)
    return true
  } catch {
    return false
  }
}

/** a transfer of the launch fee from the creator to the treasury, for the creator to sign */
export async function buildFeeTransaction(creator: string): Promise<string> {
  const { treasury, feeSol } = launchSettings()
  if (!treasury) throw new Error('treasury not configured')
  const { blockhash } = await rpc().getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: new PublicKey(creator), recentBlockhash: blockhash }).add(
    SystemProgram.transfer({ fromPubkey: new PublicKey(creator), toPubkey: new PublicKey(treasury), lamports: Math.round(feeSol * LAMPORTS_PER_SOL) }),
  )
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64')
}

function accountKeys(tx: VersionedTransactionResponse): PublicKey[] {
  const msg = tx.transaction.message
  const keys = msg.version === 0 ? msg.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses }) : msg.getAccountKeys()
  return keys.keySegments().flat()
}

async function fetchTx(sig: string): Promise<VersionedTransactionResponse | null> {
  // a just-confirmed transaction can take a moment to be queryable
  for (let i = 0; i < 4; i++) {
    const tx = await rpc().getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
    if (tx) return tx
    await new Promise((r) => setTimeout(r, 1500))
  }
  return null
}

/**
 * Confirm on-chain that `creator` really created `mint` on pump.fun and paid
 * the launch fee to the treasury.
 */
export async function verifyLaunch(input: { mint: string; creator: string; createSig: string; feeSig: string }): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { treasury, feeSol } = launchSettings()
  if (!treasury) return { ok: false, reason: 'launching is not configured (no treasury wallet)' }
  const [create, fee] = await Promise.all([fetchTx(input.createSig), fetchTx(input.feeSig)])

  if (!create) return { ok: false, reason: 'create transaction not found yet' }
  if (create.meta?.err) return { ok: false, reason: 'create transaction failed on-chain' }
  const ck = accountKeys(create)
  const at = (k: string) => ck.findIndex((p) => p.toBase58() === k)
  const mintIdx = at(input.mint)
  const creatorIdx = at(input.creator)
  if (at(PUMP_PROGRAM) < 0) return { ok: false, reason: 'not a pump.fun transaction' }
  // the mint keypair signs only the transaction that creates it
  if (mintIdx < 0 || !create.transaction.message.isAccountSigner(mintIdx)) return { ok: false, reason: 'transaction did not create this mint' }
  if (creatorIdx < 0 || !create.transaction.message.isAccountSigner(creatorIdx)) return { ok: false, reason: 'creator did not sign the create transaction' }

  if (!fee) return { ok: false, reason: 'fee transaction not found yet' }
  if (fee.meta?.err) return { ok: false, reason: 'fee transaction failed on-chain' }
  const fk = accountKeys(fee)
  const ti = fk.findIndex((p) => p.toBase58() === treasury)
  const pi = fk.findIndex((p) => p.toBase58() === input.creator)
  if (ti < 0 || pi < 0 || !fee.transaction.message.isAccountSigner(pi)) return { ok: false, reason: 'fee was not paid by the creator to the treasury' }
  const received = (fee.meta?.postBalances[ti] ?? 0) - (fee.meta?.preBalances[ti] ?? 0)
  if (received < Math.round(feeSol * LAMPORTS_PER_SOL) - 1) return { ok: false, reason: `fee too small (needs ${feeSol} SOL)` }
  if (fee.blockTime && Date.now() / 1000 - fee.blockTime > 24 * 3600) return { ok: false, reason: 'fee payment is too old' }
  return { ok: true }
}
