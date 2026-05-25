import type { BookingCreateItemLineInput } from "@voyantjs/bookings-react"
import type { ProductRecord } from "@voyantjs/products-react"

export type ProductPickerSearchRecord = Pick<ProductRecord, "description" | "name" | "sellCurrency">

export interface DepartureSlotSearchRecord {
  id: string
  optionId: string | null
  startsAt: string
  status?: string
}

export interface BookingCreateUnitLineRecord {
  optionId: string | null
  optionUnitId: string
  unitName: string
}

export interface BookingCreatePricingLineRecord {
  unitId: string
  label: string
  unitAmountCents: number | null
  totalAmountCents: number | null
}

export interface BookingCreatePricingRecord {
  confirmedAmountCents: number | null
  lines: BookingCreatePricingLineRecord[]
}

type BookingCreateStepperUnitType =
  | "person"
  | "group"
  | "room"
  | "vehicle"
  | "service"
  | "other"
  | null

export interface BookingCreateTravelerAssignableUnitRecord {
  optionId?: string | null
  optionUnitId: string
  unitType?: BookingCreateStepperUnitType
}

export function normalizeBookingSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function matchesBookingSearchText(value: string | null | undefined, query: string): boolean {
  const normalizedQuery = normalizeBookingSearchText(query)
  if (!normalizedQuery) return true
  return normalizeBookingSearchText(value ?? "").includes(normalizedQuery)
}

export function productMatchesPickerSearch(
  product: ProductPickerSearchRecord | null | undefined,
  query: string,
): boolean {
  if (!product) return false
  return [product.name, product.description, product.sellCurrency].some((value) =>
    matchesBookingSearchText(value, query),
  )
}

export type BillingPersonContactValidationResult = "valid" | "missing-contact" | "invalid-email"

export function isRealBookingEmail(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false
  return !["noreply@example.com", "tbd@example.com", "traveler@example.com"].includes(normalized)
}

export function validateBillingPersonContact(
  contact: { email?: string | null; phone?: string | null } | null | undefined,
): BillingPersonContactValidationResult {
  const email = contact?.email?.trim() ?? ""
  const phone = contact?.phone?.trim() ?? ""

  if (email && !isRealBookingEmail(email)) return "invalid-email"
  if (!email && !phone) return "missing-contact"
  return "valid"
}

export function getTravelerAssignableStepperUnits<
  TUnit extends BookingCreateTravelerAssignableUnitRecord,
>(units: readonly TUnit[]): TUnit[] {
  // "Inventory" units (rooms, vehicles) are containers a traveler is
  // placed into. When an option configures one, person-typed
  // pricing-tier units on the same option are hidden from the
  // stepper since their pricing folds into the container's per-pax
  // accounting at submit time.
  const isInventoryType = (unit: TUnit) => unit.unitType === "room" || unit.unitType === "vehicle"
  const hasInventoryByOption = new Map<string, boolean>()

  for (const unit of units) {
    const optionKey = unit.optionId ?? unit.optionUnitId
    if (isInventoryType(unit)) hasInventoryByOption.set(optionKey, true)
    else if (!hasInventoryByOption.has(optionKey)) hasInventoryByOption.set(optionKey, false)
  }

  return units.filter((unit) => {
    if (isInventoryType(unit)) return true
    if (unit.unitType !== "person") return false
    return !hasInventoryByOption.get(unit.optionId ?? unit.optionUnitId)
  })
}

export function getBookableDepartureSlots<TSlot extends DepartureSlotSearchRecord>(
  slots: readonly TSlot[],
  options: {
    nowIso: string
    optionId: string | null
  },
): TSlot[] {
  return slots
    .filter((slot) => !slot.status || slot.status === "open")
    .filter((slot) => slot.startsAt >= options.nowIso)
    .filter((slot) => {
      if (!options.optionId) return true
      return slot.optionId === null || slot.optionId === options.optionId
    })
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
}

export function itemLinesToRows(
  quantities: Record<string, number>,
  units: BookingCreateUnitLineRecord[],
  pricing: BookingCreatePricingRecord | null,
  travelerIndexesByUnitId: Record<string, number[]> = {},
): BookingCreateItemLineInput[] {
  const unitsById = new Map(units.map((unit) => [unit.optionUnitId, unit]))
  const unitNames = new Map(units.map((unit) => [unit.optionUnitId, unit.unitName]))
  const pricedLines = new Map((pricing?.lines ?? []).map((line) => [line.unitId, line]))
  const selectedLines = Object.entries(quantities).filter(([, quantity]) => quantity > 0)
  const pricedTotal = selectedLines.reduce((sum, [optionUnitId]) => {
    const total = pricedLines.get(optionUnitId)?.totalAmountCents
    return total == null ? sum : sum + total
  }, 0)
  const unpricedLines = selectedLines.filter(
    ([optionUnitId]) => pricedLines.get(optionUnitId)?.totalAmountCents == null,
  )
  const unpricedQuantity = unpricedLines.reduce((sum, [, quantity]) => sum + quantity, 0)
  const manualRemainder =
    pricing?.confirmedAmountCents != null && unpricedLines.length > 0
      ? Math.max(0, pricing.confirmedAmountCents - pricedTotal)
      : null
  let allocatedManualTotal = 0

  return selectedLines.map(([optionUnitId, quantity]) => {
    const pricedLine = pricedLines.get(optionUnitId)
    let totalSellAmountCents = pricedLine?.totalAmountCents ?? null
    if (totalSellAmountCents == null && manualRemainder != null && unpricedQuantity > 0) {
      const isLastUnpriced = unpricedLines[unpricedLines.length - 1]?.[0] === optionUnitId
      totalSellAmountCents = isLastUnpriced
        ? manualRemainder - allocatedManualTotal
        : Math.floor((manualRemainder * quantity) / unpricedQuantity)
      allocatedManualTotal += totalSellAmountCents
    }
    const unitSellAmountCents =
      pricedLine?.unitAmountCents ??
      (totalSellAmountCents != null ? Math.floor(totalSellAmountCents / quantity) : null)
    const travelerIndexes = travelerIndexesByUnitId[optionUnitId]
    return {
      // Server uses `clientLineKey` to look up this item after insert
      // and link it to travelers via `booking_item_travelers`. Only
      // stamp when there's an actual traveler mapping to write.
      clientLineKey: travelerIndexes?.length ? `unit:${optionUnitId}` : undefined,
      optionId: unitsById.get(optionUnitId)?.optionId ?? null,
      optionUnitId,
      quantity,
      title: pricedLine?.label ?? unitNames.get(optionUnitId) ?? null,
      unitSellAmountCents,
      totalSellAmountCents,
      travelerIndexes: travelerIndexes?.length ? travelerIndexes : undefined,
    }
  })
}

export function getSelectedSharedRoomUnitId(quantities: Record<string, number>): string | null {
  return Object.entries(quantities).find(([, quantity]) => quantity > 0)?.[0] ?? null
}
