/**
 * Pure, transport-agnostic logic for mapping travelers onto option_units
 * at booking-create time. Lives in `@voyantjs/bookings` so the
 * booking-create dialog (preview + submit) AND server-side submit
 * validation can both reach for the same function.
 *
 * Vocabulary:
 *   - An option carries N units of different `unitType`s. Today we have
 *     `person | group | room | vehicle | service | other`.
 *   - A **pricing unit** (typically `unit_type='person'`) is a price tier
 *     a traveler is billed as (Adult / Child 6-12 / Infant 0-5 / ...).
 *   - An **inventory unit** (`'room' | 'vehicle' | 'seat'`) is a finite
 *     container a traveler is placed into.
 *   - A traveler is **always assigned to a pricing unit**. The current
 *     `assignedUnitId` field still represents that (despite the legacy
 *     `roomUnitId` name at the UI layer — the rename lands in Phase 1
 *     of voyantjs/voyant#1267).
 *
 * No React, no DB, no HTTP — just the assignment math.
 */

export type TravelerRole = "lead" | "adult" | "child" | "infant"
export type AssignmentRoleHint = "adult" | "child" | "infant"

export interface PricingAssignmentUnit {
  /** Option the unit belongs to. Null for product-level units. */
  optionId: string | null
  /** Stable id of the unit (option_unit primary key). */
  optionUnitId: string
  /** Display name (e.g. "Adult", "Child 6-12", "DBL room"). */
  unitName: string
  /** Stable code from the products schema (`ADULT`, `child_6_12`, …) when present. */
  unitCode?: string | null
  /** Inclusive lower age bound for this unit, when configured. */
  minAge?: number | null
  /** Inclusive upper age bound for this unit, when configured. */
  maxAge?: number | null
  /** Unit category — drives which units count as "pricing tiers". */
  unitType?: "person" | "group" | "room" | "vehicle" | "service" | "other" | null
}

export interface AssignmentTraveler {
  /** ISO `YYYY-MM-DD` date of birth. Drives age-derived unit assignment. */
  dateOfBirth: string | null
  /** Operator-picked traveler role. Carries the lead flag + age hint. */
  role: TravelerRole | null
  /** Current option_unit_id this traveler is mapped to (null when unset). */
  assignedUnitId: string | null
}

/**
 * Compute integer age in full years from an ISO date-of-birth string.
 * Returns null when the DOB is missing or unparseable.
 */
export function computeAgeYears(dob: string | null, now: Date = new Date()): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return null
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

/**
 * Pick the unit for a traveler. Priorities:
 *   1. If we have an age (from DOB) and it falls into a unit's
 *      `[minAge, maxAge]` window, use that unit.
 *   2. Otherwise honor an explicit role hint (Child / Infant / Adult
 *      buttons) by mapping the hint to a representative age and
 *      matching the age band. This works for products whose units
 *      encode the band in the code (`child_0_5`, `child_6_12`) instead
 *      of bare `CHILD`/`INFANT`.
 *   3. Fall back to code/name matching for legacy products that don't
 *      configure min/max ages.
 *
 * `roleHint` covers the common case where the operator knows the
 * traveler is a child but doesn't have the exact DOB. Without it, a
 * roleless traveler would silently default to Adult pricing.
 */
export function pickUnitForAge<TUnit extends PricingAssignmentUnit>(
  units: ReadonlyArray<TUnit>,
  age: number | null,
  roleHint: AssignmentRoleHint | null = null,
): TUnit | undefined {
  if (units.length === 0) return undefined
  const personUnits = units.filter((u) => u.unitType == null || u.unitType === "person")
  const pool = personUnits.length > 0 ? personUnits : units
  const sorted = [...pool].sort((a, b) => (a.minAge ?? 0) - (b.minAge ?? 0))

  const matchByAge = (target: number) =>
    sorted.find(
      (u) => (u.minAge == null || target >= u.minAge) && (u.maxAge == null || target <= u.maxAge),
    )

  if (age != null) {
    const match = matchByAge(age)
    if (match) return match
  }

  if (roleHint) {
    const HINT_AGE = { adult: 30, child: 8, infant: 1 } as const
    const hintAge = HINT_AGE[roleHint]
    // Only consider units with at least one explicit age bound. Without
    // this, legacy units with null min/max (just bare ADULT/CHILD codes)
    // would all match every hint age and collapse onto the first sorted
    // entry (almost always Adult). Code-matching below handles those.
    const banded = sorted.filter((u) => u.minAge != null || u.maxAge != null)
    const match = banded.find(
      (u) => (u.minAge == null || hintAge >= u.minAge) && (u.maxAge == null || hintAge <= u.maxAge),
    )
    if (match) return match
  }

  const findByCode = (code: string) =>
    sorted.find((u) => (u.unitCode ?? "").toUpperCase() === code) ??
    sorted.find((u) => new RegExp(`\\b${code}\\b`, "i").test(u.unitName))
  if (roleHint === "child") return findByCode("CHILD") ?? sorted[0]
  if (roleHint === "infant") return findByCode("INFANT") ?? sorted[0]
  return findByCode("ADULT") ?? sorted[sorted.length - 1] ?? sorted[0]
}

/**
 * Find the unit whose `[minAge, maxAge]` window contains the given
 * DOB-derived age. Returns the unit id, or null if no match (or DOB
 * unset). Person-typed units are preferred; everything else is
 * ignored. Caller falls back to a default unit when null.
 */
export function matchUnitByDob<TUnit extends PricingAssignmentUnit>(
  units: ReadonlyArray<TUnit>,
  dob: string | null,
): string | null {
  if (!dob) return null
  const age = computeAgeYears(dob)
  if (age == null) return null
  const personUnits = units.filter((u) => u.unitType == null || u.unitType === "person")
  const match = personUnits.find(
    (u) => (u.minAge == null || age >= u.minAge) && (u.maxAge == null || age <= u.maxAge),
  )
  return match?.optionUnitId ?? null
}

/**
 * Find the unit matching a role hint when DOB is missing. Maps the
 * role to a representative age and matches against `[minAge, maxAge]`.
 * Returns null when the role doesn't carry an age signal (e.g. `lead`).
 *
 * Routes `infant` to whichever band covers ~1y (e.g. `child_0_5`) and
 * `child` to whichever covers ~8y (e.g. `child_6_12`), regardless of
 * how the product codes the unit names.
 */
export function matchUnitByRoleHint<TUnit extends PricingAssignmentUnit>(
  units: ReadonlyArray<TUnit>,
  role: TravelerRole | null,
): string | null {
  if (!role || role === "lead") return null
  const HINT_AGE: Record<AssignmentRoleHint, number> = {
    adult: 30,
    child: 8,
    infant: 1,
  }
  const hintAge = HINT_AGE[role]
  if (hintAge == null) return null
  // Only consider units with explicit age bands — units with null
  // min/max would all spuriously match any hint age.
  const banded = units.filter(
    (u) =>
      (u.unitType == null || u.unitType === "person") && (u.minAge != null || u.maxAge != null),
  )
  const match = banded.find(
    (u) => (u.minAge == null || hintAge >= u.minAge) && (u.maxAge == null || hintAge <= u.maxAge),
  )
  return match?.optionUnitId ?? null
}

/**
 * Rebuild stepper quantities from per-traveler unit assignments.
 *
 * Each traveler's `assignedUnitId` is the operator's explicit choice
 * (DOB-pre-picked at attach, overridable via the dynamic category
 * buttons), so we count assignments directly and add any per-option
 * residual on the adult/primary unit when the stepper qty exceeds the
 * number of travelers actually assigned. Operator selection always
 * wins — this never moves a traveler off their chosen unit.
 *
 * Returns:
 *   - `assignedUnitIds[i]` — the option_unit_id the i-th traveler
 *     should end up mapped to (parallel to the input `travelers`).
 *   - `quantities` — per-option-unit counts: how many travelers wound
 *     up on each unit, plus any operator-picked residual on the option's
 *     adult/primary unit.
 */
export function derivePricingAssignment(input: {
  quantities: Record<string, number>
  travelers: ReadonlyArray<AssignmentTraveler>
  units: ReadonlyArray<PricingAssignmentUnit>
}): {
  assignedUnitIds: ReadonlyArray<string | null>
  quantities: Record<string, number>
} {
  const { quantities, travelers, units } = input
  if (units.length === 0) {
    return {
      assignedUnitIds: travelers.map((t) => t.assignedUnitId),
      quantities,
    }
  }

  const unitsByOption = new Map<string, PricingAssignmentUnit[]>()
  for (const unit of units) {
    if (!unit.optionId) continue
    const list = unitsByOption.get(unit.optionId)
    if (list) list.push(unit)
    else unitsByOption.set(unit.optionId, [unit])
  }

  const unitToOption = new Map(units.map((u) => [u.optionUnitId, u.optionId]))
  const unitById = new Map(units.map((u) => [u.optionUnitId, u]))

  // Per-option total from the stepper. This is the count the operator
  // committed to when picking rooms.
  const totalByOption = new Map<string, number>()
  for (const [unitId, qty] of Object.entries(quantities)) {
    if (qty <= 0) continue
    const optionId = unitToOption.get(unitId)
    if (!optionId) continue
    totalByOption.set(optionId, (totalByOption.get(optionId) ?? 0) + qty)
  }

  const assignedForDefaulting = new Map<string, number>()
  for (const traveler of travelers) {
    if (!traveler.assignedUnitId) continue
    const optionId = unitToOption.get(traveler.assignedUnitId)
    if (!optionId) continue
    assignedForDefaulting.set(optionId, (assignedForDefaulting.get(optionId) ?? 0) + 1)
  }

  const optionDemand = Array.from(totalByOption.entries())
  const assignedUnitIds: (string | null)[] = travelers.map((traveler) => {
    if (traveler.assignedUnitId && unitById.has(traveler.assignedUnitId)) {
      return traveler.assignedUnitId
    }

    const optionId =
      optionDemand.find(
        ([candidate, total]) => (assignedForDefaulting.get(candidate) ?? 0) < total,
      )?.[0] ?? optionDemand[0]?.[0]
    if (!optionId) return traveler.assignedUnitId

    const age = computeAgeYears(traveler.dateOfBirth)
    const roleHint: AssignmentRoleHint | null =
      traveler.role === "adult" || traveler.role === "child" || traveler.role === "infant"
        ? traveler.role
        : null
    const unit = pickUnitForAge(unitsByOption.get(optionId) ?? [], age, roleHint)
    if (!unit) return traveler.assignedUnitId

    assignedForDefaulting.set(optionId, (assignedForDefaulting.get(optionId) ?? 0) + 1)
    return unit.optionUnitId
  })

  // Count actual traveler assignments per unit + per option.
  const next: Record<string, number> = {}
  const assignedByOption = new Map<string, number>()
  for (const id of assignedUnitIds) {
    if (!id) continue
    const optionId = unitToOption.get(id)
    if (!optionId) continue
    next[id] = (next[id] ?? 0) + 1
    assignedByOption.set(optionId, (assignedByOption.get(optionId) ?? 0) + 1)
  }

  // Residual = operator picked N rooms but only added M travelers; put
  // the leftover on the option's adult/primary unit so the price total
  // matches the stepper.
  for (const [optionId, total] of totalByOption) {
    const assigned = assignedByOption.get(optionId) ?? 0
    const residual = Math.max(0, total - assigned)
    if (residual === 0) continue
    const adult = pickUnitForAge(unitsByOption.get(optionId) ?? [], null)
    if (!adult) continue
    next[adult.optionUnitId] = (next[adult.optionUnitId] ?? 0) + residual
  }

  return { assignedUnitIds, quantities: next }
}
