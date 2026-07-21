import { describe, expect, it } from "vitest"

import {
  resolveVoyantNodeProviderPlan,
  validateVoyantNodeProviderPlanEnv,
} from "./node-provider-plan"

describe("resolveVoyantNodeProviderPlan", () => {
  it("keeps memory providers even when external provider env is present", () => {
    const plan = resolveVoyantNodeProviderPlan({
      storage: "memory",
      cache: "memory",
      sharedState: "memory",
      rateLimit: "memory",
    })

    expect(plan).toEqual({
      storage: "memory",
      cache: "memory",
      sharedState: "memory",
      rateLimit: "memory",
    })
    expect(
      validateVoyantNodeProviderPlanEnv(plan, {
        REDIS_URL: "redis://example.test:6379",
        DATABASE_URL: "postgres://user:pass@example.test:5432/voyant",
        S3_ENDPOINT: "https://objects.example.test",
        S3_ACCESS_KEY_ID: "key",
        S3_SECRET_ACCESS_KEY: "secret",
        STORAGE_MEDIA_BUCKET: "media",
        STORAGE_DOCUMENTS_BUCKET: "documents",
      }),
    ).toEqual([])
  })

  it("maps redis, postgres, and object storage graph providers to the Node plan", () => {
    const plan = resolveVoyantNodeProviderPlan({
      storage: "s3-compatible",
      cache: "redis",
      sharedState: "redis",
      rateLimit: "postgres",
    })

    expect(plan).toEqual({
      storage: "s3-compatible",
      cache: "redis",
      sharedState: "redis",
      rateLimit: "postgres",
    })
  })

  it("validates env required by the selected graph providers", () => {
    const plan = resolveVoyantNodeProviderPlan({
      storage: "s3-compatible",
      cache: "redis",
      sharedState: "redis",
      rateLimit: "postgres",
    })

    expect(validateVoyantNodeProviderPlanEnv(plan, {})).toEqual([
      "env S3_REGION is required by the Node provider plan",
      "env STORAGE_MEDIA_BUCKET is required by the Node provider plan",
      "env STORAGE_DOCUMENTS_BUCKET is required by the Node provider plan",
      "env REDIS_URL is required by the Node provider plan",
      "env DATABASE_URL or DATABASE_URL_DIRECT is required by the Node provider plan",
    ])
  })

  it("maps the managed storage gateway provider and requires its endpoint + token", () => {
    const plan = resolveVoyantNodeProviderPlan({
      storage: "gateway",
      cache: "memory",
      sharedState: "memory",
      rateLimit: "memory",
    })

    expect(plan.storage).toBe("gateway")
    expect(validateVoyantNodeProviderPlanEnv(plan, {})).toEqual([
      "env STORAGE_GATEWAY_ENDPOINT is required by the Node provider plan",
      "env STORAGE_GATEWAY_TOKEN is required by the Node provider plan",
    ])
    expect(
      validateVoyantNodeProviderPlanEnv(plan, {
        STORAGE_GATEWAY_ENDPOINT: "https://gw.example.test",
        STORAGE_GATEWAY_TOKEN: "tok",
      }),
    ).toEqual([])
  })

  it("accepts DATABASE_URL_DIRECT for Postgres provider roles", () => {
    const plan = resolveVoyantNodeProviderPlan({
      storage: "memory",
      cache: "postgres",
      sharedState: "memory",
      rateLimit: "memory",
    })

    expect(
      validateVoyantNodeProviderPlanEnv(plan, {
        DATABASE_URL_DIRECT: "postgres://user:pass@example.test:5432/voyant",
      }),
    ).toEqual([])
  })

  it("rejects unsupported graph providers", () => {
    expect(() =>
      resolveVoyantNodeProviderPlan({
        storage: "local-disk",
        cache: "memory",
        sharedState: "memory",
        rateLimit: "memory",
      }),
    ).toThrow(/providers\.storage=local-disk/)
    expect(() =>
      resolveVoyantNodeProviderPlan({
        storage: "memory",
        cache: "memcached",
        sharedState: "memory",
        rateLimit: "memory",
      }),
    ).toThrow(/providers\.cache=memcached/)
  })

  it("requires explicit graph provider roles used by the Node runtime", () => {
    expect(() =>
      resolveVoyantNodeProviderPlan({
        storage: "memory",
        cache: "memory",
        rateLimit: "memory",
      }),
    ).toThrow(/providers\.sharedState/)
  })
})
