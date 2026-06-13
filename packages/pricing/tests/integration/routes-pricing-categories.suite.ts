import { describe, expect, it } from "vitest"

import { req, seedPricingCategory, seedPricingCategoryDependency } from "./routes.test-support.js"

export function registerPricingCategorySuites() {
  describe("Pricing Categories", () => {
    it("GET /pricing-categories returns empty list", async () => {
      const res = await req("GET", "/pricing-categories")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /pricing-categories creates a pricing category", async () => {
      const res = await req("POST", "/pricing-categories", {
        name: "Adult",
        categoryType: "adult",
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as { data: { id: string; name: string } }
      expect(json.data.id).toMatch(/^prcg_/)
      expect(json.data.name).toBe("Adult")
    })

    it("GET /pricing-categories/:id returns the category", async () => {
      const cat = await seedPricingCategory()
      const res = await req("GET", `/pricing-categories/${cat.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(cat.id)
    })

    it("GET /pricing-categories/:id returns 404 for missing", async () => {
      const res = await req("GET", "/pricing-categories/prcg_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /pricing-categories/:id updates the category", async () => {
      const cat = await seedPricingCategory()
      const res = await req("PATCH", `/pricing-categories/${cat.id}`, {
        name: "Updated",
        categoryType: "child",
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { name: string; categoryType: string } }
      expect(json.data.name).toBe("Updated")
      expect(json.data.categoryType).toBe("child")
    })

    it("DELETE /pricing-categories/:id deletes the category", async () => {
      const cat = await seedPricingCategory()
      const del = await req("DELETE", `/pricing-categories/${cat.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/pricing-categories/${cat.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by categoryType", async () => {
      await seedPricingCategory({ categoryType: "adult" })
      await seedPricingCategory({ categoryType: "child" })
      const res = await req("GET", "/pricing-categories?categoryType=adult")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by active", async () => {
      await seedPricingCategory({ active: true })
      await seedPricingCategory({ active: false })
      const res = await req("GET", "/pricing-categories?active=true")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Pricing Category Dependencies ====================

  describe("Pricing Category Dependencies", () => {
    it("GET /pricing-category-dependencies returns empty list", async () => {
      const res = await req("GET", "/pricing-category-dependencies")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /pricing-category-dependencies creates a dependency", async () => {
      const cat = await seedPricingCategory()
      const master = await seedPricingCategory()
      const res = await req("POST", "/pricing-category-dependencies", {
        pricingCategoryId: cat.id,
        masterPricingCategoryId: master.id,
        dependencyType: "requires",
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toMatch(/^prcd_/)
    })

    it("GET /pricing-category-dependencies/:id returns the dependency", async () => {
      const cat = await seedPricingCategory()
      const master = await seedPricingCategory()
      const dep = await seedPricingCategoryDependency(cat.id, master.id)
      const res = await req("GET", `/pricing-category-dependencies/${dep.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(dep.id)
    })

    it("PATCH /pricing-category-dependencies/:id updates", async () => {
      const cat = await seedPricingCategory()
      const master = await seedPricingCategory()
      const dep = await seedPricingCategoryDependency(cat.id, master.id)
      const res = await req("PATCH", `/pricing-category-dependencies/${dep.id}`, {
        dependencyType: "excludes",
        maxPerMaster: 5,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { dependencyType: string; maxPerMaster: number }
      }
      expect(json.data.dependencyType).toBe("excludes")
      expect(json.data.maxPerMaster).toBe(5)
    })

    it("DELETE /pricing-category-dependencies/:id deletes", async () => {
      const cat = await seedPricingCategory()
      const master = await seedPricingCategory()
      const dep = await seedPricingCategoryDependency(cat.id, master.id)
      const del = await req("DELETE", `/pricing-category-dependencies/${dep.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/pricing-category-dependencies/${dep.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by dependencyType", async () => {
      const c1 = await seedPricingCategory()
      const m1 = await seedPricingCategory()
      const c2 = await seedPricingCategory()
      const m2 = await seedPricingCategory()
      await seedPricingCategoryDependency(c1.id, m1.id, { dependencyType: "requires" })
      await seedPricingCategoryDependency(c2.id, m2.id, { dependencyType: "excludes" })
      const res = await req("GET", "/pricing-category-dependencies?dependencyType=requires")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Cancellation Policies ====================
}
