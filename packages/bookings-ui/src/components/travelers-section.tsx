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
  /** option_unit_id the traveler is assigned to (matches OptionUnitsStepper units). */
  roomUnitId: string | null
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
    roomUnitId: null,
  }
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
 * Derive the age-banded traveler role from DOB. Falls back to `adult`
 * when DOB is missing so partial entries still typecheck downstream.
 *
 * Thresholds:
 *   - infant: < 2
 *   - child:  2 – 17
 *   - adult:  18+
 */
export function deriveTravelerRoleFromDob(dob: string | null): TravelerRole {
  const age = computeAgeYears(dob)
  if (age == null) return "adult"
  if (age < 2) return "infant"
  if (age < 18) return "child"
  return "adult"
}

/**
 * Find the unit whose `[minAge, maxAge]` window contains the given
 * DOB-derived age. Returns the unit id, or null if no match (or DOB
 * unset). Person-typed units are preferred; everything else is
 * ignored. Caller falls back to a default unit when null.
 */
function matchUnitByDob(units: ReadonlyArray<RoomGroupUnit>, dob: string | null): string | null {
  if (!dob) return null
  const age = computeAgeYears(dob)
  if (age == null) return null
  const personUnits = units.filter((u) => u.unitType == null || u.unitType === "person")
  const match = personUnits.find(
    (u) => (u.minAge == null || age >= u.minAge) && (u.maxAge == null || age <= u.maxAge),
  )
  return match?.unitId ?? null
}

/**
 * The Room dropdown lists one item per option (keyed by the option's
 * primary/ADULT unit id), but a traveler's `roomUnitId` can point at any
 * age-banded unit within that option. Map the traveler's specific unit
 * back to the dropdown's primary key so the Select value matches an
 * existing item — otherwise base-ui falls back to rendering the raw id.
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

/**
 * When the operator changes the Room dropdown, preserve the traveler's
 * current category code (Adult/Child/Senior/…) in the destination option
 * if it offers a matching unit. Falls back to the destination's primary
 * unit when no match exists or the previous unit has no code.
 */
function pickUnitForRoomChange(
  currentUnitId: string | null,
  nextRoomPrimaryId: string,
  roomGroups: ReadonlyArray<RoomGroup> | undefined,
): string {
  if (!roomGroups) return nextRoomPrimaryId
  const nextGroup = roomGroups.find((g) => g.primaryUnitId === nextRoomPrimaryId)
  if (!nextGroup) return nextRoomPrimaryId
  if (!currentUnitId) return nextGroup.primaryUnitId
  const prevGroup = roomGroups.find(
    (g) => g.primaryUnitId === currentUnitId || g.units.some((u) => u.unitId === currentUnitId),
  )
  const prevUnit = prevGroup?.units.find((u) => u.unitId === currentUnitId)
  const prevCode = (prevUnit?.unitCode ?? "").toLowerCase()
  if (!prevCode) return nextGroup.primaryUnitId
  const sameCategory = nextGroup.units.find((u) => (u.unitCode ?? "").toLowerCase() === prevCode)
  return sameCategory?.unitId ?? nextGroup.primaryUnitId
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

  // Auto-pick a room with seats available so operators don't have to
  // hunt for the dropdown on every traveler — they can still override
  // manually via the Room select. Picks the first option (ordering
  // mirrors the upstream `roomUnits` array, which comes from the
  // stepper in catalog order). When `roomGroups` is wired and the
  // traveler has DOB, also pre-pick the matching age-banded unit
  // within that option so the Category buttons land on the right row.
  const pickRoomUnitIdForNewTraveler = (dateOfBirth: string | null = null): string | null => {
    if (!roomUnits || roomUnits.length === 0) return null
    const pickedRoom =
      roomUnits.find((unit) => unit.remainingCapacity > 0)?.unitId ?? roomUnits[0]?.unitId ?? null
    if (!pickedRoom || !roomGroups || roomGroups.length === 0) return pickedRoom
    const group = roomGroups.find(
      (g) => g.primaryUnitId === pickedRoom || g.units.some((u) => u.unitId === pickedRoom),
    )
    if (!group) return pickedRoom
    return matchUnitByDob(group.units, dateOfBirth) ?? group.primaryUnitId
  }

  const addRow = () => {
    // First traveler defaults to `lead` so the operator doesn't have to
    // remember to flip the role on the initial row.
    const role: TravelerRole = value.travelers.length === 0 ? "lead" : "adult"
    const blank = createBlankTraveler(role)
    onChange({
      travelers: [...value.travelers, { ...blank, roomUnitId: pickRoomUnitIdForNewTraveler(null) }],
    })
  }

  const addBillingPerson = () => {
    if (!billingPerson.data) return
    const role: TravelerRole = value.travelers.length === 0 ? "lead" : "adult"
    const traveler = createTravelerFromPerson(billingPerson.data, role)
    onChange({
      travelers: [
        ...value.travelers,
        { ...traveler, roomUnitId: pickRoomUnitIdForNewTraveler(traveler.dateOfBirth) },
      ],
    })
  }

  const addRelatedPersonTraveler = (person: PersonRecord) => {
    const role: TravelerRole = value.travelers.length === 0 ? "lead" : "adult"
    const traveler = createTravelerFromPerson(person, role)
    onChange({
      travelers: [
        ...value.travelers,
        { ...traveler, roomUnitId: pickRoomUnitIdForNewTraveler(traveler.dateOfBirth) },
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
                  onPickUnit={(unitId, nextRole) =>
                    updateAt(index, { roomUnitId: unitId, role: nextRole })
                  }
                />

                {roomUnits && roomUnits.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{merged.room}</Label>
                    <Select
                      items={roomSelectItems}
                      value={mapUnitIdToGroupPrimary(traveler.roomUnitId, roomGroups) ?? NO_ROOM}
                      onValueChange={(v) =>
                        updateAt(index, {
                          roomUnitId:
                            v === NO_ROOM || !v
                              ? null
                              : pickUnitForRoomChange(traveler.roomUnitId, v, roomGroups),
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
    roomUnitId: null,
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
  onPickUnit: (unitId: string | null, nextRole: TravelerRole) => void
}) {
  const group = React.useMemo<RoomGroup | undefined>(() => {
    if (!roomGroups || !traveler.roomUnitId) return undefined
    return roomGroups.find(
      (g) =>
        g.primaryUnitId === traveler.roomUnitId ||
        g.units.some((u) => u.unitId === traveler.roomUnitId),
    )
  }, [roomGroups, traveler.roomUnitId])

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
                  if (shouldUpdate) onPickUnit(traveler.roomUnitId, nextRole)
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
                if (shouldUpdate) onPickUnit(unit.unitId, nextRole)
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
