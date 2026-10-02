/**
 * Token configuration. Until launch, leave NEXT_PUBLIC_TOKEN_MINT unset and the
 * tank runs on a simulated market. After launch, set it (e.g. in Vercel's
 * environment variables) to the token's mint address and redeploy.
 */
export const TOKEN = {
  mint: (process.env.NEXT_PUBLIC_TOKEN_MINT ?? '').trim(),
  ticker: (process.env.NEXT_PUBLIC_TOKEN_TICKER ?? 'TOKEN').trim().replace(/^\$/, ''),
}

export const isTokenLive = () => TOKEN.mint.length > 0
