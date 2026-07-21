import { beforeEach, describe, expect, it, vi } from "vitest"

const redisKvConstructed = vi.hoisted(
  () => [] as Array<{ redisUrl: string; keyPrefix: string | undefined; keys: string[] }>,
)

vi.mock("@voyant-travel/utils/redis-kv", () => ({
  createRedisKvStore: (redisUrl: string, options?: { keyPrefix?: string }) => {
    const keys: string[] = []
    redisKvConstructed.push({ redisUrl, keyPrefix: options?.keyPrefix, keys })
    return {
      get: async () => null,
      put: async (key: string) => {
        keys.push(`${options?.keyPrefix ?? ""}${key}`)
      },
      delete: async (key: string) => {
        keys.push(`${options?.keyPrefix ?? ""}${key}`)
      },
      list: async () => ({ keys: [] }),
    }
  },
}))

import { createVoyantGraphRuntime } from "./deployment-artifacts.js"
import {
  DEFAULT_MANAGED_CLOUD_PROVIDERS,
  type VoyantDeploymentProviders,
} from "./deployment-types.js"
import { createVoyantNodeEnv, loadVoyantNodeRuntime } from "./node-runtime.js"

beforeEach(() => {
  redisKvConstructed.length = 0
})

describe("createVoyantNodeEnv Redis namespace", () => {
  it("accepts a stable Redis namespace for Redis-backed cache/rate providers", () => {
    const env = createVoyantNodeEnv(
      {
        REDIS_URL: "https://example.upstash.io?token=test-token",
        REDIS_NAMESPACE: "region_eu-1",
      },
      {
        storage: "memory",
        cache: "redis",
        sharedState: "memory",
        rateLimit: "redis",
      },
    )

    expect(env.REDIS_NAMESPACE).toBe("region_eu-1")
  })

  it("uses a distinct Redis state prefix for self-hosted shared state", async () => {
    const env = createVoyantNodeEnv(
      {
        REDIS_URL: "https://example.upstash.io?token=test-token",
        REDIS_NAMESPACE: "region_eu-1",
      },
      {
        storage: "memory",
        cache: "memory",
        sharedState: "redis",
        rateLimit: "memory",
      },
    )

    await env.SHARED_STATE!.put("workflow:1", "running")

    expect(redisKvConstructed).toEqual([
      {
        redisUrl: "https://example.upstash.io?token=test-token",
        keyPrefix: "voyant:v1:region_eu-1:cache:",
        keys: [],
      },
      {
        redisUrl: "https://example.upstash.io?token=test-token",
        keyPrefix: "voyant:v1:region_eu-1:state:",
        keys: ["voyant:v1:region_eu-1:state:workflow:1"],
      },
    ])
  })

  it("keeps managed Cloud shared state on Postgres by default", () => {
    expect(DEFAULT_MANAGED_CLOUD_PROVIDERS.sharedState).toBe("postgres")
  })

  it("rejects Redis namespaces with structural separators", () => {
    expect(() =>
      createVoyantNodeEnv(
        {
          REDIS_URL: "https://example.upstash.io?token=test-token",
          REDIS_NAMESPACE: "region/eu",
        },
        {
          storage: "memory",
          cache: "redis",
          sharedState: "memory",
          rateLimit: "redis",
        },
      ),
    ).toThrow(/REDIS_NAMESPACE/)
  })
})

describe("loadVoyantNodeRuntime Redis URL validation", () => {
  it("requires REDIS_NAMESPACE when only managed shared state uses Redis", async () => {
    const providers = {
      ...DEFAULT_MANAGED_CLOUD_PROVIDERS,
      storage: "memory",
      cache: "memory",
      sharedState: "redis",
      rateLimit: "memory",
      adminAuth: "voyant-cloud",
      customerAuth: "disabled",
      workflows: "none",
    } satisfies VoyantDeploymentProviders
    const graphRuntime = createVoyantGraphRuntime({
      graphHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      entries: {},
      modules: [],
      plugins: [],
      providerSelections: providers,
    })

    await expect(
      loadVoyantNodeRuntime({
        graphRuntime,
        deployment: {
          mode: "managed-cloud",
          providers,
        },
        deploymentRequirements: {
          resources: [
            {
              resourceKey: "redis",
              roles: ["sharedState"],
              provider: "redis",
              required: true,
              env: [
                {
                  name: "REDIS_URL",
                  kind: "secret",
                  required: true,
                  description: "Redis REST URL.",
                  format: "redis-url",
                },
                {
                  name: "REDIS_NAMESPACE",
                  kind: "variable",
                  required: false,
                  description: "Redis key namespace.",
                },
              ],
            },
          ],
        },
        env: {
          REDIS_URL: "https://example.upstash.io?token=test-token",
        },
        auth: {
          handler: () => ({
            fetch: async () => new Response(null, { status: 404 }),
          }),
        },
      }),
    ).rejects.toThrow(
      /managed-cloud Redis cache, shared-state, and rate-limit providers require REDIS_NAMESPACE/,
    )
  })

  it("allows managed Redis shared state when REDIS_NAMESPACE is configured", async () => {
    const providers = {
      ...DEFAULT_MANAGED_CLOUD_PROVIDERS,
      storage: "memory",
      cache: "memory",
      sharedState: "redis",
      rateLimit: "memory",
      adminAuth: "voyant-cloud",
      customerAuth: "disabled",
      workflows: "none",
    } satisfies VoyantDeploymentProviders
    const graphRuntime = createVoyantGraphRuntime({
      graphHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      entries: {},
      modules: [],
      plugins: [],
      providerSelections: providers,
    })

    await expect(
      loadVoyantNodeRuntime({
        graphRuntime,
        deployment: {
          mode: "managed-cloud",
          providers,
        },
        deploymentRequirements: {
          resources: [
            {
              resourceKey: "redis",
              roles: ["sharedState"],
              provider: "redis",
              required: true,
              env: [
                {
                  name: "REDIS_URL",
                  kind: "secret",
                  required: true,
                  description: "Redis REST URL.",
                  format: "redis-url",
                },
                {
                  name: "REDIS_NAMESPACE",
                  kind: "variable",
                  required: false,
                  description: "Redis key namespace.",
                },
              ],
            },
          ],
        },
        env: {
          REDIS_URL: "https://example.upstash.io?token=test-token",
          REDIS_NAMESPACE: "region_eu-1",
        },
        auth: {
          handler: () => ({
            fetch: async () => new Response(null, { status: 404 }),
          }),
        },
      }),
    ).resolves.toMatchObject({
      deployment: { mode: "managed-cloud" },
      env: { REDIS_NAMESPACE: "region_eu-1" },
    })
  })

  it("rejects raw Redis socket URLs for Redis REST providers", async () => {
    const providers = {
      ...DEFAULT_MANAGED_CLOUD_PROVIDERS,
      cache: "redis",
      sharedState: "memory",
      rateLimit: "memory",
      storage: "memory",
      adminAuth: "better-auth",
      workflows: "none",
    } satisfies VoyantDeploymentProviders
    const graphRuntime = createVoyantGraphRuntime({
      graphHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      entries: {},
      modules: [],
      plugins: [],
      providerSelections: providers,
    })

    await expect(
      loadVoyantNodeRuntime({
        graphRuntime,
        deployment: {
          mode: "self-hosted",
          providers,
        },
        deploymentRequirements: {
          resources: [
            {
              resourceKey: "redis",
              roles: ["cache"],
              provider: "redis",
              required: true,
              env: [
                {
                  name: "REDIS_URL",
                  kind: "secret",
                  required: true,
                  description: "Redis REST URL.",
                  format: "redis-url",
                },
              ],
            },
          ],
        },
        env: {
          REDIS_URL: "redis://example.test:6379",
        },
      }),
    ).rejects.toThrow(/REDIS_URL must be an HTTP\(S\) Redis REST URL with a token/)
  })

  it("allows HTTP Redis REST URLs for self-hosted providers", async () => {
    const providers = {
      ...DEFAULT_MANAGED_CLOUD_PROVIDERS,
      cache: "redis",
      sharedState: "memory",
      rateLimit: "memory",
      storage: "memory",
      adminAuth: "better-auth",
      workflows: "none",
    } satisfies VoyantDeploymentProviders
    const graphRuntime = createVoyantGraphRuntime({
      graphHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      entries: {},
      modules: [],
      plugins: [],
      providerSelections: providers,
    })

    await expect(
      loadVoyantNodeRuntime({
        graphRuntime,
        deployment: {
          mode: "self-hosted",
          providers,
        },
        deploymentRequirements: {
          resources: [
            {
              resourceKey: "redis",
              roles: ["cache"],
              provider: "redis",
              required: true,
              env: [
                {
                  name: "REDIS_URL",
                  kind: "secret",
                  required: true,
                  description: "Redis REST URL.",
                  format: "redis-url",
                },
              ],
            },
          ],
        },
        env: {
          REDIS_URL: "http://localhost:8079?token=test-token",
        },
      }),
    ).resolves.toMatchObject({
      deployment: { mode: "self-hosted" },
    })
  })

  it("requires HTTPS Redis REST URLs for managed Cloud providers", async () => {
    const providers = {
      ...DEFAULT_MANAGED_CLOUD_PROVIDERS,
      storage: "memory",
      adminAuth: "voyant-cloud",
      workflows: "none",
    } satisfies VoyantDeploymentProviders
    const graphRuntime = createVoyantGraphRuntime({
      graphHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      entries: {},
      modules: [],
      plugins: [],
      providerSelections: providers,
    })

    await expect(
      loadVoyantNodeRuntime({
        graphRuntime,
        deployment: {
          mode: "managed-cloud",
          providers,
        },
        deploymentRequirements: {
          resources: [
            {
              resourceKey: "redis",
              roles: ["cache", "rateLimit"],
              provider: "redis",
              required: true,
              env: [
                {
                  name: "REDIS_URL",
                  kind: "secret",
                  required: true,
                  description: "Redis REST URL.",
                  format: "redis-url",
                },
              ],
            },
          ],
        },
        env: {
          DATABASE_URL: "postgres://user:pass@localhost:5432/voyant",
          REDIS_URL: "http://localhost:8079?token=test-token",
          REDIS_NAMESPACE: "region_eu-1",
        },
        auth: {
          handler: () => ({
            fetch: async () => new Response(null, { status: 404 }),
          }),
        },
      }),
    ).rejects.toThrow(/managed-cloud Redis providers require REDIS_URL to use HTTPS/)
  })
})
