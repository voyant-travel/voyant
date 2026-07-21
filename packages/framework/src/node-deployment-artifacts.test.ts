import { describe, expect, it } from "vitest"

import { validateVoyantNodeDeploymentGraphResourceEnv } from "./node-deployment-artifacts.js"

const redisResource = {
  resourceRequirements: [
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
          format: "redis-url" as const,
        },
      ],
    },
  ],
}

describe("validateVoyantNodeDeploymentGraphResourceEnv", () => {
  it("accepts Upstash-compatible Redis REST URLs with a token", () => {
    expect(
      validateVoyantNodeDeploymentGraphResourceEnv(redisResource, {
        REDIS_URL: "https://default:test-token@example.upstash.io",
      }),
    ).toEqual([])
    expect(
      validateVoyantNodeDeploymentGraphResourceEnv(redisResource, {
        REDIS_URL: "https://example.upstash.io?token=test-token",
      }),
    ).toEqual([])
  })

  it("rejects raw Redis socket URLs for the REST Redis client contract", () => {
    expect(
      validateVoyantNodeDeploymentGraphResourceEnv(redisResource, {
        REDIS_URL: "redis://example.test:6379",
      }),
    ).toEqual(["secret REDIS_URL must be an HTTP(S) Redis REST URL with a token for redis"])
  })
})
