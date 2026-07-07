type RedisConstructor = new (options: { url: string; token: string }) => RedisClient

interface RedisModule {
  Redis: RedisConstructor & {
    fromEnv?: () => RedisClient
  }
}

export interface RedisClient {
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: string, options?: { ex?: number }): Promise<unknown>
  del(key: string): Promise<unknown>
  scan?(
    cursor: number,
    options?: { match?: string; count?: number },
  ): Promise<[number | string, string[]]>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
}

export interface LazyRedisClient {
  get(): Promise<RedisClient>
}

function parseRedisRestUrl(rawUrl: string): { url: string; token: string } {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("REDIS_URL must be an HTTP(S) Redis REST URL.")
  }

  const token = parsed.password || parsed.searchParams.get("token") || ""
  if (!token) {
    throw new Error("REDIS_URL must include a Redis REST token as the URL password or token query.")
  }

  parsed.username = ""
  parsed.password = ""
  parsed.searchParams.delete("token")
  return {
    url: parsed.toString().replace(/\/$/, ""),
    token: decodeURIComponent(token),
  }
}

export function createLazyRedisClient(redisUrl: string): LazyRedisClient {
  let clientPromise: Promise<RedisClient> | undefined

  return {
    get() {
      clientPromise ??= import("@upstash/redis").then((mod: RedisModule) => {
        const { url, token } = parseRedisRestUrl(redisUrl)
        return new mod.Redis({ url, token })
      })
      return clientPromise
    },
  }
}
