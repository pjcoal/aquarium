import type { Transaction, VersionedTransaction } from '@solana/web3.js'

/** the subset of the injected Solana wallet API (Phantom, Solflare, Backpack) we use */
export interface SolanaProvider {
  publicKey?: { toString(): string } | null
  connect(): Promise<unknown>
  disconnect?(): Promise<void>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
}

export interface DetectedWallet {
  name: string
  provider: SolanaProvider
}

type Injected = {
  phantom?: { solana?: SolanaProvider & { isPhantom?: boolean } }
  solflare?: SolanaProvider & { isSolflare?: boolean }
  backpack?: SolanaProvider
  solana?: SolanaProvider
}

export function detectWallets(): DetectedWallet[] {
  const w = window as unknown as Injected
  const out: DetectedWallet[] = []
  if (w.phantom?.solana) out.push({ name: 'Phantom', provider: w.phantom.solana })
  if (w.solflare) out.push({ name: 'Solflare', provider: w.solflare })
  if (w.backpack) out.push({ name: 'Backpack', provider: w.backpack })
  if (!out.length && w.solana) out.push({ name: 'Solana wallet', provider: w.solana })
  return out
}

export async function connectWallet(wallet: DetectedWallet): Promise<string> {
  await wallet.provider.connect()
  const pk = wallet.provider.publicKey?.toString()
  if (!pk) throw new Error('the wallet did not share an address')
  return pk
}
