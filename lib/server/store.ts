import 'server-only'
import { Redis } from '@upstash/redis'

/** The handful of operations the shared tank needs. */
export interface Store {
  readonly kind: 'redis' | 'memory'
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<void>
  hgetall<T>(key: string): Promise<Record<string, T>>
  hget<T>(key: string, field: string): Promise<T | null>
  hset(key: string, field: string, value: unknown): Promise<void>
  /** push to the front of a list and keep only `max` items */
  lpush(key: string, value: unknown, max: number): Promise<void>
  lrange<T>(key: string, count: number): Promise<T[]>
  /** set if absent with a TTL; true when this caller got it */
  claim(key: string, ttlSec: number): Promise<boolean>
  /** increment a counter that expires after ttlSec */
  incr(key: string, ttlSec: number): Promise<number>
  /** add to a set; true if it was not already there */
  sadd(key: string, member: string): Promise<boolean>
}

class RedisStore implements Store {
  readonly kind = 'redis' as const
  constructor(private r: Redis) {}
  async get<T>(key: string) {
    return (await this.r.get<T>(key)) ?? null
  }
  async set(key: string, value: unknown) {
    await this.r.set(key, value)
  }
  async hgetall<T>(key: string) {
    return ((await this.r.hgetall<Record<string, T>>(key)) ?? {}) as Record<string, T>
  }
  async hget<T>(key: string, field: string) {
    return (await this.r.hget<T>(key, field)) ?? null
  }
  async hset(key: string, field: string, value: unknown) {
    await this.r.hset(key, { [field]: value })
  }
  async lpush(key: string, value: unknown, max: number) {
    const p = this.r.pipeline()
    p.lpush(key, value)
    p.ltrim(key, 0, max - 1)
    await p.exec()
  }
  async lrange<T>(key: string, count: number) {
    return await this.r.lrange<T>(key, 0, count - 1)
  }
  async claim(key: string, ttlSec: number) {
    return (await this.r.set(key, 1, { nx: true, ex: ttlSec })) === 'OK'
  }
  async incr(key: string, ttlSec: number) {
    const p = this.r.pipeline()
    p.incr(key)
    p.expire(key, ttlSec)
    const [n] = await p.exec<[number, number]>()
    return n
  }
  async sadd(key: string, member: string) {
    return (await this.r.sadd(key, member)) === 1
  }
}

/** Local development only: state lives in this server process. */
class MemoryStore implements Store {
  readonly kind = 'memory' as const
  private kv = new Map<string, unknown>()
  private exp = new Map<string, number>()
  private live(key: string) {
    const e = this.exp.get(key)
    if (e !== undefined && e < Date.now()) {
      this.kv.delete(key)
      this.exp.delete(key)
    }
    return this.kv.get(key)
  }
  async get<T>(key: string) {
    return (structuredClone(this.live(key)) as T) ?? null
  }
  async set(key: string, value: unknown) {
    this.kv.set(key, structuredClone(value))
  }
  async hgetall<T>(key: string) {
    return structuredClone((this.live(key) as Record<string, T>) ?? {})
  }
  async hget<T>(key: string, field: string) {
    const h = this.live(key) as Record<string, T> | undefined
    return h && field in h ? structuredClone(h[field]) : null
  }
  async hset(key: string, field: string, value: unknown) {
    const h = (this.live(key) as Record<string, unknown>) ?? {}
    h[field] = structuredClone(value)
    this.kv.set(key, h)
  }
  async lpush(key: string, value: unknown, max: number) {
    const l = ((this.live(key) as unknown[]) ?? []).slice()
    l.unshift(structuredClone(value))
    this.kv.set(key, l.slice(0, max))
  }
  async lrange<T>(key: string, count: number) {
    return structuredClone(((this.live(key) as T[]) ?? []).slice(0, count))
  }
  async claim(key: string, ttlSec: number) {
    if (this.live(key) !== undefined) return false
    this.kv.set(key, 1)
    this.exp.set(key, Date.now() + ttlSec * 1000)
    return true
  }
  async incr(key: string, ttlSec: number) {
    const n = ((this.live(key) as number) ?? 0) + 1
    this.kv.set(key, n)
    if (!this.exp.has(key)) this.exp.set(key, Date.now() + ttlSec * 1000)
    return n
  }
  async sadd(key: string, member: string) {
    const s = (this.live(key) as string[]) ?? []
    if (s.includes(member)) return false
    this.kv.set(key, [...s, member])
    return true
  }
}

const g = globalThis as unknown as { __aquariumStore?: Store }

export function getStore(): Store {
  if (!g.__aquariumStore) {
    const configured = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)
    g.__aquariumStore = configured ? new RedisStore(Redis.fromEnv()) : new MemoryStore()
  }
  return g.__aquariumStore
}

export const KEYS = {
  coins: 'aq:coins',
  conversations: 'aq:convos',
  thoughts: 'aq:thoughts',
  escape: 'aq:escape',
  markets: 'aq:markets',
  usedSigs: 'aq:usedsigs',
  memory: (mint: string) => `aq:mem:${mint}`,
  talkLock: 'aq:lock:talk',
  thinkLock: 'aq:lock:think',
  llmHour: () => `aq:llm:${new Date().toISOString().slice(0, 13)}`,
}
