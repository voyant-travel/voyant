import type {
  BookingCreateExtraLineInput,
  BookingCreateTravelerInput,
} from "@voyantjs/bookings-react"

export type BookingDraftTravelerRole = "lead" | "adult" | "child" | "infant"

export type BookingDraftUnitAssignmentSource = "auto" | "manual" | "none"

export interface BookingDraftTraveler {
  personId: string | null
  firstName: string
  lastName: string
  email: string
  phone: string
  preferredLanguage: string
  role: BookingDraftTravelerRole
  dateOfBirth: string | null
  /**
   * Legacy field name kept for compatibility with the current dialog.
   * For person-priced products it means the traveler's pricing unit; for
   * accommodation products it means the selected room/accommodation unit.
   */
  roomUnitId: string | null
  /**
   * Tracks operator intent around the legacy `roomUnitId` field.
   *
   * - auto: derived from product shape, DOB, role hints, and selected quantity
   * - manual: operator explicitly selected a category/room
   * - none: operator explicitly selected "No room"
   */
  roomUnitAssignmentSource?: BookingDraftUnitAssignmentSource
}

export interface BookingDraftUnit {
  optionId?: string | null
  optionUnitId: string
  unitName: string
  unitCode?: string | null
  minAge?: number | null
  maxAge?: number | null
  unitType?: "person" | "group" | "room" | "vehicle" | "service" | "other" | null
}

export type BookingDraftQuantities = Record<string, number>

export interface ResolvedBookingDraft<TTraveler extends BookingDraftTraveler> {
  quantities: BookingDraftQuantities
  travelers: TTraveler[]
  travelerIndexesByUnitId: Record<string, number[]>
}

export function computeDraftAgeYears(dob: string | null, now: Date = new Date()): number | null {
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

export function deriveDraftPaxBand(
  traveler: Pick<BookingDraftTraveler, "dateOfBirth" | "role">,
  now: Date = new Date(),
): "adult" | "child" | "infant" | null {
  const age = computeDraftAgeYears(traveler.dateOfBirth, now)
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
 * Pick the unit for a traveler pricing band. DOB-derived age wins over
 * role hints; role hints cover rows where the operator knows the category
 * but does not have a DOB yet.
 */
export function pickUnitForAge<TUnit extends BookingDraftUnit>(
  units: TUnit[],
  age: number | null,
  roleHint: "adult" | "child" | "infant" | null = null,
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

function optionKey(unit: BookingDraftUnit): string {
  return unit.optionId ?? unit.optionUnitId
}

function isPersonUnit(unit: BookingDraftUnit): boolean {
  return unit.unitType == null || unit.unitType === "person"
}

function isRoomUnit(unit: BookingDraftUnit): boolean {
  return unit.unitType === "room"
}

function roleHintForTraveler(traveler: BookingDraftTraveler): "adult" | "child" | "infant" | null {
  return traveler.role === "adult" || traveler.role === "child" || traveler.role === "infant"
    ? traveler.role
    : null
}

export function resolveBookingDraft<TTraveler extends BookingDraftTraveler>(options: {
  quantities: BookingDraftQuantities
  travelers: readonly TTraveler[]
  units: readonly BookingDraftUnit[]
  now?: Date
}): ResolvedBookingDraft<TTraveler> {
  const { quantities, travelers, now = new Date() } = options
  const units = [...options.units]
  if (units.length === 0) {
    return { quantities, travelers: [...travelers], travelerIndexesByUnitId: {} }
  }

  const unitsByOption = new Map<string, BookingDraftUnit[]>()
  const unitById = new Map<string, BookingDraftUnit>()
  const unitToOption = new Map<string, string>()
  for (const unit of units) {
    const key = optionKey(unit)
    unitById.set(unit.optionUnitId, unit)
    unitToOption.set(unit.optionUnitId, key)
    const list = unitsByOption.get(key)
    if (list) list.push(unit)
    else unitsByOption.set(key, [unit])
  }

  const personPricedOptions = new Set<string>()
  for (const [key, optionUnits] of unitsByOption) {
    const hasPerson = optionUnits.some(isPersonUnit)
    const hasRoom = optionUnits.some(isRoomUnit)
    if (hasPerson && !hasRoom) personPricedOptions.add(key)
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

  const resolveUnitForTraveler = (traveler: TTraveler, key: string): BookingDraftUnit | undefined =>
    pickUnitForAge(
      unitsByOption.get(key) ?? [],
      computeDraftAgeYears(traveler.dateOfBirth, now),
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

export function resolveBookingExtraLines(options: {
  extraLines: readonly BookingCreateExtraLineInput[]
  travelerCount: number
}): BookingCreateExtraLineInput[] {
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

export function travelersToRows(
  value: { travelers: readonly BookingDraftTraveler[] },
  now: Date = new Date(),
): BookingCreateTravelerInput[] {
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
