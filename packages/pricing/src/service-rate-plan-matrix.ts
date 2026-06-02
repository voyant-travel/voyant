import type { EventBus } from "@voyantjs/core"
import { RequestValidationError } from "@voyantjs/hono"
import { and, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { PRICING_RULE_CHANGED_EVENT, type PricingRuleChangedEvent } from "./events.js"
import {
  departurePriceOverrides,
  optionPriceRules,
  optionUnitPriceRules,
  priceSchedules,
  pricingCategories,
} from "./schema.js"
import type { ratePlanMatrixImportSchema } from "./validation.js"

export type RatePlanMatrixImportInput = z.infer<typeof ratePlanMatrixImportSchema>

export interface RatePlanMatrixImportRuntime {
  eventBus?: EventBus
}

export interface RatePlanMatrixImportSummary {
  dryRun: boolean
  mode: "upsert"
  schedules: MatrixImportTableSummary
  pricingCategories: MatrixImportTableSummary
  ratePlans: MatrixImportTableSummary
  unitPrices: MatrixImportTableSummary
  departureOverrides: MatrixImportTableSummary
}

export interface MatrixImportTableSummary {
  requested: number
  created: number
  updated: number
}

export interface RatePlanMatrixImportResult {
  summary: RatePlanMatrixImportSummary
}

type MatrixImportEvents = PricingRuleChangedEvent[]

const PER_BOOKING_REJECTS_UNIT_PRICES_MESSAGE =
  "per_booking rate plans cannot carry unit price cells"

function emptyTableSummary(requested: number): MatrixImportTableSummary {
  return { requested, created: 0, updated: 0 }
}

function increment(summary: MatrixImportTableSummary, operation: "created" | "updated") {
  summary[operation] += 1
}

export async function importRatePlanMatrix(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  runtime: RatePlanMatrixImportRuntime = {},
): Promise<RatePlanMatrixImportResult> {
  const summary: RatePlanMatrixImportSummary = {
    dryRun: input.dryRun,
    mode: input.mode,
    schedules: emptyTableSummary(input.schedules.length),
    pricingCategories: emptyTableSummary(input.pricingCategories.length),
    ratePlans: emptyTableSummary(input.ratePlans.length),
    unitPrices: emptyTableSummary(
      input.ratePlans.reduce((count, plan) => count + plan.unitPrices.length, 0),
    ),
    departureOverrides: emptyTableSummary(input.departureOverrides.length),
  }

  const events = await db.transaction(async (tx) => {
    const scheduleIdsByCode = await resolveScheduleIds(tx, input)
    const categoryIdsByCode = await resolveCategoryIds(tx, input)

    if (input.dryRun) {
      await previewSchedules(tx, input, summary)
      await previewPricingCategories(tx, input, summary)
      await previewRatePlans(tx, input, scheduleIdsByCode, categoryIdsByCode, summary)
      await previewDepartureOverrides(tx, input, summary)
      return []
    }

    await upsertSchedules(tx, input, scheduleIdsByCode, summary)
    await upsertPricingCategories(tx, input, categoryIdsByCode, summary)
    const changedEvents = await upsertRatePlans(
      tx,
      input,
      scheduleIdsByCode,
      categoryIdsByCode,
      summary,
    )
    await upsertDepartureOverrides(tx, input, summary)
    return changedEvents
  })

  await emitMatrixImportEvents(runtime.eventBus, events)
  return { summary }
}

async function resolveScheduleIds(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
): Promise<Map<string, string>> {
  const codes = new Set<string>()
  for (const schedule of input.schedules) codes.add(schedule.code)
  for (const plan of input.ratePlans) {
    if (plan.scheduleCode) codes.add(plan.scheduleCode)
  }

  const idsByCode = new Map<string, string>()
  for (const code of codes) {
    const [row] = await db
      .select({ id: priceSchedules.id })
      .from(priceSchedules)
      .where(
        and(eq(priceSchedules.priceCatalogId, input.priceCatalogId), eq(priceSchedules.code, code)),
      )
      .limit(1)
    if (row) {
      idsByCode.set(code, row.id)
    }
  }

  const providedCodes = new Set(input.schedules.map((schedule) => schedule.code))
  for (const plan of input.ratePlans) {
    if (
      plan.scheduleCode &&
      !idsByCode.has(plan.scheduleCode) &&
      !providedCodes.has(plan.scheduleCode)
    ) {
      throw new RequestValidationError(`Unknown price schedule code: ${plan.scheduleCode}`, {
        scheduleCode: plan.scheduleCode,
      })
    }
  }

  return idsByCode
}

async function resolveCategoryIds(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
): Promise<Map<string, string>> {
  const codes = new Set<string>()
  for (const category of input.pricingCategories) codes.add(category.code)
  for (const plan of input.ratePlans) {
    for (const unitPrice of plan.unitPrices) {
      if (unitPrice.categoryCode) codes.add(unitPrice.categoryCode)
    }
  }

  const idsByCode = new Map<string, string>()
  for (const code of codes) {
    const [row] = await db
      .select({ id: pricingCategories.id })
      .from(pricingCategories)
      .where(and(eq(pricingCategories.optionId, input.optionId), eq(pricingCategories.code, code)))
      .limit(1)
    if (row) {
      idsByCode.set(code, row.id)
    }
  }

  const providedCodes = new Set(input.pricingCategories.map((category) => category.code))
  for (const plan of input.ratePlans) {
    for (const unitPrice of plan.unitPrices) {
      if (
        unitPrice.categoryCode &&
        !idsByCode.has(unitPrice.categoryCode) &&
        !providedCodes.has(unitPrice.categoryCode)
      ) {
        throw new RequestValidationError(
          `Unknown pricing category code: ${unitPrice.categoryCode}`,
          {
            categoryCode: unitPrice.categoryCode,
          },
        )
      }
    }
  }

  return idsByCode
}

async function previewSchedules(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  summary: RatePlanMatrixImportSummary,
) {
  for (const schedule of input.schedules) {
    const exists = await scheduleExists(db, input.priceCatalogId, schedule.code)
    increment(summary.schedules, exists ? "updated" : "created")
  }
}

async function previewPricingCategories(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  summary: RatePlanMatrixImportSummary,
) {
  for (const category of input.pricingCategories) {
    const exists = await pricingCategoryExists(db, input.optionId, category.code)
    increment(summary.pricingCategories, exists ? "updated" : "created")
  }
}

async function previewRatePlans(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  scheduleIdsByCode: Map<string, string>,
  categoryIdsByCode: Map<string, string>,
  summary: RatePlanMatrixImportSummary,
) {
  const pendingScheduleCodes = new Set(input.schedules.map((schedule) => schedule.code))
  const pendingCategoryCodes = new Set(input.pricingCategories.map((category) => category.code))

  for (const plan of input.ratePlans) {
    if (plan.pricingMode === "per_booking" && plan.unitPrices.length > 0) {
      throw new RequestValidationError(PER_BOOKING_REJECTS_UNIT_PRICES_MESSAGE, { code: plan.code })
    }
    if (plan.scheduleCode && !scheduleIdsByCode.has(plan.scheduleCode)) {
      if (!pendingScheduleCodes.has(plan.scheduleCode)) {
        throw new RequestValidationError(`Unknown price schedule code: ${plan.scheduleCode}`, {
          scheduleCode: plan.scheduleCode,
        })
      }
    } else {
      resolveScheduleId(plan, scheduleIdsByCode)
    }
    const existingRuleId = await getOptionPriceRuleId(db, input.optionId, plan.code)
    increment(summary.ratePlans, existingRuleId ? "updated" : "created")
    for (const unitPrice of plan.unitPrices) {
      const pricingCategoryId =
        unitPrice.categoryCode &&
        !categoryIdsByCode.has(unitPrice.categoryCode) &&
        pendingCategoryCodes.has(unitPrice.categoryCode)
          ? null
          : resolvePricingCategoryId(unitPrice, categoryIdsByCode)
      const existingUnitRuleId = existingRuleId
        ? unitPrice.categoryCode &&
          !categoryIdsByCode.has(unitPrice.categoryCode) &&
          pendingCategoryCodes.has(unitPrice.categoryCode)
          ? null
          : await getOptionUnitPriceRuleId(db, existingRuleId, unitPrice.unitId, pricingCategoryId)
        : null
      increment(summary.unitPrices, existingUnitRuleId ? "updated" : "created")
    }
  }
}

async function previewDepartureOverrides(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  summary: RatePlanMatrixImportSummary,
) {
  for (const override of input.departureOverrides) {
    const exists = await departureOverrideExists(
      db,
      override.departureId,
      override.optionUnitId,
      input.priceCatalogId,
    )
    increment(summary.departureOverrides, exists ? "updated" : "created")
  }
}

async function upsertSchedules(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  idsByCode: Map<string, string>,
  summary: RatePlanMatrixImportSummary,
) {
  for (const schedule of input.schedules) {
    const existingId = idsByCode.get(schedule.code) ?? null
    const values = { ...schedule, priceCatalogId: input.priceCatalogId }
    if (existingId) {
      await db
        .update(priceSchedules)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(priceSchedules.id, existingId))
      increment(summary.schedules, "updated")
      continue
    }

    const [row] = await db
      .insert(priceSchedules)
      .values(values)
      .returning({ id: priceSchedules.id })
    if (row) {
      idsByCode.set(schedule.code, row.id)
      increment(summary.schedules, "created")
    }
  }
}

async function upsertPricingCategories(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  idsByCode: Map<string, string>,
  summary: RatePlanMatrixImportSummary,
) {
  for (const category of input.pricingCategories) {
    const existingId = idsByCode.get(category.code) ?? null
    const values = {
      ...category,
      productId: category.productId ?? input.productId,
      optionId: category.optionId ?? input.optionId,
    }
    if (existingId) {
      await db
        .update(pricingCategories)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(pricingCategories.id, existingId))
      increment(summary.pricingCategories, "updated")
      continue
    }

    const [row] = await db
      .insert(pricingCategories)
      .values(values)
      .returning({ id: pricingCategories.id })
    if (row) {
      idsByCode.set(category.code, row.id)
      increment(summary.pricingCategories, "created")
    }
  }
}

async function upsertRatePlans(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  scheduleIdsByCode: Map<string, string>,
  categoryIdsByCode: Map<string, string>,
  summary: RatePlanMatrixImportSummary,
): Promise<MatrixImportEvents> {
  const events: MatrixImportEvents = []

  for (const plan of input.ratePlans) {
    if (plan.pricingMode === "per_booking" && plan.unitPrices.length > 0) {
      throw new RequestValidationError(PER_BOOKING_REJECTS_UNIT_PRICES_MESSAGE, { code: plan.code })
    }

    const { unitPrices, scheduleCode: _scheduleCode, ...planValues } = plan
    const priceScheduleId = resolveScheduleId(plan, scheduleIdsByCode)
    const values = {
      ...planValues,
      productId: input.productId,
      optionId: input.optionId,
      priceCatalogId: input.priceCatalogId,
      priceScheduleId,
    }
    const existingRuleId = await getOptionPriceRuleId(db, input.optionId, plan.code)
    let ruleId: string
    if (existingRuleId) {
      await db
        .update(optionPriceRules)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(optionPriceRules.id, existingRuleId))
      increment(summary.ratePlans, "updated")
      ruleId = existingRuleId
      events.push({
        productId: input.productId,
        ruleId: existingRuleId,
        kind: "option-rule",
        source: "updated",
      })
    } else {
      const [row] = await db
        .insert(optionPriceRules)
        .values(values)
        .returning({ id: optionPriceRules.id })
      if (!row) continue
      ruleId = row.id
      increment(summary.ratePlans, "created")
      events.push({ productId: input.productId, ruleId, kind: "option-rule", source: "created" })
    }

    for (const unitPrice of unitPrices) {
      const pricingCategoryId = resolvePricingCategoryId(unitPrice, categoryIdsByCode)
      const existingUnitRuleId = await getOptionUnitPriceRuleId(
        db,
        ruleId,
        unitPrice.unitId,
        pricingCategoryId,
      )
      const { categoryCode: _categoryCode, ...unitValues } = unitPrice
      const values = {
        ...unitValues,
        optionPriceRuleId: ruleId,
        optionId: input.optionId,
        pricingCategoryId,
      }

      if (existingUnitRuleId) {
        await db
          .update(optionUnitPriceRules)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(optionUnitPriceRules.id, existingUnitRuleId))
        increment(summary.unitPrices, "updated")
        events.push({
          productId: input.productId,
          ruleId: existingUnitRuleId,
          kind: "option-unit-rule",
          source: "updated",
        })
        continue
      }

      const [row] = await db
        .insert(optionUnitPriceRules)
        .values(values)
        .returning({ id: optionUnitPriceRules.id })
      if (row) {
        increment(summary.unitPrices, "created")
        events.push({
          productId: input.productId,
          ruleId: row.id,
          kind: "option-unit-rule",
          source: "created",
        })
      }
    }
  }

  return events
}

async function upsertDepartureOverrides(
  db: PostgresJsDatabase,
  input: RatePlanMatrixImportInput,
  summary: RatePlanMatrixImportSummary,
) {
  for (const override of input.departureOverrides) {
    const existingId = await getDepartureOverrideId(
      db,
      override.departureId,
      override.optionUnitId,
      input.priceCatalogId,
    )
    const values = {
      ...override,
      optionId: input.optionId,
      priceCatalogId: input.priceCatalogId,
    }

    if (existingId) {
      await db
        .update(departurePriceOverrides)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(departurePriceOverrides.id, existingId))
      increment(summary.departureOverrides, "updated")
      continue
    }

    await db.insert(departurePriceOverrides).values(values)
    increment(summary.departureOverrides, "created")
  }
}

function resolveScheduleId(
  plan: RatePlanMatrixImportInput["ratePlans"][number],
  idsByCode: Map<string, string>,
): string | null {
  if (plan.priceScheduleId) return plan.priceScheduleId
  if (!plan.scheduleCode) return null
  const id = idsByCode.get(plan.scheduleCode)
  if (!id) {
    throw new RequestValidationError(`Unknown price schedule code: ${plan.scheduleCode}`, {
      scheduleCode: plan.scheduleCode,
    })
  }
  return id
}

function resolvePricingCategoryId(
  unitPrice: RatePlanMatrixImportInput["ratePlans"][number]["unitPrices"][number],
  idsByCode: Map<string, string>,
): string | null {
  if (unitPrice.pricingCategoryId) return unitPrice.pricingCategoryId
  if (!unitPrice.categoryCode) return null
  const id = idsByCode.get(unitPrice.categoryCode)
  if (!id) {
    throw new RequestValidationError(`Unknown pricing category code: ${unitPrice.categoryCode}`, {
      categoryCode: unitPrice.categoryCode,
    })
  }
  return id
}

async function scheduleExists(db: PostgresJsDatabase, priceCatalogId: string, code: string) {
  return (await getScheduleId(db, priceCatalogId, code)) !== null
}

async function getScheduleId(db: PostgresJsDatabase, priceCatalogId: string, code: string) {
  const [row] = await db
    .select({ id: priceSchedules.id })
    .from(priceSchedules)
    .where(and(eq(priceSchedules.priceCatalogId, priceCatalogId), eq(priceSchedules.code, code)))
    .limit(1)
  return row?.id ?? null
}

async function pricingCategoryExists(db: PostgresJsDatabase, optionId: string, code: string) {
  const [row] = await db
    .select({ id: pricingCategories.id })
    .from(pricingCategories)
    .where(and(eq(pricingCategories.optionId, optionId), eq(pricingCategories.code, code)))
    .limit(1)
  return !!row
}

async function getOptionPriceRuleId(db: PostgresJsDatabase, optionId: string, code: string) {
  const [row] = await db
    .select({ id: optionPriceRules.id })
    .from(optionPriceRules)
    .where(and(eq(optionPriceRules.optionId, optionId), eq(optionPriceRules.code, code)))
    .limit(1)
  return row?.id ?? null
}

async function getOptionUnitPriceRuleId(
  db: PostgresJsDatabase,
  optionPriceRuleId: string,
  unitId: string,
  pricingCategoryId: string | null,
) {
  const categoryCondition = pricingCategoryId
    ? eq(optionUnitPriceRules.pricingCategoryId, pricingCategoryId)
    : isNull(optionUnitPriceRules.pricingCategoryId)
  const [row] = await db
    .select({ id: optionUnitPriceRules.id })
    .from(optionUnitPriceRules)
    .where(
      and(
        eq(optionUnitPriceRules.optionPriceRuleId, optionPriceRuleId),
        eq(optionUnitPriceRules.unitId, unitId),
        categoryCondition,
      ),
    )
    .limit(1)
  return row?.id ?? null
}

async function departureOverrideExists(
  db: PostgresJsDatabase,
  departureId: string,
  optionUnitId: string,
  priceCatalogId: string,
) {
  return (await getDepartureOverrideId(db, departureId, optionUnitId, priceCatalogId)) !== null
}

async function getDepartureOverrideId(
  db: PostgresJsDatabase,
  departureId: string,
  optionUnitId: string,
  priceCatalogId: string,
) {
  const [row] = await db
    .select({ id: departurePriceOverrides.id })
    .from(departurePriceOverrides)
    .where(
      and(
        eq(departurePriceOverrides.departureId, departureId),
        eq(departurePriceOverrides.optionUnitId, optionUnitId),
        eq(departurePriceOverrides.priceCatalogId, priceCatalogId),
      ),
    )
    .limit(1)
  return row?.id ?? null
}

async function emitMatrixImportEvents(eventBus: EventBus | undefined, events: MatrixImportEvents) {
  if (!eventBus) return
  const uniqueEvents = new Map<string, PricingRuleChangedEvent>()
  for (const event of events) {
    uniqueEvents.set(`${event.kind}:${event.ruleId}:${event.source}`, event)
  }
  await Promise.all(
    [...uniqueEvents.values()].map((event) =>
      eventBus.emit(PRICING_RULE_CHANGED_EVENT, event, {
        category: "domain",
        source: "service",
      }),
    ),
  )
}

export const __test__ = {
  PER_BOOKING_REJECTS_UNIT_PRICES_MESSAGE,
}
