import { after } from 'next/server'
import { getTankState, tick } from '@/lib/server/brains'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// brains finish their conversation after the response has been sent
export const maxDuration = 60

export async function GET() {
  const state = await getTankState()
  after(tick)
  return Response.json(state, { headers: { 'cache-control': 'no-store' } })
}
