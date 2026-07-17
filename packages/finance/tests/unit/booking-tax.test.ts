import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import {
  computeBookingItemTaxLine,
  createBookingTaxRoutes,
  matchesTaxPolicyCondition,
} from "../../src/booking-tax.js"
import { createFinanceApiModule } from "../../src/index.js"

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
        createBookingTaxRoutes({
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

  it("defaults and normalizes the FX reference source through the settings route", async () => {
    const db = {} as PostgresJsDatabase
    const buildApp = (settings: Record<string, unknown>) =>
      new Hono()
        .use("*", async (c, next) => {
          c.set("db", db)
          await next()
        })
        .route("/", createBookingTaxRoutes({ resolveBookingTaxSettings: () => settings }))

    // Absent → defaults to ecb.
    const missing = await buildApp({ taxPriceMode: "inclusive" }).request("/tax-settings")
    await expect(missing.json()).resolves.toMatchObject({ data: { fxReferenceSource: "ecb" } })

    // Unknown/legacy value → normalized to ecb.
    const unknown = await buildApp({ fxReferenceSource: "boe" }).request("/tax-settings")
    await expect(unknown.json()).resolves.toMatchObject({ data: { fxReferenceSource: "ecb" } })

    // Explicit bnr → preserved.
    const bnr = await buildApp({ fxReferenceSource: "bnr" }).request("/tax-settings")
    await expect(bnr.json()).resolves.toMatchObject({ data: { fxReferenceSource: "bnr" } })
  })

  it("serves booking tax settings through the configured storage callbacks", async () => {
    let settings = {
      taxPriceMode: "inclusive" as const,
      taxPolicyProfileId: null as string | null,
      fxReferenceSource: "ecb" as "ecb" | "bnr",
    }
    const updateBookingTaxSettings = vi.fn(async (_db: PostgresJsDatabase, next) => {
      settings = {
        taxPriceMode: next.taxPriceMode === "exclusive" ? "exclusive" : "inclusive",
        taxPolicyProfileId: next.taxPolicyProfileId ?? null,
        fxReferenceSource: next.fxReferenceSource === "bnr" ? "bnr" : "ecb",
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
        createBookingTaxRoutes({
          resolveBookingTaxSettings: () => settings,
          updateBookingTaxSettings,
        }),
      )

    const getResponse = await app.request("/tax-settings")
    await expect(getResponse.json()).resolves.toEqual({
      data: {
        taxPriceMode: "inclusive",
        taxPolicyProfileId: null,
        invoicingMode: "direct",
        fxReferenceSource: "ecb",
      },
    })

    const patchResponse = await app.request("/tax-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxPriceMode: "exclusive",
        taxPolicyProfileId: "profile_1",
        fxReferenceSource: "bnr",
      }),
    })

    expect(updateBookingTaxSettings).toHaveBeenCalledOnce()
    await expect(patchResponse.json()).resolves.toEqual({
      data: {
        taxPriceMode: "exclusive",
        taxPolicyProfileId: "profile_1",
        invoicingMode: "direct",
        fxReferenceSource: "bnr",
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
        invoicingMode: "direct",
        fxReferenceSource: "ecb",
      },
    })
  })
})
