import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

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

function makePaymentLinkDb(rows: unknown[][]) {
  let cursor = 0
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.from = chain
  builder.where = chain
  builder.orderBy = chain
  builder.limit = chain
  // biome-ignore lint/suspicious/noThenProperty: test stub mimics a thenable drizzle query builder -- owner: framework.
  ;(builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => {
    try {
      const value = rows[cursor++] ?? []
      return Promise.resolve(value).then(resolve, reject)
    } catch (err) {
      return Promise.reject(err)
    }
  }
  return builder
}

async function mountManagedPaymentLinkApp(
  providers: ReturnType<typeof createManagedProfileProviders>,
  db: unknown,
) {
  const routes = await providers.loadPaymentLinkRoutes()
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, db as never)
    await next()
  })
  app.route("/", routes)
  return app
}

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

  it("keeps managed payment-link card starts explicitly unconfigured by default", async () => {
    const db = makePaymentLinkDb([
      [
        {
          id: "ps_1",
          status: "pending",
          redirectUrl: null,
          payerName: null,
          payerEmail: null,
          notes: null,
        },
      ],
    ])
    const app = await mountManagedPaymentLinkApp(createManagedProfileProviders(), db)

    const response = await app.request("/v1/public/payment-link/ps_1/start-card", {
      method: "POST",
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "Card processor not configured" })
  }, 10000)

  it("starts managed payment-link cards through the provider-neutral card starter", async () => {
    const db = makePaymentLinkDb([
      [
        {
          id: "ps_1",
          status: "requires_redirect",
          redirectUrl: "https://pay.example.test/stale",
          payerName: "Ada Lovelace",
          payerEmail: "ada@example.test",
          notes: "Deposit",
        },
      ],
    ])
    const startCardPayment = vi.fn(async () => ({
      redirectUrl: "https://pay.example.test/fresh",
    }))
    const app = await mountManagedPaymentLinkApp(
      createManagedProfileProviders({
        resolveCardPaymentStarter: () => startCardPayment,
      }),
      db,
    )

    const response = await app.request("/v1/public/payment-link/ps_1/start-card", {
      method: "POST",
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: { redirectUrl: "https://pay.example.test/fresh" },
    })
    expect(startCardPayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        db,
        sessionId: "ps_1",
        billing: expect.objectContaining({
          email: "ada@example.test",
          firstName: "Ada",
          lastName: "Lovelace",
        }),
        description: "Deposit",
      }),
    )
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

  it("wires package-owned flights routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadFlightAdminRoutes()
    const response = await app.request("/search", {
      method: "POST",
      body: JSON.stringify({
        slices: [
          {
            origin: "OTP",
            destination: "LHR",
            departureDate: "2026-08-01",
          },
        ],
        passengers: { adults: 1 },
      }),
      headers: { "content-type": "application/json" },
    })

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error:
        "Flight connector is not configured for this managed runtime. Override loadFlightAdminRoutes with a deployment flight connector.",
    })
  }, 10000)

  it("wires package-owned MCP routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadMcpAdminRoutes()
    const response = await app.request("/manifest")

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        version: expect.any(String),
        serverInfo: expect.objectContaining({ name: "voyant-mcp" }),
        tools: [],
      }),
    )
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

  it("wires package-owned catalog booking routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadCatalogBookingRoutes()

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
  }, 10000)

  it("wires package-owned catalog content routes in the default managed providers", async () => {
    const app = await createManagedProfileProviders().loadCatalogContentRoutes()
    const response = await app.request("/v1/admin/cruises/!!!invalid/content")

    expect(app.fetch).toEqual(expect.any(Function))
    expect(app.routes.length).toBeGreaterThan(0)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "invalid_key",
      detail: "Unrecognized cruise key: !!!invalid",
    })
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

  it("wires package-owned proposal routes in the default managed providers", async () => {
    const providers = createManagedProfileProviders()
    const [adminApp, publicApp] = await Promise.all([
      providers.loadProposalAdminRoutes(),
      providers.loadProposalPublicRoutes(),
    ])

    expect(adminApp.fetch).toEqual(expect.any(Function))
    expect(adminApp.routes.length).toBeGreaterThan(0)
    expect(publicApp.fetch).toEqual(expect.any(Function))
    expect(publicApp.routes.length).toBeGreaterThan(0)
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

  it("wires package-owned channel-push routes in the default managed providers", () => {
    const extension = createManagedProfileProviders().createChannelPushExtension()

    expect(extension.extension).toEqual({ name: "channel-push", module: "distribution" })
    expect(extension.adminRoutes?.fetch).toEqual(expect.any(Function))
    expect(extension.adminRoutes?.routes.length).toBeGreaterThan(0)
    expect(extension.lazyAdminRoutes).toBeUndefined()
  })
})
