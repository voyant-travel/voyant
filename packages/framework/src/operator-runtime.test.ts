import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  createManagedOperatorNodeEnv,
  createManagedOperatorProviders,
  loadManagedOperatorRuntime,
} from "./operator-runtime.js"
import { defineVoyantProject } from "./profile.js"

describe("managed operator runtime entry", () => {
  it("loads a standard operator profile snapshot without starter-local glue", async () => {
    const dir = await mkdtemp(join(tmpdir(), "voyant-profile-"))
    const snapshotPath = join(dir, "operator-profile.json")
    await writeFile(
      snapshotPath,
      JSON.stringify(
        defineVoyantProject({
          profile: "operator",
          frameworkVersion: "0.12.22",
          modules: ["catalog", "bookings", "finance", "relationships"],
        }),
      ),
    )

    const runtime = await loadManagedOperatorRuntime({
      profileSnapshotPath: snapshotPath,
      env: {
        DATABASE_URL: "managed-operator-test-db",
      },
    })

    expect(runtime.project.profile).toBe("operator")
    expect(runtime.requirements.modules.createVoyantAppExclude).toContain("@voyant-travel/flights")
    expect(runtime.app.fetch).toEqual(expect.any(Function))
  })

  it("builds managed Node bindings from plain env/secrets", () => {
    const env = createManagedOperatorNodeEnv({
      DATABASE_URL: "managed-operator-test-db",
      R2_S3_ENDPOINT: "https://r2.example.test",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_MEDIA: "media",
      R2_BUCKET_DOCUMENTS: "documents",
    })

    expect(env.CACHE).toBeDefined()
    expect(env.RATE_LIMIT).toBeDefined()
    expect(env.MEDIA_BUCKET).toBeDefined()
    expect(env.DOCUMENTS_BUCKET).toBeDefined()
  })

  it("keeps the runtime entry free of starter/operator imports", async () => {
    const source = await readFile(new URL("./operator-runtime.ts", import.meta.url), "utf8")

    expect(source).not.toContain("starters/operator")
    expect(source).not.toContain("../../starters")
    expect(createManagedOperatorProviders()).toBeDefined()
  })

  it("keeps payment starters provider-neutral", async () => {
    const defaultProviders = createManagedOperatorProviders()
    expect(defaultProviders.resolvePaymentStarters?.({})).toEqual({})
    expect(defaultProviders).not.toHaveProperty("netopiaCheckoutStarter")

    const providers = createManagedOperatorProviders({
      resolvePaymentStarters: () => ({
        stripe: async () => ({
          provider: "stripe",
          paymentSessionId: "ps_test",
          redirectUrl: "https://pay.example.test/session",
          externalReference: null,
          providerSessionId: "checkout_session",
          providerPaymentId: null,
          response: null,
        }),
      }),
    })

    expect(Object.keys(providers.resolvePaymentStarters?.({}) ?? {})).toEqual(["stripe"])
  })
})
