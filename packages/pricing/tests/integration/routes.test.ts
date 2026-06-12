// agent-quality: file-size exception -- owner: pricing; existing coverage file stays co-located until a dedicated split preserves behavior and tests.
import { availabilityPickupPoints, availabilityStartTimes } from "@voyantjs/availability/schema"
import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { optionExtraConfigs, productExtras } from "@voyantjs/extras/schema"
import { facilities } from "@voyantjs/facilities/schema"
import { handleApiError } from "@voyantjs/hono"
import { optionUnits, productOptions, products } from "@voyantjs/products/schema"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { pricingRoutes } from "../../src/routes.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const DB_AVAILABLE = !!TEST_DATABASE_URL

const db = DB_AVAILABLE ? createTestDb() : (null as never)

const app = new Hono()
  .use("*", async (c, next) => {
    c.set("db" as never, db)
    c.set("userId" as never, "test-user")
    await next()
  })
  .route("/", pricingRoutes)
  .onError((err, c) => handleApiError(err, c))

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } }
  if (body) init.body = JSON.stringify(body)
  return app.request(path, init)
}

let counter = 0
function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${++counter}`
}

// Cross-module seed IDs
let productId: string
let optionId: string
let unitId: string
let facilityId: string
let startTimeId: string
let pickupPointId: string
let productExtraId: string
let optionExtraConfigId: string

// ----- Seed helpers -----

async function seedPricingCategory(overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/pricing-categories", {
    name: unique("PricCat"),
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedPricingCategoryDependency(
  catId: string,
  masterCatId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await req("POST", "/pricing-category-dependencies", {
    pricingCategoryId: catId,
    masterPricingCategoryId: masterCatId,
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedCancellationPolicy(overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/cancellation-policies", {
    name: unique("CancPol"),
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedCancellationPolicyRule(
  policyId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await req("POST", "/cancellation-policy-rules", {
    cancellationPolicyId: policyId,
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedPriceCatalog(overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/price-catalogs", {
    code: unique("CAT"),
    name: unique("Catalog"),
    currencyCode: "USD",
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedPriceSchedule(catalogId: string, overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/price-schedules", {
    priceCatalogId: catalogId,
    name: unique("Schedule"),
    recurrenceRule: "FREQ=DAILY",
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedOptionPriceRule(overrides: Record<string, unknown> = {}) {
  const catalog = await seedPriceCatalog()
  const res = await req("POST", "/option-price-rules", {
    productId,
    optionId,
    priceCatalogId: catalog.id,
    name: unique("OptPriceRule"),
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedOptionUnitPriceRule(ruleId: string, overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/option-unit-price-rules", {
    optionPriceRuleId: ruleId,
    optionId,
    unitId,
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedOptionStartTimeRule(ruleId: string, overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/option-start-time-rules", {
    optionPriceRuleId: ruleId,
    optionId,
    startTimeId,
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedOptionUnitTier(
  unitPriceRuleId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await req("POST", "/option-unit-tiers", {
    optionUnitPriceRuleId: unitPriceRuleId,
    minQuantity: 1,
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedPickupPriceRule(ruleId: string, overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/pickup-price-rules", {
    optionPriceRuleId: ruleId,
    optionId,
    pickupPointId,
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedDropoffPriceRule(ruleId: string, overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/dropoff-price-rules", {
    optionPriceRuleId: ruleId,
    optionId,
    dropoffName: unique("Dropoff"),
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

async function seedExtraPriceRule(ruleId: string, overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/extra-price-rules", {
    optionPriceRuleId: ruleId,
    optionId,
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

describe.skipIf(!DB_AVAILABLE)("Pricing Routes Integration", () => {
  beforeAll(() => {
    productId = newId("products")
    optionId = newId("product_options")
    unitId = newId("option_units")
    facilityId = newId("facilities")
    startTimeId = newId("availability_start_times")
    pickupPointId = newId("availability_pickup_points")
    productExtraId = newId("product_extras")
    optionExtraConfigId = newId("option_extra_configs")
  })

  beforeEach(async () => {
    if (!TEST_DATABASE_URL) return
    await cleanupTestDb(db)

    // Seed cross-module data
    await db.insert(products).values({ id: productId, name: "Test Product", sellCurrency: "USD" })
    await db.insert(productOptions).values({
      id: optionId,
      productId,
      name: "Test Option",
    })
    await db.insert(optionUnits).values({
      id: unitId,
      optionId,
      name: "Adult",
    })
    await db.insert(facilities).values({
      id: facilityId,
      name: "Test Facility",
      kind: "venue",
    })
    await db.insert(availabilityStartTimes).values({
      id: startTimeId,
      productId,
      startTimeLocal: "09:00",
    })
    await db.insert(availabilityPickupPoints).values({
      id: pickupPointId,
      productId,
      name: "Hotel Lobby",
    })
    await db.insert(productExtras).values({
      id: productExtraId,
      productId,
      name: "Lunch Add-on",
    })
    await db.insert(optionExtraConfigs).values({
      id: optionExtraConfigId,
      optionId,
      productExtraId,
    })
  })

  // ==================== Pricing Categories ====================

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

  describe("Cancellation Policies", () => {
    it("GET /cancellation-policies returns empty list", async () => {
      const res = await req("GET", "/cancellation-policies")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /cancellation-policies creates a policy", async () => {
      const res = await req("POST", "/cancellation-policies", {
        name: "24h Cancel",
        policyType: "simple",
        simpleCutoffHours: 24,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; name: string; policyType: string }
      }
      expect(json.data.id).toMatch(/^ccpo_/)
      expect(json.data.name).toBe("24h Cancel")
      expect(json.data.policyType).toBe("simple")
    })

    it("GET /cancellation-policies/:id returns the policy", async () => {
      const pol = await seedCancellationPolicy()
      const res = await req("GET", `/cancellation-policies/${pol.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(pol.id)
    })

    it("GET /cancellation-policies/:id returns 404 for missing", async () => {
      const res = await req("GET", "/cancellation-policies/ccpo_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /cancellation-policies/:id updates the policy", async () => {
      const pol = await seedCancellationPolicy()
      const res = await req("PATCH", `/cancellation-policies/${pol.id}`, {
        name: "Updated Policy",
        policyType: "non_refundable",
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { name: string; policyType: string } }
      expect(json.data.name).toBe("Updated Policy")
      expect(json.data.policyType).toBe("non_refundable")
    })

    it("DELETE /cancellation-policies/:id deletes the policy", async () => {
      const pol = await seedCancellationPolicy()
      const del = await req("DELETE", `/cancellation-policies/${pol.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/cancellation-policies/${pol.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by policyType", async () => {
      await seedCancellationPolicy({ policyType: "simple" })
      await seedCancellationPolicy({ policyType: "advanced" })
      const res = await req("GET", "/cancellation-policies?policyType=simple")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by search", async () => {
      await seedCancellationPolicy({ name: "FlexCancel" })
      await seedCancellationPolicy({ name: "StrictCancel" })
      const res = await req("GET", "/cancellation-policies?search=Flex")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Cancellation Policy Rules ====================

  describe("Cancellation Policy Rules", () => {
    it("GET /cancellation-policy-rules returns empty list", async () => {
      const res = await req("GET", "/cancellation-policy-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /cancellation-policy-rules creates a rule", async () => {
      const pol = await seedCancellationPolicy()
      const res = await req("POST", "/cancellation-policy-rules", {
        cancellationPolicyId: pol.id,
        chargeType: "percentage",
        chargePercentBasisPoints: 5000,
        cutoffMinutesBefore: 1440,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; chargeType: string; chargePercentBasisPoints: number }
      }
      expect(json.data.id).toMatch(/^ccpr_/)
      expect(json.data.chargeType).toBe("percentage")
      expect(json.data.chargePercentBasisPoints).toBe(5000)
    })

    it("GET /cancellation-policy-rules/:id returns the rule", async () => {
      const pol = await seedCancellationPolicy()
      const rule = await seedCancellationPolicyRule(pol.id)
      const res = await req("GET", `/cancellation-policy-rules/${rule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(rule.id)
    })

    it("PATCH /cancellation-policy-rules/:id updates the rule", async () => {
      const pol = await seedCancellationPolicy()
      const rule = await seedCancellationPolicyRule(pol.id)
      const res = await req("PATCH", `/cancellation-policy-rules/${rule.id}`, {
        chargeType: "amount",
        chargeAmountCents: 2500,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { chargeType: string; chargeAmountCents: number }
      }
      expect(json.data.chargeType).toBe("amount")
      expect(json.data.chargeAmountCents).toBe(2500)
    })

    it("DELETE /cancellation-policy-rules/:id deletes the rule", async () => {
      const pol = await seedCancellationPolicy()
      const rule = await seedCancellationPolicyRule(pol.id)
      const del = await req("DELETE", `/cancellation-policy-rules/${rule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/cancellation-policy-rules/${rule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by cancellationPolicyId", async () => {
      const pol1 = await seedCancellationPolicy()
      const pol2 = await seedCancellationPolicy()
      await seedCancellationPolicyRule(pol1.id)
      await seedCancellationPolicyRule(pol2.id)
      const res = await req("GET", `/cancellation-policy-rules?cancellationPolicyId=${pol1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Price Catalogs ====================

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

  describe("Option Price Rules", () => {
    it("GET /option-price-rules returns empty list", async () => {
      const res = await req("GET", "/option-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /option-price-rules creates a rule", async () => {
      const catalog = await seedPriceCatalog()
      const res = await req("POST", "/option-price-rules", {
        productId,
        optionId,
        priceCatalogId: catalog.id,
        name: "Standard Price",
        pricingMode: "per_person",
        baseSellAmountCents: 5000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; name: string; pricingMode: string; baseSellAmountCents: number }
      }
      expect(json.data.id).toMatch(/^oprr_/)
      expect(json.data.name).toBe("Standard Price")
      expect(json.data.pricingMode).toBe("per_person")
      expect(json.data.baseSellAmountCents).toBe(5000)
    })

    it("GET /option-price-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("GET", `/option-price-rules/${rule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(rule.id)
    })

    it("GET /option-price-rules/:id returns 404 for missing", async () => {
      const res = await req("GET", "/option-price-rules/oprr_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /option-price-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("PATCH", `/option-price-rules/${rule.id}`, {
        name: "Updated Price",
        pricingMode: "per_booking",
        baseSellAmountCents: 10000,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { name: string; pricingMode: string; baseSellAmountCents: number }
      }
      expect(json.data.name).toBe("Updated Price")
      expect(json.data.pricingMode).toBe("per_booking")
      expect(json.data.baseSellAmountCents).toBe(10000)
    })

    it("DELETE /option-price-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const del = await req("DELETE", `/option-price-rules/${rule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/option-price-rules/${rule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by productId", async () => {
      await seedOptionPriceRule()
      const res = await req("GET", `/option-price-rules?productId=${productId}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by pricingMode", async () => {
      await seedOptionPriceRule({ pricingMode: "per_person" })
      await seedOptionPriceRule({ pricingMode: "free" })
      const res = await req("GET", "/option-price-rules?pricingMode=free")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("PATCH /option-price-rules/:id rejects switching to per_booking when unit prices exist", async () => {
      const rule = await seedOptionPriceRule({ pricingMode: "per_person" })
      await seedOptionUnitPriceRule(rule.id)
      const res = await req("PATCH", `/option-price-rules/${rule.id}`, {
        pricingMode: "per_booking",
      })
      expect(res.status).toBe(400)
      const json = (await res.json()) as { error: string }
      expect(json.error).toMatch(/per_booking/)
    })
  })

  // ==================== Option Unit Price Rules ====================

  describe("Option Unit Price Rules", () => {
    it("GET /option-unit-price-rules returns empty list", async () => {
      const res = await req("GET", "/option-unit-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /option-unit-price-rules creates a unit price rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/option-unit-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        unitId,
        pricingMode: "per_unit",
        sellAmountCents: 3000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.id).toMatch(/^oupr_/)
      expect(json.data.pricingMode).toBe("per_unit")
      expect(json.data.sellAmountCents).toBe(3000)
    })

    it("GET /option-unit-price-rules/:id returns the unit price rule", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const res = await req("GET", `/option-unit-price-rules/${unitRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(unitRule.id)
    })

    it("PATCH /option-unit-price-rules/:id updates the unit price rule", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const res = await req("PATCH", `/option-unit-price-rules/${unitRule.id}`, {
        sellAmountCents: 4500,
        pricingMode: "per_person",
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { sellAmountCents: number; pricingMode: string }
      }
      expect(json.data.sellAmountCents).toBe(4500)
      expect(json.data.pricingMode).toBe("per_person")
    })

    it("DELETE /option-unit-price-rules/:id deletes the unit price rule", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const del = await req("DELETE", `/option-unit-price-rules/${unitRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/option-unit-price-rules/${unitRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by optionPriceRuleId", async () => {
      const rule1 = await seedOptionPriceRule()
      const rule2 = await seedOptionPriceRule()
      await seedOptionUnitPriceRule(rule1.id)
      await seedOptionUnitPriceRule(rule2.id)
      const res = await req("GET", `/option-unit-price-rules?optionPriceRuleId=${rule1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("POST /option-unit-price-rules rejects unit prices under a per_booking parent", async () => {
      const rule = await seedOptionPriceRule({ pricingMode: "per_booking" })
      const res = await req("POST", "/option-unit-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        unitId,
        pricingMode: "per_unit",
        sellAmountCents: 3000,
      })
      expect(res.status).toBe(400)
      const json = (await res.json()) as { error: string }
      expect(json.error).toMatch(/per_booking/)
    })
  })

  // ==================== Option Start Time Rules ====================

  describe("Option Start Time Rules", () => {
    it("GET /option-start-time-rules returns empty list", async () => {
      const res = await req("GET", "/option-start-time-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /option-start-time-rules creates a start time rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/option-start-time-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        startTimeId,
        ruleMode: "included",
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as { data: { id: string; ruleMode: string } }
      expect(json.data.id).toMatch(/^ostr_/)
      expect(json.data.ruleMode).toBe("included")
    })

    it("GET /option-start-time-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const stRule = await seedOptionStartTimeRule(rule.id)
      const res = await req("GET", `/option-start-time-rules/${stRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(stRule.id)
    })

    it("PATCH /option-start-time-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const stRule = await seedOptionStartTimeRule(rule.id)
      const res = await req("PATCH", `/option-start-time-rules/${stRule.id}`, {
        ruleMode: "adjustment",
        adjustmentType: "percentage",
        adjustmentBasisPoints: 1000,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { ruleMode: string; adjustmentType: string; adjustmentBasisPoints: number }
      }
      expect(json.data.ruleMode).toBe("adjustment")
      expect(json.data.adjustmentType).toBe("percentage")
      expect(json.data.adjustmentBasisPoints).toBe(1000)
    })

    it("DELETE /option-start-time-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const stRule = await seedOptionStartTimeRule(rule.id)
      const del = await req("DELETE", `/option-start-time-rules/${stRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/option-start-time-rules/${stRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by optionPriceRuleId", async () => {
      const rule1 = await seedOptionPriceRule()
      const rule2 = await seedOptionPriceRule()
      // Each gets a unique startTimeId so we need separate start times
      // But we only have one startTimeId, so we create the rule for rule1 only
      // and test that filter returns 1 vs 0
      await seedOptionStartTimeRule(rule1.id)
      const res = await req("GET", `/option-start-time-rules?optionPriceRuleId=${rule1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
      const res2 = await req("GET", `/option-start-time-rules?optionPriceRuleId=${rule2.id}`)
      expect(res2.status).toBe(200)
      const json2 = (await res2.json()) as { data: unknown[]; total: number }
      expect(json2.total).toBe(0)
    })
  })

  // ==================== Option Unit Tiers ====================

  describe("Option Unit Tiers", () => {
    it("GET /option-unit-tiers returns empty list", async () => {
      const res = await req("GET", "/option-unit-tiers")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /option-unit-tiers creates a tier", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const res = await req("POST", "/option-unit-tiers", {
        optionUnitPriceRuleId: unitRule.id,
        minQuantity: 1,
        maxQuantity: 5,
        sellAmountCents: 5000,
        costAmountCents: 3000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; minQuantity: number; maxQuantity: number }
      }
      expect(json.data.id).toMatch(/^outi_/)
      expect(json.data.minQuantity).toBe(1)
      expect(json.data.maxQuantity).toBe(5)
    })

    it("GET /option-unit-tiers/:id returns the tier", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const tier = await seedOptionUnitTier(unitRule.id)
      const res = await req("GET", `/option-unit-tiers/${tier.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(tier.id)
    })

    it("PATCH /option-unit-tiers/:id updates the tier", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const tier = await seedOptionUnitTier(unitRule.id)
      const res = await req("PATCH", `/option-unit-tiers/${tier.id}`, {
        minQuantity: 6,
        maxQuantity: 10,
        sellAmountCents: 4000,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { minQuantity: number; maxQuantity: number; sellAmountCents: number }
      }
      expect(json.data.minQuantity).toBe(6)
      expect(json.data.maxQuantity).toBe(10)
      expect(json.data.sellAmountCents).toBe(4000)
    })

    it("DELETE /option-unit-tiers/:id deletes the tier", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule = await seedOptionUnitPriceRule(rule.id)
      const tier = await seedOptionUnitTier(unitRule.id)
      const del = await req("DELETE", `/option-unit-tiers/${tier.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/option-unit-tiers/${tier.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by optionUnitPriceRuleId", async () => {
      const rule = await seedOptionPriceRule()
      const unitRule1 = await seedOptionUnitPriceRule(rule.id)
      await seedOptionUnitTier(unitRule1.id)
      await seedOptionUnitTier(unitRule1.id, { minQuantity: 6 })
      const res = await req("GET", `/option-unit-tiers?optionUnitPriceRuleId=${unitRule1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(2)
    })
  })

  // ==================== Pickup Price Rules ====================

  describe("Pickup Price Rules", () => {
    it("GET /pickup-price-rules returns empty list", async () => {
      const res = await req("GET", "/pickup-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /pickup-price-rules creates a pickup price rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/pickup-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        pickupPointId,
        pricingMode: "per_person",
        sellAmountCents: 1500,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.id).toMatch(/^pkpr_/)
      expect(json.data.pricingMode).toBe("per_person")
      expect(json.data.sellAmountCents).toBe(1500)
    })

    it("GET /pickup-price-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const pkRule = await seedPickupPriceRule(rule.id)
      const res = await req("GET", `/pickup-price-rules/${pkRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(pkRule.id)
    })

    it("PATCH /pickup-price-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const pkRule = await seedPickupPriceRule(rule.id)
      const res = await req("PATCH", `/pickup-price-rules/${pkRule.id}`, {
        pricingMode: "per_booking",
        sellAmountCents: 2500,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.pricingMode).toBe("per_booking")
      expect(json.data.sellAmountCents).toBe(2500)
    })

    it("DELETE /pickup-price-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const pkRule = await seedPickupPriceRule(rule.id)
      const del = await req("DELETE", `/pickup-price-rules/${pkRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/pickup-price-rules/${pkRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by optionPriceRuleId", async () => {
      const rule1 = await seedOptionPriceRule()
      const rule2 = await seedOptionPriceRule()
      await seedPickupPriceRule(rule1.id)
      const res = await req("GET", `/pickup-price-rules?optionPriceRuleId=${rule1.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
      const res2 = await req("GET", `/pickup-price-rules?optionPriceRuleId=${rule2.id}`)
      expect(res2.status).toBe(200)
      const json2 = (await res2.json()) as { data: unknown[]; total: number }
      expect(json2.total).toBe(0)
    })
  })

  // ==================== Dropoff Price Rules ====================

  describe("Dropoff Price Rules", () => {
    it("GET /dropoff-price-rules returns empty list", async () => {
      const res = await req("GET", "/dropoff-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /dropoff-price-rules creates a dropoff price rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/dropoff-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        dropoffName: "Airport Terminal",
        facilityId,
        pricingMode: "per_person",
        sellAmountCents: 2000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; dropoffName: string; pricingMode: string }
      }
      expect(json.data.id).toMatch(/^drpr_/)
      expect(json.data.dropoffName).toBe("Airport Terminal")
      expect(json.data.pricingMode).toBe("per_person")
    })

    it("GET /dropoff-price-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const drRule = await seedDropoffPriceRule(rule.id)
      const res = await req("GET", `/dropoff-price-rules/${drRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(drRule.id)
    })

    it("PATCH /dropoff-price-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const drRule = await seedDropoffPriceRule(rule.id)
      const res = await req("PATCH", `/dropoff-price-rules/${drRule.id}`, {
        dropoffName: "Updated Terminal",
        pricingMode: "per_booking",
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { dropoffName: string; pricingMode: string } }
      expect(json.data.dropoffName).toBe("Updated Terminal")
      expect(json.data.pricingMode).toBe("per_booking")
    })

    it("DELETE /dropoff-price-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const drRule = await seedDropoffPriceRule(rule.id)
      const del = await req("DELETE", `/dropoff-price-rules/${drRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/dropoff-price-rules/${drRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by facilityId", async () => {
      const rule = await seedOptionPriceRule()
      await seedDropoffPriceRule(rule.id, { facilityId })
      await seedDropoffPriceRule(rule.id, { facilityId: null })
      const res = await req("GET", `/dropoff-price-rules?facilityId=${facilityId}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })

  // ==================== Extra Price Rules ====================

  describe("Extra Price Rules", () => {
    it("GET /extra-price-rules returns empty list", async () => {
      const res = await req("GET", "/extra-price-rules")
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.data).toEqual([])
      expect(json.total).toBe(0)
    })

    it("POST /extra-price-rules creates an extra price rule", async () => {
      const rule = await seedOptionPriceRule()
      const res = await req("POST", "/extra-price-rules", {
        optionPriceRuleId: rule.id,
        optionId,
        productExtraId,
        optionExtraConfigId,
        pricingMode: "per_person",
        sellAmountCents: 1000,
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as {
        data: { id: string; pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.id).toMatch(/^expr_/)
      expect(json.data.pricingMode).toBe("per_person")
      expect(json.data.sellAmountCents).toBe(1000)
    })

    it("GET /extra-price-rules/:id returns the rule", async () => {
      const rule = await seedOptionPriceRule()
      const exRule = await seedExtraPriceRule(rule.id)
      const res = await req("GET", `/extra-price-rules/${exRule.id}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: { id: string } }
      expect(json.data.id).toBe(exRule.id)
    })

    it("PATCH /extra-price-rules/:id updates the rule", async () => {
      const rule = await seedOptionPriceRule()
      const exRule = await seedExtraPriceRule(rule.id)
      const res = await req("PATCH", `/extra-price-rules/${exRule.id}`, {
        pricingMode: "per_booking",
        sellAmountCents: 3000,
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as {
        data: { pricingMode: string; sellAmountCents: number }
      }
      expect(json.data.pricingMode).toBe("per_booking")
      expect(json.data.sellAmountCents).toBe(3000)
    })

    it("DELETE /extra-price-rules/:id deletes the rule", async () => {
      const rule = await seedOptionPriceRule()
      const exRule = await seedExtraPriceRule(rule.id)
      const del = await req("DELETE", `/extra-price-rules/${exRule.id}`)
      expect(del.status).toBe(200)
      const get = await req("GET", `/extra-price-rules/${exRule.id}`)
      expect(get.status).toBe(404)
    })

    it("filters by productExtraId", async () => {
      const rule = await seedOptionPriceRule()
      await seedExtraPriceRule(rule.id, { productExtraId })
      await seedExtraPriceRule(rule.id, { productExtraId: null })
      const res = await req("GET", `/extra-price-rules?productExtraId=${productExtraId}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })

    it("filters by optionExtraConfigId", async () => {
      const rule = await seedOptionPriceRule()
      await seedExtraPriceRule(rule.id, { optionExtraConfigId })
      await seedExtraPriceRule(rule.id, { optionExtraConfigId: null })
      const res = await req("GET", `/extra-price-rules?optionExtraConfigId=${optionExtraConfigId}`)
      expect(res.status).toBe(200)
      const json = (await res.json()) as { data: unknown[]; total: number }
      expect(json.total).toBe(1)
    })
  })
})
