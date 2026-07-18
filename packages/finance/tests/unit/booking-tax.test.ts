import type { ModuleContainer } from "@voyant-travel/core"
import { handleApiError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"
import {
  type BookingTaxRouteOptions,
  computeBookingItemTaxLine,
  createBookingTaxPreviewRoutes,
  createBookingTaxSettingsApiExtension,
  createBookingTaxSettingsRoutes,
  matchesTaxPolicyCondition,
} from "../../src/booking-tax.js"
import {
  BOOKING_TAX_SETTINGS_RUNTIME_KEY,
  type BookingTaxRuntime,
} from "../../src/booking-tax-runtime.js"
import { createFinanceApiModule } from "../../src/index.js"

/** Minimal in-memory container mirroring the app runtime's registry. */
function makeContainer(): ModuleContainer {
  const services = new Map<string, unknown>()
  return {
    register: (name, service) => {
      services.set(name, service)
    },
    resolve: <T>(name: string): T => {
      if (!services.has(name)) throw new Error(`unregistered: ${name}`)
      return services.get(name) as T
    },
    has: (name) => services.has(name),
  }
}

describe("booking tax helpers", () => {
  it("computes exclusive tax lines", () => {
    expect(
      computeBookingItemTaxLine(
        {
          code: "ro-vat/standard",
          label: "TVA Standard",
          rate: 0.21,
          priceMode: "exclusive",
        },
        10_000,
        "RON",
      ),
    ).toMatchObject({
      code: "ro-vat/standard",
      name: "TVA Standard",
      scope: "excluded",
      currency: "RON",
      amountCents: 2_100,
      rateBasisPoints: 2_100,
      includedInPrice: false,
    })
  })

  it("computes inclusive tax lines", () => {
    expect(
      computeBookingItemTaxLine(
        {
          code: "ro-vat/standard",
          label: "TVA Standard",
          rate: 0.21,
          priceMode: "inclusive",
        },
        12_100,
        "RON",
      ),
    ).toMatchObject({
      scope: "included",
      amountCents: 2_100,
      includedInPrice: true,
    })
  })

  it("matches nested policy conditions against normalized product facts", () => {
    expect(
      matchesTaxPolicyCondition(
        {
          all: [
            { fact: "hasAccommodation", eq: true },
            { fact: "accommodationCountries", contains: "ro" },
          ],
        },
        {
          hasAccommodation: true,
          accommodationCountries: ["RO"],
        },
      ),
    ).toBe(true)

    expect(
      matchesTaxPolicyCondition(
        {
          any: [
            { fact: "accommodationCountries", contains: "BG" },
            { fact: "hasAccommodation", eq: false },
          ],
        },
        {
          hasAccommodation: true,
          accommodationCountries: ["RO"],
        },
      ),
    ).toBe(false)
  })

  it("serves the booking tax-preview route with the shared response shape", async () => {
    const resultQueue = [
      [{ id: "profile_1", code: "ro-b2c", active: true }],
      [{ condition: { always: true }, taxRegimeId: "regime_1" }],
      [{ code: "standard", name: "TVA Standard", ratePercent: 21 }],
    ]
    const takeResult = async () => resultQueue.shift() ?? []
    function makeQuery() {
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        limit: takeResult,
        orderBy: takeResult,
      }
      return chain
    }
    const db = {
      execute: vi.fn(async () => []),
      select: makeQuery,
    } as PostgresJsDatabase

    const app = new Hono()
      .use("*", async (c, next) => {
        c.set("db", db)
        await next()
      })
      .route(
        "/",
        createBookingTaxPreviewRoutes({
          settings: {
            taxPriceMode: "exclusive",
            taxPolicyProfileId: "profile_1",
          },
        }),
      )

    const response = await app.request("/tax-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: "prod_1",
        subtotalCents: 10_000,
        currency: "RON",
      }),
    })

    await expect(response.json()).resolves.toEqual({
      data: {
        subtotalCents: 10_000,
        taxCents: 2_100,
        totalCents: 12_100,
        currency: "RON",
        taxRate: {
          code: "ro-b2c/standard",
          label: "TVA Standard",
          rateBasisPoints: 2_100,
          priceMode: "exclusive",
        },
      },
    })
  })

  it("defaults and normalizes the invoicing mode through the settings route", async () => {
    const db = {} as PostgresJsDatabase
    const buildApp = (settings: Record<string, unknown>) =>
      new Hono()
        .use("*", async (c, next) => {
          c.set("db", db)
          await next()
        })
        .route("/", createBookingTaxSettingsRoutes({ resolveBookingTaxSettings: () => settings }))

    // Absent → defaults to proforma-first.
    const missing = await buildApp({ taxPriceMode: "inclusive" }).request("/tax-settings")
    await expect(missing.json()).resolves.toMatchObject({
      data: { invoicingMode: "proforma-first" },
    })

    // Explicit direct → preserved.
    const direct = await buildApp({ invoicingMode: "direct" }).request("/tax-settings")
    await expect(direct.json()).resolves.toMatchObject({ data: { invoicingMode: "direct" } })
  })

  it("serves booking tax settings through the configured storage callbacks", async () => {
    let settings = {
      taxPriceMode: "inclusive" as const,
      taxPolicyProfileId: null as string | null,
      invoicingMode: "proforma-first" as "direct" | "proforma-first",
    }
    const updateBookingTaxSettings = vi.fn(async (_db: PostgresJsDatabase, next) => {
      settings = {
        taxPriceMode: next.taxPriceMode === "exclusive" ? "exclusive" : "inclusive",
        taxPolicyProfileId: next.taxPolicyProfileId ?? null,
        invoicingMode: next.invoicingMode === "direct" ? "direct" : "proforma-first",
      }
      return settings
    })
    const db = {} as PostgresJsDatabase
    const app = new Hono()
      .use("*", async (c, next) => {
        c.set("db", db)
        await next()
      })
      .route(
        "/",
        createBookingTaxSettingsRoutes({
          resolveBookingTaxSettings: () => settings,
          updateBookingTaxSettings,
        }),
      )

    const getResponse = await app.request("/tax-settings")
    await expect(getResponse.json()).resolves.toEqual({
      data: {
        taxPriceMode: "inclusive",
        taxPolicyProfileId: null,
        invoicingMode: "proforma-first",
      },
    })

    const patchResponse = await app.request("/tax-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxPriceMode: "exclusive",
        taxPolicyProfileId: "profile_1",
        invoicingMode: "direct",
      }),
    })

    expect(updateBookingTaxSettings).toHaveBeenCalledOnce()
    await expect(patchResponse.json()).resolves.toEqual({
      data: {
        taxPriceMode: "exclusive",
        taxPolicyProfileId: "profile_1",
        invoicingMode: "direct",
      },
    })
  })

  it("serves booking tax settings through the finance admin mount without hitting booking detail", async () => {
    const db = {} as PostgresJsDatabase
    const finance = createFinanceApiModule({
      resolveBookingTaxSettings: () => ({
        taxPriceMode: "inclusive",
        taxPolicyProfileId: "profile_1",
      }),
    })
    const app = new Hono()
      .use("*", async (c, next) => {
        c.set("db", db)
        await next()
      })
      .get("/v1/admin/bookings/:id", (c) => c.json({ error: "Booking not found" }, 404))
      .route("/v1/admin/finance", finance.adminRoutes!)

    const response = await app.request("/v1/admin/finance/tax-settings")

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        taxPriceMode: "inclusive",
        taxPolicyProfileId: "profile_1",
        invoicingMode: "proforma-first",
      },
    })
  })
})

describe("booking tax settings runtime-container wiring (managed runtime)", () => {
  /**
   * Build the exact managed-runtime scenario: the api-facet plain export is
   * invoked with EMPTY options (no `updateBookingTaxSettings`), but the graph
   * factory's bootstrap registered the WIRED options into the container under
   * BOOKING_TAX_SETTINGS_RUNTIME_KEY. The routes must read the wired options
   * from the container at request time.
   */
  function buildManagedApp(runtime: BookingTaxRuntime, db: PostgresJsDatabase) {
    const container = makeContainer()
    container.register(BOOKING_TAX_SETTINGS_RUNTIME_KEY, runtime)
    // Empty-options plain api-facet export (the managed-runtime NO-ARGS call).
    const extension = createBookingTaxSettingsApiExtension()
    return {
      container,
      request: async (path: string, init?: RequestInit) => {
        const routes = await extension.lazyAdminRoutes!()
        const app = new Hono()
          .use("*", async (c, next) => {
            c.set("db", db)
            c.set("container", container)
            await next()
          })
          .route("/", routes)
        app.onError(handleApiError)
        return app.request(path, init)
      },
    }
  }

  it("exposes lazy admin routes and no eager adminRoutes on the api-facet export", () => {
    const extension = createBookingTaxSettingsApiExtension()
    expect(extension.extension).toMatchObject({ name: "booking-tax-settings", module: "finance" })
    expect(extension.lazyAdminRoutes).toBeTypeOf("function")
    expect(extension.adminRoutes).toBeUndefined()
  })

  it("serves the wired resolve on GET even when the api-facet export got empty options", async () => {
    const wired: BookingTaxRouteOptions = {
      resolveBookingTaxSettings: () => ({ taxPriceMode: "exclusive", invoicingMode: "direct" }),
    }
    const managed = buildManagedApp({ resolveRoutesOptions: () => wired }, {} as PostgresJsDatabase)

    const response = await managed.request("/tax-settings")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        taxPriceMode: "exclusive",
        taxPolicyProfileId: null,
        invoicingMode: "direct",
      },
    })
  })

  it("makes PATCH tax-settings succeed via the container-wired updateBookingTaxSettings", async () => {
    let settings = {
      taxPriceMode: "inclusive" as "inclusive" | "exclusive",
      taxPolicyProfileId: null as string | null,
      invoicingMode: "proforma-first" as "direct" | "proforma-first",
    }
    const updateBookingTaxSettings = vi.fn(async (_db: PostgresJsDatabase, next) => {
      settings = {
        taxPriceMode: next.taxPriceMode === "exclusive" ? "exclusive" : "inclusive",
        taxPolicyProfileId: next.taxPolicyProfileId ?? null,
        invoicingMode: next.invoicingMode === "direct" ? "direct" : "proforma-first",
      }
      return settings
    })
    const wired: BookingTaxRouteOptions = {
      resolveBookingTaxSettings: () => settings,
      updateBookingTaxSettings,
    }
    const managed = buildManagedApp({ resolveRoutesOptions: () => wired }, {} as PostgresJsDatabase)

    const response = await managed.request("/tax-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoicingMode: "direct" }),
    })

    expect(response.status).toBe(200)
    expect(updateBookingTaxSettings).toHaveBeenCalledOnce()
    await expect(response.json()).resolves.toMatchObject({
      data: { invoicingMode: "direct" },
    })
  })

  it("still 409s when the container-wired runtime lacks updateBookingTaxSettings", async () => {
    const wired: BookingTaxRouteOptions = {
      resolveBookingTaxSettings: () => ({ taxPriceMode: "inclusive" }),
    }
    const managed = buildManagedApp({ resolveRoutesOptions: () => wired }, {} as PostgresJsDatabase)

    const response = await managed.request("/tax-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoicingMode: "direct" }),
    })

    expect(response.status).toBe(409)
  })

  it("falls back to closure options when no container runtime is registered", async () => {
    // Standard (non-managed) caller path: options passed directly, no container.
    const app = new Hono()
      .use("*", async (c, next) => {
        c.set("db", {} as PostgresJsDatabase)
        await next()
      })
      .route(
        "/",
        createBookingTaxSettingsRoutes({
          resolveBookingTaxSettings: () => ({ invoicingMode: "direct" }),
        }),
      )

    const response = await app.request("/tax-settings")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { invoicingMode: "direct" } })
  })
})
