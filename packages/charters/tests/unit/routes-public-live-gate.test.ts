/**
 * Public-surface gating for local charter voyage reads + quotes (voyant#2206).
 *
 * Charters is mounted as an anonymous public surface, so the local voyage list,
 * voyage detail, and both quote endpoints must only expose voyages whose owning
 * `charter_products` row is `live` — draft/archived products must stay hidden.
 * The per-suite quote must additionally verify the requested suite belongs to
 * the URL voyage (a suite from another voyage must not quote under this URL).
 *
 * These exercise the route handlers' enforcement by spying on the DB-bound
 * service calls; the service-layer `productStatus` join/filter is asserted via
 * the call arguments. The DB itself is a sentinel — the spies intercept before
 * any query runs. The `*_live` ids stand in for voyages on a live product;
 * `*_draft` ids stand in for voyages on a draft/archived product.
 */

import { mountTestApp } from "@voyant-travel/voyant-test-utils/http"
import { afterEach, describe, expect, it, vi } from "vitest"

import { chartersPublicRoutes } from "../../src/routes-public.js"
import { chartersService } from "../../src/service.js"
import { pricingService } from "../../src/service-pricing.js"

const fakeDb = {} as never

afterEach(() => vi.restoreAllMocks())

describe("public voyages list — live-product gate (P1)", () => {
  it("passes productStatus: live to the service so draft/archived voyages are excluded", async () => {
    const spy = vi
      .spyOn(chartersService, "listVoyages")
      .mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 } as never)
    const app = mountTestApp(chartersPublicRoutes, { db: fakeDb })
    const res = await app.request("/voyages")
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[2]).toEqual({ productStatus: "live" })
  })
})

describe("public voyage detail — live-product gate (P1)", () => {
  it("returns 404 when the voyage's product is not live", async () => {
    const spy = vi.spyOn(chartersService, "getVoyageById").mockResolvedValue(null)
    const app = mountTestApp(chartersPublicRoutes, { db: fakeDb })
    const res = await app.request("/voyages/chrv_draft")
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("not_found")
    expect(spy.mock.calls[0]?.[2]).toMatchObject({ productStatus: "live" })
  })

  it("returns 200 when the voyage's product is live", async () => {
    vi.spyOn(chartersService, "getVoyageById").mockResolvedValue({
      id: "chrv_live",
      productId: "chrt_live",
    } as never)
    const app = mountTestApp(chartersPublicRoutes, { db: fakeDb })
    const res = await app.request("/voyages/chrv_live")
    expect(res.status).toBe(200)
  })
})

describe("per-suite quote — live gate + suite ownership (P1 + P2)", () => {
  it("returns 404 not_found when the voyage's product is not live", async () => {
    const getSpy = vi.spyOn(chartersService, "getVoyageById").mockResolvedValue(null)
    const quoteSpy = vi.spyOn(pricingService, "quotePerSuite")
    const app = mountTestApp(chartersPublicRoutes, { db: fakeDb })
    const res = await app.request("/voyages/chrv_draft/quote/per-suite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suiteId: "chst_x", currency: "USD" }),
    })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("not_found")
    expect(getSpy.mock.calls[0]?.[2]).toMatchObject({ withSuites: true, productStatus: "live" })
    expect(quoteSpy).not.toHaveBeenCalled()
  })

  it("returns 404 no_matching_suite when suiteId belongs to a different voyage (P2)", async () => {
    vi.spyOn(chartersService, "getVoyageById").mockResolvedValue({
      id: "chrv_live",
      productId: "chrt_live",
      suites: [{ id: "chst_owned" }],
    } as never)
    const quoteSpy = vi.spyOn(pricingService, "quotePerSuite")
    const app = mountTestApp(chartersPublicRoutes, { db: fakeDb })
    const res = await app.request("/voyages/chrv_live/quote/per-suite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suiteId: "chst_other_voyage", currency: "USD" }),
    })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("no_matching_suite")
    expect(quoteSpy).not.toHaveBeenCalled()
  })

  it("quotes when the suite belongs to the live URL voyage", async () => {
    vi.spyOn(chartersService, "getVoyageById").mockResolvedValue({
      id: "chrv_live",
      productId: "chrt_live",
      suites: [{ id: "chst_owned" }],
    } as never)
    const quoteSpy = vi.spyOn(pricingService, "quotePerSuite").mockResolvedValue({
      mode: "per_suite",
      voyageId: "chrv_live",
      suiteId: "chst_owned",
      suiteName: "Owners Suite",
      currency: "USD",
      suitePrice: "150000.00",
      portFee: null,
      total: "150000.00",
    })
    const app = mountTestApp(chartersPublicRoutes, { db: fakeDb })
    const res = await app.request("/voyages/chrv_live/quote/per-suite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suiteId: "chst_owned", currency: "USD" }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.total).toBe("150000.00")
    expect(quoteSpy).toHaveBeenCalledTimes(1)
  })
})

describe("whole-yacht quote — live gate (P1)", () => {
  it("returns 404 not_found when the voyage's product is not live", async () => {
    const getSpy = vi.spyOn(chartersService, "getVoyageById").mockResolvedValue(null)
    const quoteSpy = vi.spyOn(pricingService, "quoteWholeYacht")
    const app = mountTestApp(chartersPublicRoutes, { db: fakeDb })
    const res = await app.request("/voyages/chrv_draft/quote/whole-yacht", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: "USD" }),
    })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe("not_found")
    expect(getSpy.mock.calls[0]?.[2]).toMatchObject({ productStatus: "live" })
    expect(quoteSpy).not.toHaveBeenCalled()
  })

  it("quotes when the voyage's product is live", async () => {
    vi.spyOn(chartersService, "getVoyageById").mockResolvedValue({
      id: "chrv_live",
      productId: "chrt_live",
    } as never)
    const quoteSpy = vi.spyOn(pricingService, "quoteWholeYacht").mockResolvedValue({
      mode: "whole_yacht",
      voyageId: "chrv_live",
      currency: "USD",
      charterFee: "5000000.00",
      apaPercent: "30.00",
      apaAmount: "1500000.00",
      total: "6500000.00",
    })
    const app = mountTestApp(chartersPublicRoutes, { db: fakeDb })
    const res = await app.request("/voyages/chrv_live/quote/whole-yacht", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: "USD" }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.total).toBe("6500000.00")
    expect(quoteSpy).toHaveBeenCalledTimes(1)
  })
})
