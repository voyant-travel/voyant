import type { KVStore } from "./cache.js"
import { createLazyRedisClient, type LazyRedisClient } from "./redis-client.js"

export interface RedisKvStoreOptions {
  client?: LazyRedisClient
  keyPrefix?: string
}

function getType(options?: "json" | { type?: "json" | "text" }): "json" | "text" {
  return typeof options === "string" ? options : (options?.type ?? "text")
}

function normalizeKeyPrefix(keyPrefix: string | undefined): string {
  if (keyPrefix === undefined || keyPrefix.length === 0) return ""
  if (hasControlCharacter(keyPrefix)) {
    throw new Error("Redis keyPrefix must not contain control characters.")
  }
  return keyPrefix
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

function physicalKey(keyPrefix: string, key: string): string {
  return `${keyPrefix}${key}`
}

function logicalKey(keyPrefix: string, key: string): string | undefined {
  if (!keyPrefix) return key
  return key.startsWith(keyPrefix) ? key.slice(keyPrefix.length) : undefined
}

function scanPattern(prefix: string): string {
  return `${prefix.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll("*", "\\*").replaceAll("?", "\\?")}*`
}

export function createRedisKvStore(redisUrl: string, options: RedisKvStoreOptions = {}): KVStore {
  const lazyClient = options.client ?? createLazyRedisClient(redisUrl)
  const keyPrefix = normalizeKeyPrefix(options.keyPrefix)

  return {
    async get<T = string>(
      key: string,
      options?: "json" | { type?: "json" | "text" },
    ): Promise<T | null> {
      const client = await lazyClient.get()
      const value = await client.get<string>(physicalKey(keyPrefix, key))
      if (value === null || value === undefined) return null
      return (
        getType(options) === "json" && typeof value === "string" ? JSON.parse(value) : value
      ) as T
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const client = await lazyClient.get()
      const storedKey = physicalKey(keyPrefix, key)
      if (options?.expirationTtl !== undefined) {
        await client.set(storedKey, value, { ex: Math.max(1, Math.ceil(options.expirationTtl)) })
        return
      }
      await client.set(storedKey, value)
    },
    async delete(key: string): Promise<void> {
      const client = await lazyClient.get()
      await client.del(physicalKey(keyPrefix, key))
    },
    async list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }> {
      const client = await lazyClient.get()
      if (!client.scan) return { keys: [] }
      const keys: Array<{ name: string }> = []
      let cursor: number | string = 0
      const match = scanPattern(physicalKey(keyPrefix, options?.prefix ?? ""))
      do {
        const [nextCursor, batch] = await client.scan(Number(cursor), { match, count: 100 })
        for (const name of batch) {
          const logicalName = logicalKey(keyPrefix, name)
          if (logicalName !== undefined) keys.push({ name: logicalName })
        }
        cursor = nextCursor
      } while (String(cursor) !== "0")
      return { keys }
    },
  }
}
