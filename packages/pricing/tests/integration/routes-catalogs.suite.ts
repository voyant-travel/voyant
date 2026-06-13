import { describe, expect, it } from "vitest"

import { req, seedPriceCatalog, seedPriceSchedule, unique } from "./routes.test-support.js"

export function registerCatalogSuites() {
  describe("Price Catalogs", () => {
    it("GET /price-catalogs returns empty list", async () => {
      const res = await req("GET", "/price-catalogs")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /price-catalogs creates a catalog", async () => {
      const code = unique("CATALOG")
      const res = await req("POST", "/price-catalogs", {
        code,
        name: "Public Catalog",
        currencyCode: "EUR",
        catalogType: "public",
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; code: string; currencyCode: string }
      }
      expect(json.data.id).toMatch(/^prca_/)
      expect(json.data.code).toBe(code)
      expect(json.data.currencyCode).toBe("EUR")
    })

    it("GET /price-catalogs/:id returns the catalog", async () => {
      const cat = await seedPriceCatalog()
      const res = await req("GET", `/price-catalogs/${cat.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(cat.id)
    })

    it("GET /price-catalogs/:id returns 404 for missing", async () => {
      const res = await req("GET", "/price-catalogs/prca_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /price-catalogs/:id updates the catalog", async () => {
      const cat = await seedPriceCatalog()
      const res = await req("PATCH", `/price-catalogs/${cat.id}`, {
        name: "Updated Catalog",
        catalogType: "net",
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { name: string; catalogType: string } }
      expect(json.data.name).toBe("Updated Catalog")
      expect(json.data.catalogType).toBe("net")
    })

    it("DELETE /price-catalogs/:id deletes the catalog", async () => {
      const cat = await seedPriceCatalog()
      const del = await req("DELETE", `/price-catalogs/${cat.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/price-catalogs/${cat.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by currencyCode", async () => {
      await seedPriceCatalog({ currencyCode: "USD" })
      await seedPriceCatalog({ currencyCode: "EUR" })
      const res = await req("GET", "/price-catalogs?currencyCode=EUR")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by catalogType", async () => {
      await seedPriceCatalog({ catalogType: "public" })
      await seedPriceCatalog({ catalogType: "contract" })
      const res = await req("GET", "/price-catalogs?catalogType=contract")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by search", async () => {
      await seedPriceCatalog({ name: "WinterSale" })
      await seedPriceCatalog({ name: "SummerSale" })
      const res = await req("GET", "/price-catalogs?search=Winter")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Price Schedules ====================

  describe("Price Schedules", () => {
    it("GET /price-schedules returns empty list", async () => {
      const res = await req("GET", "/price-schedules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /price-schedules creates a schedule", async () => {
      const catalog = await seedPriceCatalog()
      const res = await req("POST", "/price-schedules", {
        priceCatalogId: catalog.id,
        name: "Weekday Schedule",
        recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
        weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as { data: { id: string; name: string } }
      expect(json.data.id).toMatch(/^prsc_/)
      expect(json.data.name).toBe("Weekday Schedule")
    })

    it("GET /price-schedules/:id returns the schedule", async () => {
      const catalog = await seedPriceCatalog()
      const sched = await seedPriceSchedule(catalog.id)
      const res = await req("GET", `/price-schedules/${sched.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(sched.id)
    })

    it("PATCH /price-schedules/:id updates the schedule", async () => {
      const catalog = await seedPriceCatalog()
      const sched = await seedPriceSchedule(catalog.id)
      const res = await req("PATCH", `/price-schedules/${sched.id}`, {
        name: "Updated Schedule",
        priority: 10,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { name: string; priority: number } }
      expect(json.data.name).toBe("Updated Schedule")
      expect(json.data.priority).toBe(10)
    })

    it("DELETE /price-schedules/:id deletes the schedule", async () => {
      const catalog = await seedPriceCatalog()
      const sched = await seedPriceSchedule(catalog.id)
      const del = await req("DELETE", `/price-schedules/${sched.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/price-schedules/${sched.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by priceCatalogId", async () => {
      const cat1 = await seedPriceCatalog()
      const cat2 = await seedPriceCatalog()
      await seedPriceSchedule(cat1.id)
      await seedPriceSchedule(cat2.id)
      const res = await req("GET", `/price-schedules?priceCatalogId=${cat1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Option Price Rules ====================
}
