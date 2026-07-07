import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  createManagedProfileNodeEnv,
  createManagedProfileProviders,
  loadManagedProfileRuntime,
} from "./managed-runtime.js"
import { defineVoyantProject, type VoyantProjectProviders } from "./profile.js"

const localProviders = {
  database: "postgres",
  storage: "memory",
  cache: "memory",
  sharedState: "memory",
  rateLimit: "memory",
  search: "none",
  email: "none",
  sms: "none",
  auth: "better-auth",
  scheduledJobs: "none",
  workflows: "none",
} satisfies VoyantProjectProviders

describe("managed profile runtime entry", () => {
  it("loads a local source-free profile snapshot without starter-local glue", async () => {
    const dir = await mkdtemp(join(tmpdir(), "voyant-profile-"))
    const snapshotPath = join(dir, "managed-profile.json")
    await writeFile(
      snapshotPath,
      JSON.stringify(
        defineVoyantProject({
          profile: "operator",
          frameworkVersion: "0.12.22",
          mode: "local",
          modules: ["catalog", "bookings", "finance", "relationships"],
          providers: localProviders,
        }),
      ),
    )

    const runtime = await loadManagedProfileRuntime({
      profileSnapshotPath: snapshotPath,
      env: {
        DATABASE_URL: "managed-profile-test-db",
      },
    })

    expect(runtime.project.profile).toBe("operator")
    expect(runtime.requirements.modules.createVoyantAppExclude).toContain("@voyant-travel/flights")
    expect(runtime.app.fetch).toEqual(expect.any(Function))
  })

  it("fails fast when a managed-cloud profile is missing required runtime substrate", async () => {
    const dir = await mkdtemp(join(tmpdir(), "voyant-profile-"))
    const snapshotPath = join(dir, "managed-profile.json")
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

    await expect(
      loadManagedProfileRuntime({
        profileSnapshotPath: snapshotPath,
        env: {
          DATABASE_URL: "managed-profile-test-db",
        },
      }),
    ).rejects.toThrow(/REDIS_URL|admin auth integration|R2_S3_ENDPOINT/)
  })

  it("rejects snapshot plugins instead of silently ignoring them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "voyant-profile-"))
    const snapshotPath = join(dir, "managed-profile.json")
    await writeFile(
      snapshotPath,
      JSON.stringify(
        defineVoyantProject({
          profile: "operator",
          frameworkVersion: "0.12.22",
          mode: "local",
          modules: ["catalog", "bookings", "finance", "relationships"],
          plugins: ["@voyant-travel/plugin-netopia"],
          providers: localProviders,
        }),
      ),
    )

    await expect(
      loadManagedProfileRuntime({
        profileSnapshotPath: snapshotPath,
        env: {
          DATABASE_URL: "managed-profile-test-db",
        },
      }),
    ).rejects.toThrow(/snapshot plugins are not yet resolved/)
  })

  it("builds managed Node bindings from plain env/secrets", () => {
    const env = createManagedProfileNodeEnv({
      DATABASE_URL: "managed-profile-test-db",
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

  it("preserves injected KV and R2 bindings", () => {
    const kv = {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    }
    const bucket = {
      get: async () => null,
      head: async () => null,
      put: async () => ({ key: "x" }),
      delete: async () => {},
    }

    const env = createManagedProfileNodeEnv({
      DATABASE_URL: "managed-profile-test-db",
      CACHE: kv,
      RATE_LIMIT: kv,
      MEDIA_BUCKET: bucket,
      DOCUMENTS_BUCKET: bucket,
    })

    expect(env.CACHE).toBe(kv)
    expect(env.RATE_LIMIT).toBe(kv)
    expect(env.MEDIA_BUCKET).toBe(bucket)
    expect(env.DOCUMENTS_BUCKET).toBe(bucket)
  })

  it("keeps the runtime entry free of starter/operator imports", async () => {
    const source = await readFile(new URL("./managed-runtime.ts", import.meta.url), "utf8")

    expect(source).not.toContain("starters/operator")
    expect(source).not.toContain("../../starters")
    expect(createManagedProfileProviders()).toBeDefined()
  })

  it("keeps payment starters provider-neutral", async () => {
    const defaultProviders = createManagedProfileProviders()
    expect(defaultProviders.resolvePaymentStarters?.({})).toEqual({})
    expect(defaultProviders).not.toHaveProperty("netopiaCheckoutStarter")

    const providers = createManagedProfileProviders({
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

  it("wires package-owned payment-link routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadPaymentLinkRoutes()
    const response = await app.request(
      "/v1/public/payment-link-config",
      {},
      {
        PUBLIC_CHECKOUT_BASE_URL: "https://checkout.example.test",
        BANK_TRANSFER_BENEFICIARY: "Voyant Travel",
        BANK_TRANSFER_IBAN: "RO49AAAA1B31007593840000",
      },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        publicCheckoutBaseUrl: "https://checkout.example.test",
        bankTransfer: {
          beneficiary: "Voyant Travel",
          iban: "RO49AAAA1B31007593840000",
          bankName: null,
        },
      },
    })
  }, 10000)

  it("wires package-owned contract document routes in the default managed providers", async () => {
    const env = createManagedProfileNodeEnv({ DATABASE_URL: "managed-profile-test-db" })
    await env.DOCUMENTS_BUCKET?.put("contracts/test.pdf", new TextEncoder().encode("%PDF-1.4"))
    const app = await createManagedProfileProviders().loadContractDocumentRoutes()

    const response = await app.request("/v1/admin/documents/files/contracts/test.pdf", {}, env)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(await response.text()).toBe("%PDF-1.4")
  })

  it("wires package-owned media routes in the default managed providers", async () => {
    const env = createManagedProfileNodeEnv({
      DATABASE_URL: "managed-profile-test-db",
      APP_URL: "https://api.example.test",
    })
    await env.MEDIA_BUCKET?.put("uploads/test.txt", "hello", {
      httpMetadata: { contentType: "text/plain" },
    })
    const app = await createManagedProfileProviders().loadMediaRoutes()

    const response = await app.request("/v1/admin/media/uploads/test.txt", {}, env)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/plain")
    expect(await response.text()).toBe("hello")
  }, 10000)

  it("wires package-owned booking maintenance routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadBookingMaintenanceRoutes()

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
  }, 10000)

  it("wires package-owned catalog offers routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadCatalogOffersRoutes()
    const response = await app.request("/departure-airports", {
      method: "POST",
      body: JSON.stringify({ destination: { countryCode: "RO" } }),
      headers: { "content-type": "application/json" },
    })

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ departureAirports: [] })
  }, 10000)

  it("wires package-owned catalog checkout routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadCatalogCheckoutRoutes()

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
  }, 10000)

  it("wires package-owned quote-version snapshot routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadQuoteVersionSnapshotRoutes()

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
  }, 10000)

  it("wires package-owned booking schedule routes in the default managed providers", async () => {
    const providers = createManagedProfileProviders()
    const [adminApp, publicApp] = await Promise.all([
      providers.loadBookingScheduleAdminRoutes(),
      providers.loadPaymentPolicyPublicRoutes(),
    ])

    expect(adminApp.fetch).toEqual(expect.any(Function))
    expect(adminApp.routes.length).toBeGreaterThan(0)
    expect(publicApp.fetch).toEqual(expect.any(Function))
    expect(publicApp.routes.length).toBeGreaterThan(0)
  }, 10000)

  it("wires package-owned action-ledger health routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadActionLedgerHealthRoutes()

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
  })
})
