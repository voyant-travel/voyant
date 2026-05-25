/**
 * Pure, transport-agnostic logic for mapping travelers onto option_units
 * at booking-create time. Lives in `@voyantjs/bookings` so the
 * booking-create dialog (preview + submit) is the only call site today,
 * but the server can import the same module to validate or re-resolve
 * submit payloads in a follow-up — that wiring is not yet in place.
 *
 * Vocabulary:
 *   - A **pricing tier** (`unit_type='person'`) is a per-pax price band
 *     a traveler is billed as (Adult / Child 6-12 / Infant 0-5 / …).
 *   - An **inventory unit** (`'room' | 'vehicle' | 'seat'`) is a finite
 *     container a traveler is placed into (one DBL room holds 2 pax).
 *   - "Person-priced options" are options that only have pricing tiers
 *     (no inventory). Excursions. For these, line-item quantities
 *     **derive from the traveler list** (1 adult + 1 child + 1 infant).
 *   - "Accommodation options" have inventory units (and usually a
 *     paired person unit for per-pax fees). For these, line-item
 *     quantities **stay as the operator picked them** (1 DBL room is
 *     still 1 line, not 2).
 *
 * The `roomUnitAssignmentSource` enum on the traveler tracks operator
 * intent so the resolver knows when to re-derive ("auto") versus
 * respect an explicit choice ("manual" / "none" for No room).
 *
 * No React, no DB, no HTTP — just the assignment math.
 *
 * Tracking: voyantjs/voyant#1267.
 */

export type TravelerRole = "lead" | "adult" | "child" | "infant"
export type AssignmentRoleHint = "adult" | "child" | "infant"
export type BookingDraftUnitAssignmentSource = "auto" | "manual" | "none"

export interface BookingDraftTraveler {
  personId: string | null
  firstName: string
  lastName: string
  email: string
  phone: string
  preferredLanguage: string
  role: TravelerRole
  dateOfBirth: string | null
  /**
   * Legacy field name kept for compatibility with the current dialog.
   * For person-priced products it carries the traveler's pricing
   * tier; for accommodation products it carries the selected
   * room/inventory unit. Source of intent disambiguated by
   * `roomUnitAssignmentSource` below.
   */
  roomUnitId: string | null
  /**
   * Tracks operator intent around the legacy `roomUnitId` field.
   *
   * - `auto`: derived from product shape, DOB, role hints, and
   *   selected quantity. Eligible for re-derivation on every render.
   * - `manual`: operator explicitly clicked a category/room button.
   *   The resolver respects the value when it's in the current unit
   *   set; otherwise it re-derives.
   * - `none`: operator explicitly picked "No room". Stays null
   *   regardless of unit demand.
   */
  roomUnitAssignmentSource?: BookingDraftUnitAssignmentSource
}

export interface PricingAssignmentUnit {
  /** Option the unit belongs to. Null for product-level units. */
  optionId?: string | null
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
  /** Unit category — drives the pricing-tier vs inventory split. */
  unitType?: "person" | "group" | "room" | "vehicle" | "service" | "other" | null
}

export type BookingDraftQuantities = Record<string, number>

export interface ResolvedBookingDraft<TTraveler extends BookingDraftTraveler> {
  quantities: BookingDraftQuantities
  travelers: TTraveler[]
  /**
   * For each unit that ended up assigned, the indexes (into the input
   * traveler array) of travelers mapped to it. Used at submit time to
   * stamp `travelerIndexes` on `booking_item` lines so the server can
   * link items to travelers through `booking_item_travelers`.
   */
  travelerIndexesByUnitId: Record<string, number[]>
}

/**
 * Minimal structural shape `resolveBookingExtraLines` needs from an
 * extra line. Real callers (booking-create dialog) pass the full
 * `BookingCreateExtraLineInput` from `@voyantjs/bookings-react`; this
 * type avoids a cyclic dependency.
 */
export interface ResolvableExtraLine {
  productExtraId: string
  pricingMode?: string | null
  pricedPerPerson?: boolean | null
  quantity: number
  unitSellAmountCents?: number | null
  totalSellAmountCents?: number | null
  clientLineKey?: string | null
  travelerIndexes?: number[] | null
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
 * Derive the age-banded traveler category from DOB + role hint.
 * DOB-derived age wins; role hint is the fallback for travelers
 * added before the operator filled in a birthday.
 */
export function deriveDraftPaxBand(
  traveler: Pick<BookingDraftTraveler, "dateOfBirth" | "role">,
  now: Date = new Date(),
): "adult" | "child" | "infant" | null {
  const age = computeAgeYears(traveler.dateOfBirth, now)
  if (age == null) {
    return traveler.role === "adult" || traveler.role === "child" || traveler.role === "infant"
      ? traveler.role
      : null
  }
  if (age < 2) return "infant"
  if (age < 18) return "child"
  return "adult"
}

/**
 * Pick the unit for a traveler pricing band. Priorities:
 *   1. DOB-derived age that falls into a unit's `[minAge, maxAge]`
 *   2. Role hint mapped to a representative age (infant→1, child→8,
 *      adult→30) matched against bands. Works for products coded
 *      `child_0_5` / `child_6_12` (not just literal `INFANT`/`CHILD`).
 *   3. Code/name matching for legacy products with no min/max set.
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
    // Only consider units with at least one explicit age bound.
    // Without this, legacy units with null min/max (just bare
    // ADULT/CHILD codes) would all match every hint age and collapse
    // onto the first sorted entry. Code-matching below handles those.
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
 * Find the unit whose `[minAge, maxAge]` contains the DOB-derived
 * age. Used by the UI to pre-pick a unit when a traveler attaches.
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
 * Find the unit matching a role hint when DOB is missing. Same
 * HINT_AGE mapping as `pickUnitForAge`. Returns null when the role
 * carries no age signal (e.g. `lead`).
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
  const banded = units.filter(
    (u) =>
      (u.unitType == null || u.unitType === "person") && (u.minAge != null || u.maxAge != null),
  )
  const match = banded.find(
    (u) => (u.minAge == null || hintAge >= u.minAge) && (u.maxAge == null || hintAge <= u.maxAge),
  )
  return match?.optionUnitId ?? null
}

function optionKey(unit: PricingAssignmentUnit): string {
  return unit.optionId ?? unit.optionUnitId
}

function isPersonUnit(unit: PricingAssignmentUnit): boolean {
  return unit.unitType == null || unit.unitType === "person"
}

/**
 * Inventory units are finite containers a traveler is placed into.
 * Rooms (hotels), vehicles (transfers), seats (where modeled
 * explicitly). Distinct from pricing tiers (`person`).
 */
function isInventoryUnit(unit: PricingAssignmentUnit): boolean {
  return unit.unitType === "room" || unit.unitType === "vehicle"
}

function roleHintForTraveler(traveler: BookingDraftTraveler): AssignmentRoleHint | null {
  return traveler.role === "adult" || traveler.role === "child" || traveler.role === "infant"
    ? traveler.role
    : null
}

/**
 * Resolve a booking-create draft into the per-unit quantities and
 * per-traveler unit assignments the submit pipeline + price preview
 * both need. Single source of truth for traveler→unit mapping.
 *
 * Shape branching:
 *   - **Person-priced options** (only `person` units, no `room`):
 *     quantities are derived from traveler assignments (1 adult + 1
 *     child + 1 infant = 3 line items, not "3 x Adult"). Auto-source
 *     travelers are re-derived against the current option's bands.
 *   - **Accommodation options** (any `room` unit): operator-picked
 *     stepper quantities are preserved (1 DBL room is 1 line). Per-
 *     traveler room assignments still update `travelerIndexesByUnitId`
 *     so `booking_item_travelers` rows can be created.
 *
 * Respects `roomUnitAssignmentSource`:
 *   - `none` → traveler stays null (explicit No room)
 *   - `manual` → traveler's existing roomUnitId is kept when valid
 *   - `auto` → re-derived against current options
 */
export function resolveBookingDraft<TTraveler extends BookingDraftTraveler>(options: {
  quantities: BookingDraftQuantities
  travelers: readonly TTraveler[]
  units: readonly PricingAssignmentUnit[]
  now?: Date
}): ResolvedBookingDraft<TTraveler> {
  const { quantities, travelers, now = new Date() } = options
  const units = [...options.units]
  if (units.length === 0) {
    return { quantities, travelers: [...travelers], travelerIndexesByUnitId: {} }
  }

  const unitsByOption = new Map<string, PricingAssignmentUnit[]>()
  const unitById = new Map<string, PricingAssignmentUnit>()
  const unitToOption = new Map<string, string>()
  for (const unit of units) {
    const key = optionKey(unit)
    unitById.set(unit.optionUnitId, unit)
    unitToOption.set(unit.optionUnitId, key)
    const list = unitsByOption.get(key)
    if (list) list.push(unit)
    else unitsByOption.set(key, [unit])
  }

  // An option is "person-priced" when it has at least one person unit
  // and no inventory unit (room/vehicle). That's the excursion shape:
  // line quantities derive from travelers, not from the stepper's
  // primary-unit count. Multi-day packages with both a room AND a
  // person-typed adult fee fall outside this set — the room
  // quantity passes through unchanged.
  const personPricedOptions = new Set<string>()
  for (const [key, optionUnits] of unitsByOption) {
    const hasPerson = optionUnits.some(isPersonUnit)
    const hasInventory = optionUnits.some(isInventoryUnit)
    if (hasPerson && !hasInventory) personPricedOptions.add(key)
  }

  const totalByOption = new Map<string, number>()
  for (const [unitId, quantity] of Object.entries(quantities)) {
    if (quantity <= 0) continue
    const key = unitToOption.get(unitId)
    if (!key) continue
    totalByOption.set(key, (totalByOption.get(key) ?? 0) + quantity)
  }

  const assignedForDefaulting = new Map<string, number>()
  for (const traveler of travelers) {
    if (!traveler.roomUnitId || traveler.roomUnitAssignmentSource === "none") continue
    const key = unitToOption.get(traveler.roomUnitId)
    if (!key) continue
    assignedForDefaulting.set(key, (assignedForDefaulting.get(key) ?? 0) + 1)
  }

  const optionDemand = Array.from(totalByOption.entries())
  const pickOptionWithDemand = () =>
    optionDemand.find(
      ([candidate, total]) => (assignedForDefaulting.get(candidate) ?? 0) < total,
    )?.[0] ?? optionDemand[0]?.[0]

  const resolveUnitForTraveler = (
    traveler: TTraveler,
    key: string,
  ): PricingAssignmentUnit | undefined =>
    pickUnitForAge(
      unitsByOption.get(key) ?? [],
      computeAgeYears(traveler.dateOfBirth, now),
      roleHintForTraveler(traveler),
    )

  const assignNextDemandUnit = (traveler: TTraveler): TTraveler => {
    const key = pickOptionWithDemand()
    if (!key)
      return { ...traveler, roomUnitId: null, roomUnitAssignmentSource: "auto" } as TTraveler
    const unit = resolveUnitForTraveler(traveler, key)
    if (!unit)
      return { ...traveler, roomUnitId: null, roomUnitAssignmentSource: "auto" } as TTraveler
    assignedForDefaulting.set(key, (assignedForDefaulting.get(key) ?? 0) + 1)
    return {
      ...traveler,
      roomUnitId: unit.optionUnitId,
      roomUnitAssignmentSource: "auto",
    } as TTraveler
  }

  const nextTravelers = travelers.map((traveler) => {
    const source = traveler.roomUnitAssignmentSource ?? "auto"
    if (source === "none") {
      return { ...traveler, roomUnitId: null, roomUnitAssignmentSource: "none" } as TTraveler
    }

    if (traveler.roomUnitId && unitById.has(traveler.roomUnitId)) {
      const key = unitToOption.get(traveler.roomUnitId)
      if (!key || source === "manual" || !personPricedOptions.has(key)) return traveler
      // Stale auto-assigned person-priced unit: re-derive against the
      // current bands so a child traveler who was placed on Adult by
      // an earlier pass moves to the right band on the next render.
      const unit = resolveUnitForTraveler(traveler, key)
      return unit && unit.optionUnitId !== traveler.roomUnitId
        ? ({
            ...traveler,
            roomUnitId: unit.optionUnitId,
            roomUnitAssignmentSource: "auto",
          } as TTraveler)
        : traveler
    }

    return assignNextDemandUnit(traveler)
  })

  const next: BookingDraftQuantities = {}
  const travelerIndexesByUnitId: Record<string, number[]> = {}

  // Accommodation quantities pass through unchanged — 1 DBL room
  // stays 1 line. Person-priced quantities are rebuilt from traveler
  // assignments below.
  for (const [unitId, quantity] of Object.entries(quantities)) {
    if (quantity <= 0) continue
    const key = unitToOption.get(unitId)
    if (!key || personPricedOptions.has(key)) continue
    next[unitId] = quantity
  }

  const assignedByOption = new Map<string, number>()
  for (const [index, traveler] of nextTravelers.entries()) {
    if (!traveler.roomUnitId || traveler.roomUnitAssignmentSource === "none") continue
    const key = unitToOption.get(traveler.roomUnitId)
    if (!key) continue
    const unitIndexes = travelerIndexesByUnitId[traveler.roomUnitId] ?? []
    unitIndexes.push(index)
    travelerIndexesByUnitId[traveler.roomUnitId] = unitIndexes
    if (personPricedOptions.has(key)) {
      next[traveler.roomUnitId] = (next[traveler.roomUnitId] ?? 0) + 1
      assignedByOption.set(key, (assignedByOption.get(key) ?? 0) + 1)
    }
  }

  // Person-priced residual: operator picked N seats but only added M
  // travelers (M < N) → put the leftover on the option's adult unit
  // so the line-item total matches the stepper.
  for (const [key, total] of totalByOption) {
    if (!personPricedOptions.has(key)) continue
    const assigned = assignedByOption.get(key) ?? 0
    const residual = Math.max(0, total - assigned)
    if (residual === 0) continue
    const adult = pickUnitForAge(unitsByOption.get(key) ?? [], null, "adult")
    if (!adult) continue
    next[adult.optionUnitId] = (next[adult.optionUnitId] ?? 0) + residual
  }

  return { quantities: next, travelers: nextTravelers, travelerIndexesByUnitId }
}

/**
 * Normalize per-person extras to charged traveler quantity and
 * stamp `travelerIndexes` + `clientLineKey` so the server can link
 * each extra line to the travelers it applies to via
 * `booking_item_travelers`.
 *
 * Per-person mode (`pricingMode === "per_person"` or
 * `pricedPerPerson === true`): quantity multiplied by travelerCount,
 * `travelerIndexes` set to all travelers (uniform applicability).
 * Non-per-person lines pass through with `clientLineKey` only.
 */
export function resolveBookingExtraLines<TLine extends ResolvableExtraLine>(options: {
  extraLines: readonly TLine[]
  travelerCount: number
}): TLine[] {
  const travelerIndexes = Array.from({ length: options.travelerCount }, (_, index) => index)
  return options.extraLines.map((line) => {
    const perPerson = line.pricingMode === "per_person" || line.pricedPerPerson === true
    if (!perPerson) {
      return {
        ...line,
        clientLineKey: line.clientLineKey ?? `extra:${line.productExtraId}`,
      }
    }
    const quantity = Math.max(1, options.travelerCount) * line.quantity
    return {
      ...line,
      clientLineKey: line.clientLineKey ?? `extra:${line.productExtraId}`,
      quantity,
      totalSellAmountCents:
        line.unitSellAmountCents == null
          ? line.totalSellAmountCents
          : line.unitSellAmountCents * quantity,
      travelerIndexes,
    }
  })
}

/**
 * Project a resolved draft's traveler list into the wire-format
 * `BookingCreateTravelerInput[]` shape the dialog submits. Derives
 * the `travelerCategory` from DOB / role and respects the
 * `roomUnitAssignmentSource === "none"` carve-out.
 */
export function travelersToRows(
  value: { travelers: readonly BookingDraftTraveler[] },
  now: Date = new Date(),
): Array<{
  personId: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  preferredLanguage: string | null
  participantType: "traveler"
  travelerCategory: "adult" | "child" | "infant" | null
  isPrimary: boolean
  roomUnitId: string | null
}> {
  return value.travelers.map((traveler) => ({
    personId: traveler.personId,
    firstName: traveler.firstName.trim(),
    lastName: traveler.lastName.trim(),
    email: traveler.email.trim() || null,
    phone: traveler.phone.trim() || null,
    preferredLanguage: traveler.preferredLanguage.trim() || null,
    participantType: "traveler",
    travelerCategory: deriveDraftPaxBand(traveler, now),
    isPrimary: traveler.role === "lead",
    roomUnitId: traveler.roomUnitAssignmentSource === "none" ? null : traveler.roomUnitId,
  }))
}
