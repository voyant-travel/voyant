import type { KVStore } from "./cache.js"
import { createLazyRedisClient, type LazyRedisClient } from "./redis-client.js"

export interface RedisKvStoreOptions {
  client?: LazyRedisClient
}

function getType(options?: "json" | { type?: "json" | "text" }): "json" | "text" {
  return typeof options === "string" ? options : (options?.type ?? "text")
}

function scanPattern(prefix: string): string {
  return `${prefix.replaceAll("[", "\\[").replaceAll("*", "\\*")}*`
}

export function createRedisKvStore(redisUrl: string, options: RedisKvStoreOptions = {}): KVStore {
  const lazyClient = options.client ?? createLazyRedisClient(redisUrl)

  return {
    async get<T = string>(
      key: string,
      options?: "json" | { type?: "json" | "text" },
    ): Promise<T | null> {
      const client = await lazyClient.get()
      const value = await client.get<string>(key)
      if (value === null || value === undefined) return null
      return (
        getType(options) === "json" && typeof value === "string" ? JSON.parse(value) : value
      ) as T
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const client = await lazyClient.get()
      if (options?.expirationTtl !== undefined) {
        await client.set(key, value, { ex: Math.max(1, Math.ceil(options.expirationTtl)) })
        return
      }
      await client.set(key, value)
    },
    async delete(key: string): Promise<void> {
      const client = await lazyClient.get()
      await client.del(key)
    },
    async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
      const client = await lazyClient.get()
      if (!client.scan) return { keys: [] }
      const keys: Array<{ name: string }> = []
      let cursor: number | string = 0
      const match = scanPattern(options?.prefix ?? "")
      do {
        const [nextCursor, batch] = await client.scan(Number(cursor), { match, count: 100 })
        for (const name of batch) keys.push({ name })
        cursor = nextCursor
      } while (String(cursor) !== "0")
      return { keys }
    },
  }
}
