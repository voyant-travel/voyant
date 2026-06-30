import type { PricingCategoryRecord } from "./commerce-client.js"
import type { useProductDetailMessages } from "./host.js"
import type { OptionUnitData } from "./product-unit-dialog.js"

export function getUnitTypeLabel(
  type: OptionUnitData["unitType"],
  messages: ReturnType<typeof useProductDetailMessages>["products"]["operations"]["units"],
) {
  switch (type) {
    case "person":
      return messages.typePerson
    case "group":
      return messages.typeGroup
    case "room":
      return messages.typeRoom
    case "vehicle":
      return messages.typeVehicle
    case "service":
      return messages.typeService
    case "other":
      return messages.typeOther
    default:
      return type
  }
}

// Pricing categories that describe the *unit* dimension (room/vehicle — already
// the grid's rows) or a standalone add-on (`service`, handled by the extras
// panel) are not per-traveler price columns. Excluding them stops a product
// whose data carries such categories — e.g. legacy data migrated with a
// "Double room" pricing category alongside the real Adult/Child split — from
// rendering one bogus price column per room next to the traveler columns.
const NON_TRAVELER_CATEGORY_TYPES = new Set<PricingCategoryRecord["categoryType"]>([
  "room",
  "vehicle",
  "service",
])

export function isTravelerCategory(category: {
  categoryType: PricingCategoryRecord["categoryType"]
}) {
  return !NON_TRAVELER_CATEGORY_TYPES.has(category.categoryType)
}

export function getCategoryCondition(metadata: Record<string, unknown> | null | undefined) {
  const condition = metadata?.condition
  return typeof condition === "string" && condition.trim().length > 0 ? condition : null
}

export function categoryAppliesToUnit(
  category: { id: string | null; metadata?: Record<string, unknown> | null },
  unit: OptionUnitData,
) {
  if (!category.id) return true
  const allowedUnitIds = category.metadata?.allowedUnitIds
  if (!Array.isArray(allowedUnitIds) || allowedUnitIds.length === 0) return true
  return allowedUnitIds.includes(unit.id)
}

export function formatProductMoney(amountCents: number | null | undefined, currency: string) {
  if (amountCents == null) return "-"
  return `${(amountCents / 100).toFixed(2)} ${currency}`
}

export function formatUnitPriceCellActionLabel({
  action,
  amount,
  unitName,
  categoryName,
}: {
  action: string
  amount?: string | null
  unitName: string
  categoryName?: string | null
}) {
  return [action, amount, unitName, categoryName].filter(Boolean).join(" - ")
}
