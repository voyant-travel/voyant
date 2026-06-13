import { newId } from "@voyantjs/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyantjs/db/test-utils"
import { handleApiError } from "@voyantjs/hono"
import { optionExtraConfigs, productExtras } from "@voyantjs/inventory/extras"
import { optionUnits, productOptions, products } from "@voyantjs/inventory/schema"
import {
  availabilityPickupPoints,
  availabilityStartTimes,
} from "@voyantjs/operations/availability/schema"
import { facilities } from "@voyantjs/operations/places/schema"
import { Hono } from "hono"
import { beforeAll, beforeEach, expect } from "vitest"
import { pricingRoutes } from "../../src/routes.js"

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
export const DB_AVAILABLE = !!TEST_DATABASE_URL

const db = DB_AVAILABLE ? createTestDb() : (null as never)

const app = new Hono()
  .use("*", async (c, next) => {
    c.set("db" as never, db)
    c.set("userId" as never, "test-user")
    await next()
  })
  .route("/", pricingRoutes)
  .onError((err, c) => handleApiError(err, c))

export function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } }
  if (body) init.body = JSON.stringify(body)
  return app.request(path, init)
}

let counter = 0
export function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${++counter}`
}

// Cross-module seed IDs
export let productId: string
export let optionId: string
export let unitId: string
export let facilityId: string
export let startTimeId: string
export let pickupPointId: string
export let productExtraId: string
export let optionExtraConfigId: string

// ----- Seed helpers -----

export async function seedPricingCategory(overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/pricing-categories", {
    name: unique("PricCat"),
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

export async function seedPricingCategoryDependency(
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

export async function seedCancellationPolicy(overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/cancellation-policies", {
    name: unique("CancPol"),
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

export async function seedCancellationPolicyRule(
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

export async function seedPriceCatalog(overrides: Record<string, unknown> = {}) {
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

export async function seedPriceSchedule(
  catalogId: string,
  overrides: Record<string, unknown> = {},
) {
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

export async function seedOptionPriceRule(overrides: Record<string, unknown> = {}) {
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

export async function seedOptionUnitPriceRule(
  ruleId: string,
  overrides: Record<string, unknown> = {},
) {
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

export async function seedOptionStartTimeRule(
  ruleId: string,
  overrides: Record<string, unknown> = {},
) {
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

export async function seedOptionUnitTier(
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

export async function seedPickupPriceRule(ruleId: string, overrides: Record<string, unknown> = {}) {
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

export async function seedDropoffPriceRule(
  ruleId: string,
  overrides: Record<string, unknown> = {},
) {
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

export async function seedExtraPriceRule(ruleId: string, overrides: Record<string, unknown> = {}) {
  const res = await req("POST", "/extra-price-rules", {
    optionPriceRuleId: ruleId,
    optionId,
    ...overrides,
  })
  expect(res.status).toBe(201)
  const json = (await res.json()) as { data: { id: string } }
  return json.data
}

export function registerPricingRoutesTestHooks() {
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
}
