import type {
  AssignmentRoleHint,
  BookingDraftTraveler,
  PricingAssignmentUnit,
  TravelerRole,
} from "./types.js"

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
