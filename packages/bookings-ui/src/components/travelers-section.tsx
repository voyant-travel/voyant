"use client"

import {
  type PersonRecord,
  type PersonRelationshipRecord,
  usePeople,
  usePerson,
  usePersonRelationships,
} from "@voyantjs/crm-react"
import { PersonForm } from "@voyantjs/crm-ui"
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { Pencil, Trash2, UserPlus } from "lucide-react"
import * as React from "react"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import {
  getDynamicTravelerCategoryButtonState,
  getStaticTravelerCategoryButtonState,
} from "./traveler-category-buttons.js"

export type TravelerRole = "lead" | "adult" | "child" | "infant"
export type TravelerUnitAssignmentSource = "auto" | "manual" | "none"

export interface TravelerEntry {
  personId: string | null
  firstName: string
  lastName: string
  email: string
  /** Snapshotted from the linked person at pick time. Optional. */
  phone: string
  /** Snapshotted from the linked person at pick time. Optional. */
  preferredLanguage: string
  role: TravelerRole
  /** ISO `YYYY-MM-DD` date of birth. Drives age-derived unit assignment. */
  dateOfBirth: string | null
  /** option_unit_id of the person pricing tier this traveler is billed as. */
  pricingUnitId: string | null
  /** option_unit_id of the room/vehicle this traveler occupies, when applicable. */
  inventoryUnitId: string | null
  /** Operator intent for `pricingUnitId`; defaults to `auto` when omitted. */
  pricingUnitSource?: TravelerUnitAssignmentSource
  /** Operator intent for `inventoryUnitId`; defaults to `auto` when omitted. */
  inventoryUnitSource?: TravelerUnitAssignmentSource
}

export interface TravelerListValue {
  travelers: TravelerEntry[]
}

export const emptyTravelerListValue: TravelerListValue = { travelers: [] }

/** Factory for a blank row — `role` defaults to `adult` unless the list is empty. */
export function createBlankTraveler(role: TravelerRole = "adult"): TravelerEntry {
  return {
    personId: null,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preferredLanguage: "",
    role,
    dateOfBirth: null,
    pricingUnitId: null,
    inventoryUnitId: null,
    pricingUnitSource: "auto",
    inventoryUnitSource: "auto",
  }
}

// Re-export `computeAgeYears` from the canonical assignment module so
// existing consumers of `travelers-section`'s public surface keep
// working. The implementation lives in `@voyantjs/bookings/pricing-assignment`.
export { computeAgeYears } from "@voyantjs/bookings/pricing-assignment"

import {
  computeAgeYears as _computeAgeYears,
  matchUnitByDob as matchAssignmentUnitByDob,
  matchUnitByRoleHint as matchAssignmentUnitByRoleHint,
  type PricingAssignmentUnit,
} from "@voyantjs/bookings/pricing-assignment"

/**
 * Derive the age-banded traveler role from DOB. Falls back to `adult`
 * when DOB is missing so partial entries still typecheck downstream.
 *
 * Thresholds:
 *   - infant: < 2
 *   - child:  2 – 17
 *   - adult:  18+
 */
export function deriveTravelerRoleFromDob(dob: string | null): TravelerRole {
  const age = _computeAgeYears(dob)
  if (age == null) return "adult"
  if (age < 2) return "infant"
  if (age < 18) return "child"
  return "adult"
}

/**
 * Adapter from this file's `RoomGroupUnit` shape (UI-side, uses
 * `unitId`) to the canonical `PricingAssignmentUnit` shape (uses
 * `optionUnitId`). Phase 1 of voyantjs/voyant#1267 will collapse these
 * by renaming the UI shape.
 */
function roomGroupUnitsAsAssignmentUnits(
  units: ReadonlyArray<RoomGroupUnit>,
): PricingAssignmentUnit[] {
  return units.map((u) => ({
    optionId: null,
    optionUnitId: u.unitId,
    unitName: u.unitName,
    unitCode: u.unitCode,
    minAge: u.minAge,
    maxAge: u.maxAge,
    unitType: u.unitType,
  }))
}

function matchUnitByDob(units: ReadonlyArray<RoomGroupUnit>, dob: string | null): string | null {
  return matchAssignmentUnitByDob(roomGroupUnitsAsAssignmentUnits(units), dob)
}

function matchUnitByRoleHint(
  units: ReadonlyArray<RoomGroupUnit>,
  role: TravelerRole | null,
): string | null {
  return matchAssignmentUnitByRoleHint(roomGroupUnitsAsAssignmentUnits(units), role)
}

/**
 * The Room dropdown lists one item per inventory option. Map any unit
 * from the same option back to that option's inventory key so the
 * Select value matches an existing item.
 */
function mapUnitIdToGroupPrimary(
  unitId: string | null,
  roomGroups: ReadonlyArray<RoomGroup> | undefined,
): string | null {
  if (!unitId) return null
  if (!roomGroups) return unitId
  const group = roomGroups.find(
    (g) => g.primaryUnitId === unitId || g.units.some((u) => u.unitId === unitId),
  )
  return group?.primaryUnitId ?? unitId
}

export interface RoomUnitOption {
  unitId: string
  unitName: string
  /**
   * How many more travelers can be assigned to this unit. Decremented by
   * the parent based on the stepper's quantity × occupancy capacity minus
   * travelers already assigned to that unit.
   */
  remainingCapacity: number
}

/**
 * Per-option breakdown of the actual age-banded units the product
 * configures. Lets the row render dynamic category buttons (e.g.
 * Adult/Child/Senior for one product, Adult/Child/Infant for another)
 * rather than a hardcoded set.
 */
export interface RoomGroupUnit {
  unitId: string
  /** Short label — typically the unit's own name (Adult, Child, Senior). */
  unitName: string
  /** Stable code (ADULT, CHILD, SENIOR, INFANT, …) when configured. */
  unitCode: string | null
  minAge: number | null
  maxAge: number | null
  unitType: "person" | "group" | "room" | "vehicle" | "service" | "other" | null
}

export interface RoomGroup {
  /** option_id this group of units belongs to. */
  optionId: string
  /** Display name for the option (e.g. "Standard double"). */
  optionName: string
  /** Default unit when the option is first picked (typically the ADULT-coded row). */
  primaryUnitId: string
  units: RoomGroupUnit[]
}

export interface TravelersSectionProps {
  value: TravelerListValue
  onChange: (value: TravelerListValue) => void
  /**
   * Rooms the operator has selected (from OptionUnitsStepperSection + occupancy).
   * When provided, each traveler gets a room-assignment dropdown.
   */
  roomUnits?: RoomUnitOption[]
  /**
   * Per-option breakdown of all units the product configures. Drives
   * dynamic category buttons (Adult/Child/Senior or whatever the
   * product configures) and DOB-aware unit pre-selection on attach.
   * Required for category buttons to render.
   */
  roomGroups?: RoomGroup[]
  billingPersonId?: string | null
  labels?: {
    heading?: string
    addTraveler?: string
    firstName?: string
    lastName?: string
    email?: string
    role?: string
    category?: string
    dateOfBirth?: string
    roleLead?: string
    roleAdult?: string
    roleChild?: string
    roleInfant?: string
    room?: string
    noRoom?: string
    remove?: string
    empty?: string
    person?: string
    personSearchPlaceholder?: string
    personEmpty?: string
    createNewPerson?: string
    createPersonSheetTitle?: string
    editPerson?: string
    editPersonSheetTitle?: string
    addBillingPerson?: string
    relatedPeopleHeading?: string
    addRelatedPerson?: string
  }
}

const NO_ROOM = "__unassigned__"

/**
 * Traveler list for booking-create flows. Each row can point at an existing
 * CRM person, create a new CRM person, or carry manual name/email details,
 * plus role and optional room assignment.
 *
 * ### Parent contract
 *
 * At submit time, the parent:
 * 1. Inserts a `booking_travelers` row per traveler with `participantType`
 *    derived from the role (`lead` / `adult` → traveler; `child` / `infant`
 *    → traveler with travelerCategory set).
 * 2. Carries `personId` through when the traveler is tied to CRM, including
 *    when the payer is also traveling.
 * 3. Exactly one row should have `role: "lead"` — enforced at submit, not
 *    here. The UI lets the operator pick whichever layout they want, then
 *    the submit handler errors if the invariant isn't met.
 */
export function TravelersSection({
  value,
  onChange,
  roomUnits,
  roomGroups,
  billingPersonId,
  labels,
}: TravelersSectionProps) {
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.travelersSection.labels, ...labels }
  const billingPerson = usePerson(billingPersonId ?? undefined, {
    enabled: Boolean(billingPersonId),
  })
  const updateAt = (index: number, patch: Partial<TravelerEntry>) => {
    const next = value.travelers.map((traveler, i) =>
      i === index ? { ...traveler, ...patch } : traveler,
    )
    onChange({ travelers: next })
  }

  const removeAt = (index: number) => {
    onChange({ travelers: value.travelers.filter((_, i) => i !== index) })
  }

  const pickPricingUnitIdForTraveler = React.useCallback(
    (
      dateOfBirth: string | null = null,
      role: TravelerRole | null = null,
      preferredUnitId: string | null = null,
    ): string | null => {
      if (!roomGroups || roomGroups.length === 0) return null
      const group =
        (preferredUnitId
          ? roomGroups.find(
              (g) =>
                g.primaryUnitId === preferredUnitId ||
                g.units.some((u) => u.unitId === preferredUnitId),
            )
          : undefined) ?? roomGroups[0]
      if (!group) return null
      return (
        matchUnitByDob(group.units, dateOfBirth) ??
        matchUnitByRoleHint(group.units, role) ??
        group.units.find((unit) => unit.unitType == null || unit.unitType === "person")?.unitId ??
        null
      )
    },
    [roomGroups],
  )

  // Auto-pick a room with seats available so operators don't have to
  // hunt for the dropdown on every traveler — they can still override
  // manually via the Room select. Pricing is picked from the same
  // option when the product exposes person tiers.
  const pickAssignmentsForNewTraveler = React.useCallback(
    (
      dateOfBirth: string | null = null,
      role: TravelerRole | null = null,
    ): Pick<TravelerEntry, "pricingUnitId" | "inventoryUnitId"> => {
      if (!roomUnits || roomUnits.length === 0) {
        return { pricingUnitId: null, inventoryUnitId: null }
      }
      const pickedRoom =
        roomUnits.find((unit) => unit.remainingCapacity > 0)?.unitId ?? roomUnits[0]?.unitId ?? null
      if (!pickedRoom || !roomGroups || roomGroups.length === 0) {
        return { pricingUnitId: null, inventoryUnitId: pickedRoom }
      }
      const pricingUnitId = pickPricingUnitIdForTraveler(dateOfBirth, role, pickedRoom)
      return { pricingUnitId, inventoryUnitId: pickedRoom }
    },
    [roomUnits, roomGroups, pickPricingUnitIdForTraveler],
  )

  // Note: there is no hydration effect any more. Travelers attached
  // before the option-units queries resolve get null assignment ids
  // and `*UnitSource: "auto"`; the resolver in
  // `@voyantjs/bookings/pricing-assignment` re-derives them at every
  // preview/submit pass, and respects `"none"` (explicit No room) /
  // `"manual"` (operator click) when set. Operator intent is now
  // declarative on the row, not implicit in a one-shot effect.

  const addRow = () => {
    // First traveler defaults to `lead` so the operator doesn't have to
    // remember to flip the role on the initial row.
    const role: TravelerRole = value.travelers.length === 0 ? "lead" : "adult"
    const blank = createBlankTraveler(role)
    onChange({
      travelers: [
        ...value.travelers,
        {
          ...blank,
          ...pickAssignmentsForNewTraveler(null, role),
          pricingUnitSource: "auto",
          inventoryUnitSource: "auto",
        },
      ],
    })
  }

  const addBillingPerson = () => {
    if (!billingPerson.data) return
    const role: TravelerRole = value.travelers.length === 0 ? "lead" : "adult"
    const traveler = createTravelerFromPerson(billingPerson.data, role)
    onChange({
      travelers: [
        ...value.travelers,
        {
          ...traveler,
          ...pickAssignmentsForNewTraveler(traveler.dateOfBirth, role),
          pricingUnitSource: "auto",
          inventoryUnitSource: "auto",
        },
      ],
    })
  }

  const addRelatedPersonTraveler = (person: PersonRecord) => {
    const role: TravelerRole = value.travelers.length === 0 ? "lead" : "adult"
    const traveler = createTravelerFromPerson(person, role)
    onChange({
      travelers: [
        ...value.travelers,
        {
          ...traveler,
          ...pickAssignmentsForNewTraveler(traveler.dateOfBirth, role),
          pricingUnitSource: "auto",
          inventoryUnitSource: "auto",
        },
      ],
    })
  }

  const hasBillingPersonTraveler = Boolean(
    billingPersonId && value.travelers.some((traveler) => traveler.personId === billingPersonId),
  )

  // Relationships of the billing person — surfaced as one-click "add as
  // traveler" chips so the operator can populate family/companions
  // without searching for them in the picker.
  const relationshipsQuery = usePersonRelationships(billingPersonId ?? undefined, {
    enabled: Boolean(billingPersonId),
  })
  const alreadyAddedIds = React.useMemo(
    () => new Set(value.travelers.map((t) => t.personId).filter(Boolean) as string[]),
    [value.travelers],
  )
  const relatedPersonIds: { id: string; kind: PersonRelationshipRecord["kind"] }[] =
    React.useMemo(() => {
      if (!billingPersonId) return []
      const seen = new Set<string>()
      const out: { id: string; kind: PersonRelationshipRecord["kind"] }[] = []
      for (const rel of relationshipsQuery.data?.data ?? []) {
        const otherId = rel.fromPersonId === billingPersonId ? rel.toPersonId : rel.fromPersonId
        if (seen.has(otherId) || alreadyAddedIds.has(otherId)) continue
        seen.add(otherId)
        out.push({ id: otherId, kind: rel.kind })
      }
      return out
    }, [billingPersonId, relationshipsQuery.data?.data, alreadyAddedIds])

  // base-ui's Select reads labels via the `items` prop — without it,
  // <SelectValue /> falls back to the raw value (the unit id). Memoize
  // once for all rows so identity is stable across renders.
  const roomSelectItems = React.useMemo(
    () => [
      { label: merged.noRoom, value: NO_ROOM },
      ...(roomUnits ?? []).map((unit) => ({ label: unit.unitName, value: unit.unitId })),
    ],
    [roomUnits, merged.noRoom],
  )

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>{merged.heading}</Label>
        <Button type="button" size="sm" variant="ghost" onClick={addRow}>
          {merged.addTraveler}
        </Button>
      </div>
      {billingPersonId && !hasBillingPersonTraveler ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addBillingPerson}
            disabled={!billingPerson.data}
          >
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            {merged.addBillingPerson}
          </Button>
        </div>
      ) : null}
      {relatedPersonIds.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{merged.relatedPeopleHeading}</span>
          <div className="flex flex-wrap gap-1.5">
            {relatedPersonIds.map((rel) => (
              <RelatedPersonChip
                key={rel.id}
                personId={rel.id}
                kind={rel.kind}
                addLabel={merged.addRelatedPerson}
                onAdd={addRelatedPersonTraveler}
              />
            ))}
          </div>
        </div>
      ) : null}

      {value.travelers.length === 0 ? (
        <p className="text-xs text-muted-foreground">{merged.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.travelers.map((traveler, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: row identity is positional
              key={index}
              className="flex flex-col gap-2 rounded-md border p-2"
            >
              <TravelerPersonPicker
                personId={traveler.personId}
                labels={merged}
                pinnedPeople={billingPerson.data ? [billingPerson.data] : []}
                onSelect={(person) =>
                  updateAt(index, {
                    personId: person.id,
                    firstName: person.firstName,
                    lastName: person.lastName,
                    email: person.email ?? "",
                    phone: person.phone ?? "",
                    preferredLanguage: person.preferredLanguage ?? "",
                    dateOfBirth: person.dateOfBirth ?? null,
                    // Re-derive auto-owned unit assignments when the
                    // linked CRM person changes. Pricing and inventory
                    // stay independent: a manual room does not freeze
                    // DOB-driven pricing, and a manual category does
                    // not move the room.
                    ...(traveler.pricingUnitSource === "manual" ||
                    traveler.pricingUnitSource === "none"
                      ? {}
                      : {
                          pricingUnitId: pickPricingUnitIdForTraveler(
                            person.dateOfBirth ?? null,
                            traveler.role,
                            traveler.inventoryUnitId,
                          ),
                          pricingUnitSource: "auto" as const,
                        }),
                    ...(traveler.inventoryUnitSource === "manual" ||
                    traveler.inventoryUnitSource === "none"
                      ? {}
                      : {
                          inventoryUnitId: pickAssignmentsForNewTraveler(
                            person.dateOfBirth ?? null,
                            traveler.role,
                          ).inventoryUnitId,
                          inventoryUnitSource: "auto" as const,
                        }),
                  })
                }
                onClear={() =>
                  updateAt(index, {
                    personId: null,
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: "",
                    preferredLanguage: "",
                    dateOfBirth: null,
                    ...(traveler.pricingUnitSource === "manual" ||
                    traveler.pricingUnitSource === "none"
                      ? {}
                      : {
                          pricingUnitId: pickPricingUnitIdForTraveler(
                            null,
                            traveler.role,
                            traveler.inventoryUnitId,
                          ),
                          pricingUnitSource: "auto" as const,
                        }),
                    ...(traveler.inventoryUnitSource === "manual" ||
                    traveler.inventoryUnitSource === "none"
                      ? {}
                      : {
                          inventoryUnitId: pickAssignmentsForNewTraveler(null, traveler.role)
                            .inventoryUnitId,
                          inventoryUnitSource: "auto" as const,
                        }),
                  })
                }
              />

              <div className="grid grid-cols-2 gap-2">
                <TravelerCategoryButtons
                  traveler={traveler}
                  roomGroups={roomGroups}
                  fallbackLabels={{
                    category: merged.category,
                    adult: merged.roleAdult,
                    child: merged.roleChild,
                    infant: merged.roleInfant,
                  }}
                  onPickUnit={(unitId, nextRole, source) =>
                    updateAt(index, {
                      pricingUnitId: unitId,
                      role: nextRole,
                      // Only freeze as manual when the dynamic button
                      // actually picked a unit. Role-only clicks via
                      // the static fallback stay `auto` so the
                      // resolver can re-derive once real units load.
                      pricingUnitSource: source,
                    })
                  }
                />

                {roomUnits && roomUnits.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{merged.room}</Label>
                    <Select
                      items={roomSelectItems}
                      value={
                        mapUnitIdToGroupPrimary(traveler.inventoryUnitId, roomGroups) ?? NO_ROOM
                      }
                      onValueChange={(v) =>
                        updateAt(index, {
                          inventoryUnitId: v === NO_ROOM || !v ? null : v,
                          inventoryUnitSource: v === NO_ROOM || !v ? "none" : "manual",
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_ROOM}>{merged.noRoom}</SelectItem>
                        {roomUnits.map((unit) => (
                          <SelectItem key={unit.unitId} value={unit.unitId}>
                            {unit.unitName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-destructive"
                  onClick={() => removeAt(index)}
                  aria-label={merged.remove}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {merged.remove}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TravelerPersonPicker({
  personId,
  labels,
  pinnedPeople = [],
  onSelect,
  onClear,
}: {
  personId: string | null
  labels: NonNullable<TravelersSectionProps["labels"]>
  pinnedPeople?: PersonRecord[]
  onSelect: (person: PersonRecord) => void
  onClear: () => void
}) {
  const [search, setSearch] = React.useState("")
  const [inputValue, setInputValue] = React.useState("")
  // One Sheet serves both flows: create when there's no selected person,
  // edit when the operator clicks the Edit button on a selected one.
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const peopleQuery = usePeople({ search: search || undefined, limit: 20 })
  const selectedPersonQuery = usePerson(personId ?? undefined, { enabled: Boolean(personId) })
  const people = React.useMemo(() => {
    const map = new Map<string, PersonRecord>()
    for (const person of peopleQuery.data?.data ?? []) map.set(person.id, person)
    for (const person of pinnedPeople) map.set(person.id, person)
    if (selectedPersonQuery.data) map.set(selectedPersonQuery.data.id, selectedPersonQuery.data)
    return Array.from(map.values())
  }, [peopleQuery.data?.data, pinnedPeople, selectedPersonQuery.data])
  const peopleMap = React.useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  )
  const selectedLabel = personId ? formatPerson(peopleMap.get(personId)) : ""

  React.useEffect(() => {
    if (selectedLabel) setInputValue(selectedLabel)
  }, [selectedLabel])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{labels.person}</Label>
        <div className="flex items-center gap-1">
          {personId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              disabled={!selectedPersonQuery.data}
              onClick={() => {
                setSheetMode("edit")
                setSheetOpen(true)
              }}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {labels.editPerson}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => {
              setSheetMode("create")
              setSheetOpen(true)
            }}
          >
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            {labels.createNewPerson}
          </Button>
        </div>
      </div>
      <Combobox
        items={people.map((person) => person.id)}
        value={personId}
        inputValue={inputValue}
        autoHighlight
        // `itemToStringLabel` drives BOTH the filter pass and the
        // input display. Without it, base-ui falls back to the raw
        // value (a `pers_…` typeid), so typing "eliza" matches
        // nothing and the trigger shows the id instead of the name.
        itemToStringLabel={(id) => formatPerson(peopleMap.get(id as string)) || (id as string)}
        itemToStringValue={(id) => id as string}
        onInputValueChange={(next) => {
          setInputValue(next)
          setSearch(next)
          if (!next) onClear()
        }}
        onValueChange={(next) => {
          const nextPerson = peopleMap.get((next as string | null) ?? "")
          if (nextPerson) onSelect(nextPerson)
          setInputValue(nextPerson ? formatPerson(nextPerson) : "")
        }}
      >
        <ComboboxInput placeholder={labels.personSearchPlaceholder} showClear={!!personId} />
        <ComboboxContent>
          <ComboboxEmpty>{labels.personEmpty}</ComboboxEmpty>
          <ComboboxList>
            <ComboboxCollection>
              {(id) => {
                const person = peopleMap.get(id as string)
                if (!person) return null
                return (
                  <ComboboxItem key={person.id} value={person.id}>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{formatPersonName(person)}</span>
                      {person.email ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {person.email}
                        </span>
                      ) : null}
                    </div>
                  </ComboboxItem>
                )
              }}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === "edit" ? labels.editPersonSheetTitle : labels.createPersonSheetTitle}
            </SheetTitle>
          </SheetHeader>
          <SheetBody>
            <PersonForm
              mode={
                sheetMode === "edit" && selectedPersonQuery.data
                  ? { kind: "edit", person: selectedPersonQuery.data }
                  : { kind: "create" }
              }
              onCancel={() => setSheetOpen(false)}
              onSuccess={(saved) => {
                onSelect(saved)
                setInputValue(formatPerson(saved))
                setSheetOpen(false)
              }}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function createTravelerFromPerson(person: PersonRecord, role: TravelerRole): TravelerEntry {
  // DOB drives age-banded pricing — hydrate from the person record so
  // the operator doesn't have to re-enter it on every booking. The
  // caller's `role` still wins (e.g. "lead" on the first traveler) so
  // the booking-lead flag isn't clobbered by the age-derived category.
  const dateOfBirth = person.dateOfBirth ?? null
  const effectiveRole: TravelerRole =
    role === "lead" ? "lead" : deriveTravelerRoleFromDob(dateOfBirth)
  return {
    personId: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email ?? "",
    phone: person.phone ?? "",
    preferredLanguage: person.preferredLanguage ?? "",
    role: effectiveRole,
    dateOfBirth,
    pricingUnitId: null,
    inventoryUnitId: null,
    pricingUnitSource: "auto",
    inventoryUnitSource: "auto",
  }
}

function formatPersonName(person: PersonRecord | undefined): string {
  if (!person) return ""
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim()
}

function formatPerson(person: PersonRecord | undefined): string {
  if (!person) return ""
  const name = formatPersonName(person)
  return person.email ? `${name} · ${person.email}` : name
}

/**
 * Dynamic category-button group. Reads the product's actual
 * person-typed option_units (Adult/Child/Senior, Adult/Child/Infant,
 * Adult/Senior, etc) from `roomGroups` and renders one button per
 * unit in the traveler's currently-assigned option.
 *
 * Falls back to the old static Adult/Child/Infant buttons when the
 * parent hasn't wired `roomGroups` (during the brief window before a
 * product is selected, or in legacy callers that don't pass the prop).
 */
function TravelerCategoryButtons({
  traveler,
  roomGroups,
  fallbackLabels,
  onPickUnit,
}: {
  traveler: TravelerEntry
  roomGroups?: RoomGroup[]
  fallbackLabels: { category: string; adult: string; child: string; infant: string }
  /**
   * Called when the operator clicks a category button. `source`
   * signals whether the click selected a real unit (`"manual"` —
   * dynamic per-product button) or merely chose a role with no
   * actual unit pick (`"auto"` — static fallback before units load).
   * The wrapping handler uses `source` to decide whether to freeze
   * the current `pricingUnitId` as a manual choice.
   */
  onPickUnit: (unitId: string | null, nextRole: TravelerRole, source: "manual" | "auto") => void
}) {
  const group = React.useMemo<RoomGroup | undefined>(() => {
    if (!roomGroups) return undefined
    const assignedUnitId = traveler.inventoryUnitId ?? traveler.pricingUnitId
    if (!assignedUnitId) return undefined
    return roomGroups.find(
      (g) => g.primaryUnitId === assignedUnitId || g.units.some((u) => u.unitId === assignedUnitId),
    )
  }, [roomGroups, traveler.inventoryUnitId, traveler.pricingUnitId])

  // Surface only person-typed units (Adult, Child, Senior, Infant,
  // …). Vehicles / rooms / services aren't categories the operator
  // toggles on a per-traveler basis. If the option has only one
  // person-typed unit (e.g. a "per-person" tour with no age bands),
  // there's nothing to choose, so the buttons collapse.
  const categoryUnits = React.useMemo(() => {
    if (!group) return []
    return group.units.filter((u) => u.unitType == null || u.unitType === "person")
  }, [group])

  if (group && categoryUnits.length <= 1) {
    // Single person-typed unit — no category choice to make.
    return null
  }

  if (!group || categoryUnits.length === 0) {
    // Fallback to the static set so the row still renders before a
    // product/option is selected. Editing here writes the legacy
    // `role` field only; once roomGroups arrive the buttons re-render
    // and bind to actual unit ids.
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-xs">{fallbackLabels.category}</Label>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              ["adult", fallbackLabels.adult],
              ["child", fallbackLabels.child],
              ["infant", fallbackLabels.infant],
            ] as const
          ).map(([category, label]) => {
            const { active, nextRole, shouldUpdate } = getStaticTravelerCategoryButtonState(
              traveler,
              category,
            )
            return (
              <Button
                key={category}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => {
                  // Static fallback: operator chose a role, not a
                  // concrete unit. Pass `source: "auto"` so the
                  // resolver re-derives the unit instead of freezing
                  // a stale auto-assignment as manual.
                  if (shouldUpdate) onPickUnit(traveler.pricingUnitId, nextRole, "auto")
                }}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{fallbackLabels.category}</Label>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${categoryUnits.length}, minmax(0, 1fr))` }}
      >
        {categoryUnits.map((unit) => {
          const { active, nextRole, shouldUpdate } = getDynamicTravelerCategoryButtonState(
            traveler,
            unit,
          )
          return (
            <Button
              key={unit.unitId}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => {
                // Dynamic button: real unit pick, freeze as manual.
                if (shouldUpdate) onPickUnit(unit.unitId, nextRole, "manual")
              }}
              title={
                unit.minAge != null || unit.maxAge != null
                  ? `${unit.minAge ?? "0"}–${unit.maxAge ?? "∞"}`
                  : undefined
              }
            >
              {unit.unitName}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function RelatedPersonChip({
  personId,
  kind,
  addLabel,
  onAdd,
}: {
  personId: string
  kind: PersonRelationshipRecord["kind"]
  addLabel: string
  onAdd: (person: PersonRecord) => void
}) {
  const messages = useBookingsUiMessagesOrDefault()
  const kindLabels = messages.travelersSection.relationshipKindLabels
  const query = usePerson(personId)
  const person = query.data
  if (!person) return null
  const name = formatPersonName(person) || personId
  const kindLabel = kindLabels[kind as keyof typeof kindLabels] ?? kind
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 gap-1.5"
      onClick={() => onAdd(person)}
      aria-label={addLabel}
    >
      <UserPlus className="h-3.5 w-3.5" />
      <span className="text-xs">{name}</span>
      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {kindLabel}
      </span>
    </Button>
  )
}
