import type { PricingCategoryRecord } from "@voyantjs/pricing-react"
import type { OptionUnitRecord } from "@voyantjs/products-react"

export const unitPlaceholder = "replace-with-option-unit-id"
export const defaultScheduleCode = "SEASON-2026"

export const categoryTypes = [
  "adult",
  "child",
  "infant",
  "senior",
  "group",
  "room",
  "vehicle",
  "service",
  "other",
] as const

export type CategoryType = (typeof categoryTypes)[number]

export type MatrixCategoryDraft = {
  localId: string
  code: string
  name: string
  categoryType: CategoryType
  seatOccupancy: number
}

export type MatrixCellDrafts = Record<string, string>

export const defaultCategories: MatrixCategoryDraft[] = [
  {
    localId: "default-dbl",
    code: "DBL",
    name: "Double room",
    categoryType: "room",
    seatOccupancy: 2,
  },
]

export function buildDefaultPayload(unitId: string) {
  return JSON.stringify(
    {
      schedules: [
        {
          code: defaultScheduleCode,
          name: "Season 2026",
          recurrenceRule: "FREQ=DAILY",
          priority: 0,
        },
      ],
      pricingCategories: [
        {
          code: "DBL",
          name: "Double room",
          categoryType: "room",
          seatOccupancy: 2,
        },
      ],
      ratePlans: [
        {
          code: "SEASON-DBL-BB",
          name: "Double room BB",
          scheduleCode: defaultScheduleCode,
          pricingMode: "per_person",
          unitPrices: [
            {
              unitId,
              categoryCode: "DBL",
              sellAmountCents: 129900,
            },
          ],
        },
      ],
    },
    null,
    2,
  )
}

export const placeholderPayload = buildDefaultPayload(unitPlaceholder)

export function buildGridPayload({
  allowEmptyPrices = false,
  categories,
  cellDrafts,
  recurrenceRule,
  ratePlanCode,
  ratePlanName,
  scheduleCode,
  scheduleName,
  units,
}: {
  allowEmptyPrices?: boolean
  categories: MatrixCategoryDraft[]
  cellDrafts: MatrixCellDrafts
  recurrenceRule: string
  ratePlanCode: string
  ratePlanName: string
  scheduleCode: string
  scheduleName: string
  units: OptionUnitRecord[]
}) {
  const normalizedScheduleCode = normalizeCode(scheduleCode, defaultScheduleCode)
  const normalizedRatePlanCode = normalizeCode(ratePlanCode, "PACKAGE-MATRIX")
  const normalizedCategories = categories.map((category, index) => ({
    ...category,
    code: normalizeCode(category.code, `CAT-${index + 1}`),
    name: category.name.trim() || `Category ${index + 1}`,
  }))
  const unitPrices = []

  for (const unit of units) {
    for (const category of normalizedCategories) {
      const amount = parseAmountToCents(cellDrafts[cellKey(unit.id, category.code)] ?? "")
      if (amount === null) continue
      unitPrices.push({
        unitId: unit.id,
        categoryCode: category.code,
        pricingMode: "per_unit",
        sellAmountCents: amount,
      })
    }
  }

  if (!allowEmptyPrices && unitPrices.length === 0) {
    throw new Error("Enter at least one matrix price before importing.")
  }

  return {
    mode: "upsert",
    schedules: [
      {
        code: normalizedScheduleCode,
        name: scheduleName.trim() || normalizedScheduleCode,
        recurrenceRule: recurrenceRule.trim() || "FREQ=DAILY",
        priority: 0,
      },
    ],
    pricingCategories: normalizedCategories.map((category, index) => ({
      code: category.code,
      name: category.name,
      categoryType: category.categoryType,
      seatOccupancy: category.seatOccupancy,
      sortOrder: index,
    })),
    ratePlans: [
      {
        code: normalizedRatePlanCode,
        name: ratePlanName.trim() || normalizedRatePlanCode,
        scheduleCode: normalizedScheduleCode,
        pricingMode: "per_person",
        allPricingCategories: false,
        unitPrices,
      },
    ],
    departureOverrides: [],
  }
}

export function categoryRecordToDraft(category: PricingCategoryRecord): MatrixCategoryDraft {
  return {
    localId: category.id,
    code: normalizeCode(category.code ?? category.name, category.id),
    name: category.name,
    categoryType: category.categoryType,
    seatOccupancy: category.seatOccupancy,
  }
}

export function nextCategoryCode(categories: MatrixCategoryDraft[]) {
  let index = categories.length + 1
  let code = `CAT-${index}`
  while (categories.some((category) => category.code === code)) {
    index += 1
    code = `CAT-${index}`
  }
  return code
}

export function normalizeCode(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || fallback
}

export function cellKey(unitId: string, categoryCode: string) {
  return `${unitId}::${normalizeCode(categoryCode, "CATEGORY")}`
}

function parseAmountToCents(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const compact = trimmed.replace(/[$\s]/g, "")
  const normalized = compact.includes(".") ? compact.replace(/,/g, "") : compact.replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid price "${value}". Use a whole amount or two decimals.`)
  }
  return Math.round(Number.parseFloat(normalized) * 100)
}

export function parsePastedMatrix(value: string, units: OptionUnitRecord[]) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error("Paste a header row and at least one unit row.")
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ","
  const header = parseDelimitedLine(lines[0], delimiter)
  if (header.length < 2) {
    throw new Error("Header must include a unit column and at least one category column.")
  }

  const categories = header.slice(1).map((label, index) => ({
    localId: `paste-${index}-${normalizeCode(label, `CAT-${index + 1}`)}`,
    code: normalizeCode(label, `CAT-${index + 1}`),
    name: label.trim() || `Category ${index + 1}`,
    categoryType: "room" as CategoryType,
    seatOccupancy: index + 1,
  }))
  const cells: MatrixCellDrafts = {}
  const unmatched: string[] = []

  for (const line of lines.slice(1)) {
    const columns = parseDelimitedLine(line, delimiter)
    const unitLabel = columns[0]?.trim()
    if (!unitLabel) continue

    const unit = units.find((candidate) => unitMatches(candidate, unitLabel))
    if (!unit) {
      unmatched.push(unitLabel)
      continue
    }

    for (const [index, category] of categories.entries()) {
      const amount = columns[index + 1]?.trim()
      if (amount) {
        cells[cellKey(unit.id, category.code)] = amount
      }
    }
  }

  if (unmatched.length > 0) {
    throw new Error(`Could not match unit rows: ${unmatched.join(", ")}`)
  }

  return { categories, cells }
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === delimiter && !inQuotes) {
      values.push(current)
      current = ""
      continue
    }
    current += char
  }

  values.push(current)
  return values
}

function unitMatches(unit: OptionUnitRecord, label: string) {
  const normalized = label.trim().toLowerCase()
  return (
    unit.id.toLowerCase() === normalized ||
    unit.code?.toLowerCase() === normalized ||
    unit.name.toLowerCase() === normalized
  )
}
