type CacheEnvelope<T> = {
  value: T
  cachedAt: string
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '')
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

export function isRedisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN)
}

async function redisCommand<T>(command: unknown[]): Promise<T | null> {
  if (!REDIS_URL || !REDIS_TOKEN) return null

  try {
    const response = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('Redis command failed:', response.status, await response.text())
      return null
    }

    const payload = (await response.json()) as { result?: T | null }
    return payload.result ?? null
  } catch (error) {
    console.error('Redis unavailable; falling back to Supabase:', error)
    return null
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redisCommand<string>(['GET', key])
  if (!raw) return null

  try {
    const envelope = JSON.parse(raw) as CacheEnvelope<T>
    return envelope.value
  } catch {
    return null
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
  if (!isRedisConfigured()) return

  const envelope: CacheEnvelope<T> = {
    value,
    cachedAt: new Date().toISOString(),
  }

  await redisCommand(['SET', key, JSON.stringify(envelope), 'EX', Math.max(1, ttlSeconds)])
}

export async function cacheDelete(...keys: string[]): Promise<void> {
  if (!keys.length || !isRedisConfigured()) return
  await redisCommand(['DEL', ...keys])
}

export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached

  const value = await loader()
  await cacheSet(key, value, ttlSeconds)
  return value
}
