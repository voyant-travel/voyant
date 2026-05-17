"use client"

import { type PersonRecord, usePeople, usePerson } from "@voyantjs/crm-react"
import { PersonForm } from "@voyantjs/crm-ui"
import {
  Button,
  Input,
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
import { Trash2, UserPlus } from "lucide-react"
import * as React from "react"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

export type TravelerRole = "lead" | "adult" | "child" | "infant"

const ALL_ROLES: TravelerRole[] = ["lead", "adult", "child", "infant"]

export interface TravelerEntry {
  personId: string | null
  firstName: string
  lastName: string
  email: string
  role: TravelerRole
  /** option_unit_id the traveler is assigned to (matches RoomsStepper units). */
  roomUnitId: string | null
}

export interface TravelerListValue {
  travelers: TravelerEntry[]
}

export const emptyTravelerListValue: TravelerListValue = { travelers: [] }

/** Factory for a blank row — `role` defaults to `adult` unless the list is empty. */
export function createBlankTraveler(role: TravelerRole = "adult"): TravelerEntry {
  return { personId: null, firstName: "", lastName: "", email: "", role, roomUnitId: null }
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

export interface TravelersSectionProps {
  value: TravelerListValue
  onChange: (value: TravelerListValue) => void
  /**
   * Rooms the operator has selected (from RoomsStepperSection + occupancy).
   * When provided, each traveler gets a room-assignment dropdown.
   */
  roomUnits?: RoomUnitOption[]
  billingPersonId?: string | null
  labels?: {
    heading?: string
    addTraveler?: string
    firstName?: string
    lastName?: string
    email?: string
    role?: string
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
    addBillingPerson?: string
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
  billingPersonId,
  labels,
}: TravelersSectionProps) {
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.travelersSection.labels, ...labels }
  const billingPerson = usePerson(billingPersonId ?? undefined, {
    enabled: Boolean(billingPersonId),
  })
  const roleLabels: Record<TravelerRole, string> = {
    lead: merged.roleLead,
    adult: merged.roleAdult,
    child: merged.roleChild,
    infant: merged.roleInfant,
  }

  const updateAt = (index: number, patch: Partial<TravelerEntry>) => {
    const next = value.travelers.map((traveler, i) =>
      i === index ? { ...traveler, ...patch } : traveler,
    )
    onChange({ travelers: next })
  }

  const removeAt = (index: number) => {
    onChange({ travelers: value.travelers.filter((_, i) => i !== index) })
  }

  const addRow = () => {
    // First traveler defaults to `lead` so the operator doesn't have to
    // remember to flip the role on the initial row.
    const role: TravelerRole = value.travelers.length === 0 ? "lead" : "adult"
    onChange({ travelers: [...value.travelers, createBlankTraveler(role)] })
  }

  const addBillingPerson = () => {
    if (!billingPerson.data) return
    const role: TravelerRole = value.travelers.length === 0 ? "lead" : "adult"
    onChange({
      travelers: [...value.travelers, createTravelerFromPerson(billingPerson.data, role)],
    })
  }

  const hasBillingPersonTraveler = Boolean(
    billingPersonId && value.travelers.some((traveler) => traveler.personId === billingPersonId),
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
                  })
                }
                onClear={() => updateAt(index, { personId: null })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={merged.firstName}
                  value={traveler.firstName}
                  onChange={(e) => updateAt(index, { firstName: e.target.value })}
                />
                <Input
                  placeholder={merged.lastName}
                  value={traveler.lastName}
                  onChange={(e) => updateAt(index, { lastName: e.target.value })}
                />
              </div>

              <Input
                type="email"
                placeholder={merged.email}
                value={traveler.email}
                onChange={(e) => updateAt(index, { email: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{merged.role}</Label>
                  <Select
                    value={traveler.role}
                    onValueChange={(v) => updateAt(index, { role: (v ?? "adult") as TravelerRole })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {roomUnits && roomUnits.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{merged.room}</Label>
                    <Select
                      value={traveler.roomUnitId ?? NO_ROOM}
                      onValueChange={(v) =>
                        updateAt(index, { roomUnitId: v === NO_ROOM ? null : (v ?? null) })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_ROOM}>{merged.noRoom}</SelectItem>
                        {roomUnits.map((unit) => (
                          <SelectItem
                            key={unit.unitId}
                            value={unit.unitId}
                            // Only disable other rooms at-capacity — the room the
                            // traveler is *already* in should stay selectable so
                            // re-renders don't strip the selection.
                            disabled={
                              unit.remainingCapacity <= 0 && traveler.roomUnitId !== unit.unitId
                            }
                          >
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() => setSheetOpen(true)}
        >
          <UserPlus className="mr-1 h-3.5 w-3.5" />
          {labels.createNewPerson}
        </Button>
      </div>
      <Combobox
        items={people.map((person) => person.id)}
        value={personId}
        inputValue={inputValue}
        autoHighlight
        itemToStringValue={(id) => formatPerson(peopleMap.get(id as string))}
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
            <SheetTitle>{labels.createPersonSheetTitle}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <PersonForm
              mode={{ kind: "create" }}
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
  return {
    personId: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email ?? "",
    role,
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
