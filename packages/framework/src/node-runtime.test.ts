import { afterEach, describe, expect, it, vi } from "vitest"
import type { VoyantDeploymentProviders } from "./deployment-types.js"
import { createVoyantNodeEnv, loadVoyantNodeRuntime } from "./node-runtime.js"
import { createVoyantGraphRuntime } from "./runtime-lowering.js"

const redisOperations = vi.hoisted(
  () => [] as Array<{ op: string; key: string; redisUrl?: string }>,
)

vi.mock("@voyant-travel/utils/redis-kv", () => ({
  createRedisKvStore: (redisUrl: string, options?: { keyPrefix?: string }) => {
    const values = new Map<string, string>()
    const keyPrefix = options?.keyPrefix ?? ""

    return {
      async get<T = string>(key: string): Promise<T | null> {
        const physicalKey = `${keyPrefix}${key}`
        redisOperations.push({ op: "get", key: physicalKey, redisUrl })
        return (values.get(physicalKey) ?? null) as T | null
      },
      async put(key: string, value: string): Promise<void> {
        const physicalKey = `${keyPrefix}${key}`
        redisOperations.push({ op: "set", key: physicalKey, redisUrl })
        values.set(physicalKey, value)
      },
      async delete(key: string): Promise<void> {
        const physicalKey = `${keyPrefix}${key}`
        redisOperations.push({ op: "del", key: physicalKey, redisUrl })
        values.delete(physicalKey)
      },
      async list(): Promise<{ keys: Array<{ name: string }> }> {
        return { keys: [] }
      },
    }
  },
}))

vi.mock("@voyant-travel/hono", async (importOriginal) => {
  const original = await importOriginal<typeof import("@voyant-travel/hono")>()

  return {
    ...original,
    createRedisRateLimitStore: (redisUrl: string, options?: { keyPrefix?: string }) => ({
      async limit(key: string, { windowSeconds }: { max: number; windowSeconds: number }) {
        const windowKey = Math.floor(Math.floor(Date.now() / 1000) / windowSeconds)
        const physicalKey = `${options?.keyPrefix ?? ""}${key}:${windowKey}`
        redisOperations.push({ op: "incr", key: physicalKey, redisUrl })
        redisOperations.push({ op: "expire", key: physicalKey, redisUrl })
        return { allowed: true, remaining: 1, retryAfterSeconds: windowSeconds }
      },
    }),
  }
})

const BASE_PROVIDERS = {
  database: "postgres",
  storage: "memory",
  cache: "memory",
  sharedState: "memory",
  rateLimit: "memory",
  search: "none",
  email: "none",
  sms: "none",
  adminAuth: "voyant-cloud",
  customerAuth: "disabled",
  realtime: "none",
  scheduledJobs: "none",
  workflows: "none",
  outboundWebhooks: "none",
  payments: "none",
} satisfies VoyantDeploymentProviders

afterEach(() => {
  redisOperations.length = 0
})

function emptyGraphRuntime(providers: VoyantDeploymentProviders) {
  return createVoyantGraphRuntime({
    graphHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    entries: {},
    modules: [],
    plugins: [],
    providerSelections: { ...providers },
  })
}

function authIntegration() {
  return {
    handler: () => ({
      fetch: async () => new Response(null, { status: 404 }),
    }),
  }
}

describe("createVoyantNodeEnv Redis namespace", () => {
  it("uses role-specific Redis key prefixes when REDIS_NAMESPACE is supplied", async () => {
    const env = createVoyantNodeEnv(
      {
        REDIS_URL: "https://example.upstash.io?token=test-token",
        REDIS_NAMESPACE: "region_eu-1",
      },
      {
        storage: "memory",
        cache: "redis",
        sharedState: "redis",
        rateLimit: "redis",
      },
    )

    await env.CACHE!.put("cache-key", "cache-value")
    await env.SHARED_STATE!.put("state-key", "state-value")
    await env.RATE_LIMIT_STORE!.limit("lim:auth:client", { max: 10, windowSeconds: 60 })

    expect(redisOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "set", key: "voyant:v1:region_eu-1:cache:cache-key" }),
        expect.objectContaining({ op: "set", key: "voyant:v1:region_eu-1:state:state-key" }),
        expect.objectContaining({
          op: "incr",
          key: expect.stringMatching(/^voyant:v1:region_eu-1:rate:lim:auth:client:\d+$/u),
        }),
        expect.objectContaining({
          op: "expire",
          key: expect.stringMatching(/^voyant:v1:region_eu-1:rate:lim:auth:client:\d+$/u),
        }),
      ]),
    )
  })

  it("leaves self-hosted Redis shared state compatible when namespace is omitted", async () => {
    const env = createVoyantNodeEnv(
      {
        REDIS_URL: "http://redis-rest.local?token=test-token",
      },
      {
        storage: "memory",
        cache: "memory",
        sharedState: "redis",
        rateLimit: "memory",
      },
    )

    await env.SHARED_STATE!.put("state-key", "state-value")

    expect(redisOperations).toContainEqual(expect.objectContaining({ op: "set", key: "state-key" }))
  })
})

describe("loadVoyantNodeRuntime Redis URL validation", () => {
  it("requires REDIS_NAMESPACE when managed shared state uses Redis", async () => {
    const providers = {
      ...BASE_PROVIDERS,
      sharedState: "redis",
    } satisfies VoyantDeploymentProviders

    await expect(
      loadVoyantNodeRuntime({
        graphRuntime: emptyGraphRuntime(providers),
        deployment: { mode: "managed-cloud", providers },
        deploymentRequirements: { resources: [] },
        env: {
          REDIS_URL: "https://example.upstash.io?token=test-token",
        },
        auth: authIntegration(),
      }),
    ).rejects.toThrow(
      /managed-cloud Redis cache, shared-state, and rate-limit providers require REDIS_NAMESPACE/,
    )
  })

  it("rejects HTTP Redis REST URLs in managed cloud", async () => {
    const providers = {
      ...BASE_PROVIDERS,
      cache: "redis",
    } satisfies VoyantDeploymentProviders

    await expect(
      loadVoyantNodeRuntime({
        graphRuntime: emptyGraphRuntime(providers),
        deployment: { mode: "managed-cloud", providers },
        deploymentRequirements: { resources: [] },
        env: {
          REDIS_URL: "http://example.upstash.io?token=test-token",
          REDIS_NAMESPACE: "region-eu-1",
        },
        auth: authIntegration(),
      }),
    ).rejects.toThrow(/managed-cloud Redis providers require an HTTPS Redis REST URL with a token/)
  })

  it("allows managed Redis providers when HTTPS URL and namespace are configured", async () => {
    const providers = {
      ...BASE_PROVIDERS,
      cache: "redis",
      rateLimit: "redis",
    } satisfies VoyantDeploymentProviders

    await expect(
      loadVoyantNodeRuntime({
        graphRuntime: emptyGraphRuntime(providers),
        deployment: { mode: "managed-cloud", providers },
        deploymentRequirements: { resources: [] },
        env: {
          REDIS_URL: "https://example.upstash.io?token=test-token",
          REDIS_NAMESPACE: "region-eu-1",
        },
        auth: authIntegration(),
      }),
    ).resolves.toMatchObject({
      deployment: { mode: "managed-cloud" },
      env: { REDIS_NAMESPACE: "region-eu-1" },
    })
  })
})
