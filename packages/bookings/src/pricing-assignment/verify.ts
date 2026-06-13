import { resolveBookingDraft } from "./draft.js"
import type {
  BookingDraftQuantities,
  BookingDraftTraveler,
  PricingAssignmentUnit,
  TravelerRole,
} from "./types.js"
import { isInventoryUnit, isPersonUnit } from "./unit-helpers.js"

/**
 * Minimal traveler shape `verifyBookingDraft` needs. Mirrors the
 * wire-format `BookingCreateTravelerInput` from
 * `@voyantjs/bookings-react`, defined here to avoid a cyclic
 * dependency. The verifier doesn't care about most fields —
 * `firstName` / `email` / etc. — only the role + traveler-category +
 * primary flag that decide which pricing band each traveler
 * implicitly maps to.
 */
export interface VerifiableTraveler {
  clientTravelerKey?: string | null
  isPrimary?: boolean | null
  travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
}

/**
 * Submitted itemLine shape `verifyBookingDraft` needs. Mirrors the
 * wire-format `BookingCreateItemLineInput`.
 */
export interface VerifiableItemLine {
  optionUnitId: string
  quantity: number
  travelerKeys?: string[] | null
  travelerIndexes?: number[] | null
}

export interface BookingDraftMismatch {
  /** "qty" — submitted quantity differs from resolver-derived quantity for a unit. */
  /** "missing" — resolver derived a unit not present in the submitted lines. */
  /** "extra" — submitted line for a unit the resolver wouldn't have produced. */
  kind: "qty" | "missing" | "extra"
  optionUnitId: string
  submittedQuantity: number
  resolvedQuantity: number
}

export interface VerifyBookingDraftResult {
  ok: boolean
  mismatches: BookingDraftMismatch[]
}

/**
 * Re-derive what `resolveBookingDraft` would have produced from the
 * submitted wire-format payload and compare against the submitted
 * itemLines. Used server-side as a sanity check on the client's
 * draft resolution. Returns `ok: true` when the submitted lines
 * match the resolver, else lists per-unit mismatches.
 *
 * Behavior of this helper is *non-rejecting* — callers decide
 * whether to log, warn, or fail. The orchestrator currently logs;
 * a follow-up will flip to rejection once observability confirms
 * no legitimate clients trip the warning.
 *
 * Notes on the reconstruction:
 *   - The wire format doesn't carry split per-traveler assignment
 *     fields (the join-table model encodes them through
 *     `itemLines[].travelerKeys`), so we reconstruct the relevant
 *     pricing or inventory unit by walking item lines and matching
 *     them to traveler keys. Deprecated `travelerIndexes` remain a
 *     fallback for older clients.
 *   - DOB doesn't round-trip on the wire today either; we feed the
 *     resolver the `travelerCategory` as a role hint so age-banded
 *     options can still be re-derived.
 */
export function verifyBookingDraft(input: {
  travelers: ReadonlyArray<VerifiableTraveler>
  itemLines: ReadonlyArray<VerifiableItemLine>
  units: ReadonlyArray<PricingAssignmentUnit>
}): VerifyBookingDraftResult {
  if (input.itemLines.length === 0 || input.units.length === 0) {
    return { ok: true, mismatches: [] }
  }

  // Walk the submitted itemLines to recover the per-traveler unit
  // assignment the client intended. Prefer stable `travelerKeys`
  // when present; fall back to deprecated `travelerIndexes` for
  // legacy clients. If neither is present, we can't verify
  // per-traveler assignment — just compare aggregate quantities.
  // Booking-create schema validation rejects unknown traveler keys
  // before this verifier runs.
  const unitById = new Map(input.units.map((unit) => [unit.optionUnitId, unit]))
  const travelerIndexByKey = new Map<string, number>()
  for (const [index, traveler] of input.travelers.entries()) {
    const key = traveler.clientTravelerKey?.trim()
    if (key && !travelerIndexByKey.has(key)) travelerIndexByKey.set(key, index)
  }
  const unitByTravelerIndex = new Map<number, string>()
  for (const line of input.itemLines) {
    const travelerKeys = (line.travelerKeys ?? []).filter((key) => key.trim().length > 0)
    const keyedIndexes = travelerKeys
      .map((key) => travelerIndexByKey.get(key.trim()))
      .filter((index): index is number => typeof index === "number")
    const indexes = travelerKeys.length > 0 ? keyedIndexes : (line.travelerIndexes ?? [])
    for (const idx of indexes) {
      unitByTravelerIndex.set(idx, line.optionUnitId)
    }
  }

  const travelerDrafts: BookingDraftTraveler[] = input.travelers.map((t, i) => {
    const cat = t.travelerCategory
    const role: TravelerRole =
      t.isPrimary === true
        ? "lead"
        : cat === "child" || cat === "infant" || cat === "adult"
          ? cat
          : "adult"
    const assigned = unitByTravelerIndex.get(i)
    const assignedUnit = assigned ? unitById.get(assigned) : undefined
    return {
      personId: null,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      preferredLanguage: "",
      role,
      dateOfBirth: null,
      // We deliberately use `auto` (not `manual`) here even though
      // the client effectively committed to an assignment when it
      // serialized the line. The point of verification is to ask
      // "would a fresh resolver, given the same role/category
      // signals, produce these quantities?" — i.e. allow the
      // resolver to re-derive instead of treating the submitted
      // value as ground truth. Otherwise the day-tour bug shape
      // (3 travelers all manually frozen to Adult) would round-trip
      // through the verifier unchanged.
      pricingUnitId: assigned && assignedUnit && isPersonUnit(assignedUnit) ? assigned : null,
      inventoryUnitId: assigned && assignedUnit && isInventoryUnit(assignedUnit) ? assigned : null,
      pricingUnitSource: "auto",
      inventoryUnitSource: "auto",
    }
  })

  // Aggregate submitted quantities for resolver input. For
  // accommodation options the resolver passes these through
  // unchanged; for person-priced options it rebuilds them from
  // traveler assignments.
  const submittedQuantities: BookingDraftQuantities = {}
  for (const line of input.itemLines) {
    submittedQuantities[line.optionUnitId] =
      (submittedQuantities[line.optionUnitId] ?? 0) + line.quantity
  }

  const resolved = resolveBookingDraft({
    quantities: submittedQuantities,
    travelers: travelerDrafts,
    units: input.units,
  })

  const mismatches: BookingDraftMismatch[] = []
  const allUnitIds = new Set([
    ...Object.keys(submittedQuantities),
    ...Object.keys(resolved.quantities),
  ])
  for (const unitId of allUnitIds) {
    const submitted = submittedQuantities[unitId] ?? 0
    const resolvedQty = resolved.quantities[unitId] ?? 0
    if (submitted === resolvedQty) continue
    const kind: BookingDraftMismatch["kind"] =
      submitted === 0 ? "missing" : resolvedQty === 0 ? "extra" : "qty"
    mismatches.push({
      kind,
      optionUnitId: unitId,
      submittedQuantity: submitted,
      resolvedQuantity: resolvedQty,
    })
  }

  return { ok: mismatches.length === 0, mismatches }
}
