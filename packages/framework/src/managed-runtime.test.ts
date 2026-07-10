// agent-quality: file-size exception -- managed runtime coverage stays co-located with the composition boundary so Cloud boot/auth/store behavior is tested through one profile harness.
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import {
  createManagedCloudAuthApp,
  createManagedProfileApp,
  createManagedProfileNodeEnv,
  createManagedProfileProviders,
  loadManagedProfileRuntime,
  type ManagedProfileRuntimeEnv,
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

const MANAGED_PROFILE_TEST_DATABASE_URL = "postgresql://voyant:secret@localhost:5432/voyant_test"

function managedCloudProject() {
  return defineVoyantProject({
    profile: "operator",
    frameworkVersion: "0.16.0",
    modules: ["catalog", "bookings", "finance", "relationships"],
  })
}

function managedCloudEnv(
  overrides: Partial<ManagedProfileRuntimeEnv> = {},
): ManagedProfileRuntimeEnv {
  return createManagedProfileNodeEnv({
    DATABASE_URL: "postgres://voyant:secret@localhost:5432/voyant_test",
    REDIS_URL: "redis://localhost:6379",
    R2_S3_ENDPOINT: "https://r2.example.test",
    R2_ACCESS_KEY_ID: "access",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET_MEDIA: "media",
    R2_BUCKET_DOCUMENTS: "documents",
    APP_URL: "https://admin.example.test",
    API_BASE_URL: "https://admin.example.test/api",
    EMAIL_FROM: "Voyant <noreply@example.test>",
    VOYANT_API_KEY: "voyant_cloud_api_key",
    VOYANT_ADMIN_AUTH_MODE: "voyant-cloud",
    VOYANT_CLOUD_DEPLOYMENT_ID: "dep_test",
    VOYANT_CLOUD_ADMIN_AUTH_START_URL: "https://dash.example.test/admin-auth/start",
    VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL: "https://api.example.test/admin-auth/exchange",
    VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL: "https://api.example.test/.well-known/admin-auth/jwks.json",
    VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL: "https://api.example.test/admin-auth/revalidate",
    VOYANT_CLOUD_ADMIN_AUTH_AUDIENCE: "dep_test",
    VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN: "client_token",
    SESSION_CLAIMS_SECRET: "s".repeat(40),
    BETTER_AUTH_SECRET: "b".repeat(40),
    VOYANT_CLOUD_WORKFLOWS_URL: "https://workflows.example.test",
    VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN: "workflow_token",
    VOYANT_CLOUD_APP_SLUG: "operator",
    ORIGIN_TRUST_SECRET: "origin_trust",
    ...overrides,
  })
}

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
        DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL,
      },
    })

    expect(runtime.project.profile).toBe("operator")
    expect(runtime.requirements.modules.createVoyantAppExclude).toContain("@voyant-travel/flights")
    expect(runtime.app.fetch).toEqual(expect.any(Function))
  })

  it("accepts DATABASE_URL_DIRECT for a graph-derived Postgres requirement", async () => {
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
      env: { DATABASE_URL_DIRECT: MANAGED_PROFILE_TEST_DATABASE_URL },
    })

    expect(runtime.app.fetch).toEqual(expect.any(Function))
  })

  it("rejects malformed graph-derived Postgres configuration before startup", async () => {
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

    await expect(
      loadManagedProfileRuntime({
        profileSnapshotPath: snapshotPath,
        env: { DATABASE_URL: "not-a-postgres-url" },
      }),
    ).rejects.toThrow(/DATABASE_URL must be a Postgres URL for database:postgres/)
  })

  it("validates the graph-supplied deployment requirements at startup", async () => {
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

    await expect(
      loadManagedProfileRuntime({
        profileSnapshotPath: snapshotPath,
        env: { DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL },
        deploymentRequirements: {
          resources: [
            {
              resourceKey: "graph:runtime",
              roles: ["database"],
              provider: "postgres",
              required: true,
              env: [
                {
                  name: "GRAPH_RUNTIME_SECRET",
                  kind: "secret",
                  required: true,
                  description: "Required by the resolved deployment graph.",
                },
              ],
            },
          ],
        },
      }),
    ).rejects.toThrow(/GRAPH_RUNTIME_SECRET is required for graph:runtime/)
  })

  it("uses graph deployment providers instead of snapshot compatibility providers", async () => {
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
      env: { DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL },
      deployment: {
        mode: "self-hosted",
        providers: {
          ...localProviders,
          cache: "postgres",
          sharedState: "postgres",
          rateLimit: "postgres",
        },
      },
    })

    expect(runtime.project.mode).toBe("self-hosted")
    expect(runtime.project.providers).toMatchObject({
      cache: "postgres",
      sharedState: "postgres",
      rateLimit: "postgres",
    })
    expect(runtime.requirements.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceKey: "postgres-shared-state",
          roles: ["cache", "sharedState", "rateLimit"],
        }),
      ]),
    )
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
          DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL,
        },
      }),
    ).rejects.toThrow(/REDIS_URL|R2_S3_ENDPOINT/)
  })

  it("loads a managed-cloud profile with the packaged Cloud admin auth integration", async () => {
    const dir = await mkdtemp(join(tmpdir(), "voyant-profile-"))
    const snapshotPath = join(dir, "managed-profile.json")
    await writeFile(snapshotPath, JSON.stringify(managedCloudProject()))

    const runtime = await loadManagedProfileRuntime({
      profileSnapshotPath: snapshotPath,
      env: managedCloudEnv(),
    })

    expect(runtime.project.mode).toBe("managed-cloud")
    expect(runtime.app.fetch).toEqual(expect.any(Function))
  })

  it("fails managed-cloud startup when Cloud admin auth env is incomplete", async () => {
    const dir = await mkdtemp(join(tmpdir(), "voyant-profile-"))
    const snapshotPath = join(dir, "managed-profile.json")
    await writeFile(snapshotPath, JSON.stringify(managedCloudProject()))

    await expect(
      loadManagedProfileRuntime({
        profileSnapshotPath: snapshotPath,
        env: managedCloudEnv({
          VOYANT_CLOUD_ADMIN_AUTH_START_URL: "",
          VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN: "",
          BETTER_AUTH_SECRET: "",
        }),
      }),
    ).rejects.toThrow(
      /VOYANT_CLOUD_ADMIN_AUTH_START_URL|VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN|BETTER_AUTH_SECRET/,
    )
  })

  it("serves the managed Cloud admin auth start route", async () => {
    const env = managedCloudEnv()
    const app = createManagedProfileApp({
      project: managedCloudProject(),
      env,
    })

    const response = await app.fetch(
      new Request("https://admin.example.test/auth/cloud/start?next=/settings/team"),
      env,
    )
    const redirect = new URL(response.headers.get("location") ?? "")

    expect(response.status).toBe(302)
    expect(`${redirect.origin}${redirect.pathname}`).toBe(
      "https://dash.example.test/admin-auth/start",
    )
    expect(redirect.searchParams.get("deployment_id")).toBe("dep_test")
    expect(redirect.searchParams.get("redirect_uri")).toBe(
      "https://admin.example.test/api/auth/cloud/callback",
    )
    expect(redirect.searchParams.get("next")).toBe("/settings/team")
    expect(response.headers.get("set-cookie")).toContain("voyant-cloud-admin-auth=")
  })

  it("serves the managed Cloud admin auth start route under the external /api prefix", async () => {
    const env = managedCloudEnv()
    const app = createManagedProfileApp({
      project: managedCloudProject(),
      env,
    })

    const response = await app.fetch(
      new Request("https://admin.example.test/api/auth/sign-in/cloud?next=/app"),
      env,
    )
    const redirect = new URL(response.headers.get("location") ?? "")

    expect(response.status).toBe(302)
    expect(`${redirect.origin}${redirect.pathname}`).toBe(
      "https://dash.example.test/admin-auth/start",
    )
    expect(redirect.searchParams.get("redirect_uri")).toBe(
      "https://admin.example.test/api/auth/cloud/callback",
    )
    expect(redirect.searchParams.get("next")).toBe("/app")
    expect(response.headers.get("set-cookie")).toContain("voyant-cloud-admin-auth=")
  })

  it("redirects unauthenticated managed admin UI requests into Cloud auth", async () => {
    const env = managedCloudEnv()
    const app = createManagedProfileApp({
      project: managedCloudProject(),
      env,
    })

    const response = await app.fetch(
      new Request("https://admin.example.test/app?tab=bookings", {
        headers: { Accept: "text/html" },
      }),
      env,
    )
    const redirect = new URL(response.headers.get("location") ?? "")

    expect(response.status).toBe(302)
    expect(`${redirect.origin}${redirect.pathname}`).toBe(
      "https://dash.example.test/admin-auth/start",
    )
    expect(redirect.searchParams.get("next")).toBe("/app?tab=bookings")
    expect(response.headers.get("set-cookie")).toContain("voyant-cloud-admin-auth=")
  })

  it("keeps unauthenticated managed API requests as JSON 401s", async () => {
    const env = managedCloudEnv()
    const app = createManagedProfileApp({
      project: managedCloudProject(),
      env,
    })

    const response = await app.fetch(
      new Request("https://admin.example.test/api/v1/admin/products", {
        headers: { Accept: "application/json" },
      }),
      env,
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("resolves snapshot plugins from published specifiers and boots source-free", async () => {
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
          plugins: ["@third-party/plugin-regional-accounting"],
          settings: { "@third-party/plugin-regional-accounting": { fiscalRegion: "RO" } },
          providers: localProviders,
        }),
      ),
    )

    const factory = vi.fn((ctx: { settings: unknown }) => ({
      name: "regional-accounting",
      version: "1.0.0",
      settings: ctx.settings,
    }))

    const runtime = await loadManagedProfileRuntime({
      profileSnapshotPath: snapshotPath,
      env: { DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL },
      importPluginModule: async () => ({ voyantPlugin: factory }),
    })

    expect(runtime.app.fetch).toEqual(expect.any(Function))
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({
        specifier: "@third-party/plugin-regional-accounting",
        settings: { fiscalRegion: "RO" },
      }),
    )
  })

  it("fails fast when a snapshot plugin exposes no managed-plugin entry", async () => {
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
        env: { DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL },
        importPluginModule: async () => ({ notAFactory: 42 }),
      }),
    ).rejects.toThrow(/does not export a managed-plugin entry/)
  })

  it("resolves snapshot custom source modules/extensions and boots source-free", async () => {
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
          customSource: {
            modules: ["@third-party/custom-module"],
            extensions: ["@third-party/custom-ext"],
          },
          providers: localProviders,
        }),
      ),
    )

    const moduleFactory = vi.fn(() => ({
      module: { name: "custom-module" },
    }))
    const extensionFactory = vi.fn(() => ({
      extension: { name: "custom-ext", module: "custom-module" },
    }))

    const importCustomSourceModule = vi.fn(async (specifier: string) => {
      if (specifier === "@third-party/custom-module") {
        return { voyantModule: moduleFactory }
      }
      if (specifier === "@third-party/custom-ext") {
        return { voyantExtension: extensionFactory }
      }
      throw new Error(`Unexpected specifier ${specifier}`)
    })

    const runtime = await loadManagedProfileRuntime({
      profileSnapshotPath: snapshotPath,
      env: { DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL },
      importCustomSourceModule,
    })

    expect(runtime.app.fetch).toEqual(expect.any(Function))
    expect(importCustomSourceModule).toHaveBeenCalledWith("@third-party/custom-module")
    expect(importCustomSourceModule).toHaveBeenCalledWith("@third-party/custom-ext")
    expect(moduleFactory).toHaveBeenCalled()
    expect(extensionFactory).toHaveBeenCalled()
  })

  it("fails fast when a snapshot custom module exposes no managed-module entry", async () => {
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
          customSource: { modules: ["@third-party/custom-module"] },
          providers: localProviders,
        }),
      ),
    )

    await expect(
      loadManagedProfileRuntime({
        profileSnapshotPath: snapshotPath,
        env: { DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL },
        importCustomSourceModule: async () => ({ notAFactory: 42 }),
      }),
    ).rejects.toThrow(/does not export a managed-module entry/)
  })

  it("builds managed Node bindings from plain env/secrets", () => {
    const env = createManagedProfileNodeEnv({
      DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL,
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
      DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL,
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
    const env = createManagedProfileNodeEnv({ DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL })
    await env.DOCUMENTS_BUCKET?.put("contracts/test.pdf", new TextEncoder().encode("%PDF-1.4"))
    const app = await createManagedProfileProviders().loadContractDocumentRoutes()

    const response = await app.request("/v1/admin/documents/files/contracts/test.pdf", {}, env)

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(await response.text()).toBe("%PDF-1.4")
  })

  it("wires package-owned media routes in the default managed providers", async () => {
    const env = createManagedProfileNodeEnv({
      DATABASE_URL: MANAGED_PROFILE_TEST_DATABASE_URL,
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
    const loadFlightAdminRoutes = createManagedProfileProviders().loadFlightAdminRoutes
    if (!loadFlightAdminRoutes) throw new Error("managed providers must wire flights")
    const app = await loadFlightAdminRoutes()
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

  it("resolves managed bootstrap status as voyant-cloud when in cloud auth mode", async () => {
    const app = createManagedCloudAuthApp()
    const env = managedCloudEnv()

    const response = await app.request("/auth/bootstrap-status", {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ hasUsers: true, authMode: "voyant-cloud", modules: [] })
  }, 10000)

  it("reports the deployment's active module ids on bootstrap status (voyant#3063)", async () => {
    const activeModules = ["bookings", "catalog", "finance", "relationships"]
    const app = createManagedCloudAuthApp(activeModules)
    const env = managedCloudEnv()

    const response = await app.request("/auth/bootstrap-status", {}, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      hasUsers: true,
      authMode: "voyant-cloud",
      modules: activeModules,
    })
  }, 10000)

  it("returns 401 from /auth/me when the request carries no session", async () => {
    const app = createManagedCloudAuthApp()
    const env = createManagedProfileNodeEnv({
      DATABASE_URL: "postgres://voyant:secret@localhost:5432/voyant_test",
      VOYANT_ADMIN_AUTH_MODE: "local",
      BETTER_AUTH_SECRET: "b".repeat(40),
      APP_URL: "https://admin.example.test",
    })

    const response = await app.request("/auth/me", {}, env)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "unauthorized" })
  }, 10000)
})
