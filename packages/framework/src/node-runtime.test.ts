import { describe, expect, it } from "vitest"

import { createVoyantGraphRuntime } from "./deployment-artifacts.js"
import {
  DEFAULT_MANAGED_CLOUD_PROVIDERS,
  type VoyantDeploymentProviders,
} from "./deployment-types.js"
import { createVoyantNodeEnv, loadVoyantNodeRuntime } from "./node-runtime.js"

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
})
