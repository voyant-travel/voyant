"use client"

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Trash2 } from "lucide-react"

export type PassengerRole = "lead" | "adult" | "child" | "infant"

const ALL_ROLES: PassengerRole[] = ["lead", "adult", "child", "infant"]

export interface PassengerEntry {
  firstName: string
  lastName: string
  email: string
  role: PassengerRole
  /** option_unit_id the passenger is assigned to (matches RoomsStepper units). */
  roomUnitId: string | null
}

export interface PassengerListValue {
  passengers: PassengerEntry[]
}

export const emptyPassengerListValue: PassengerListValue = { passengers: [] }

/** Factory for a blank row — `role` defaults to `adult` unless the list is empty. */
export function createBlankPassenger(role: PassengerRole = "adult"): PassengerEntry {
  return { firstName: "", lastName: "", email: "", role, roomUnitId: null }
}

export interface RoomUnitOption {
  unitId: string
  unitName: string
  /**
   * How many more passengers can be assigned to this unit. Decremented by
   * the parent based on the stepper's quantity × occupancy capacity minus
   * passengers already assigned to that unit.
   */
  remainingCapacity: number
}

export interface PassengersSectionProps {
  value: PassengerListValue
  onChange: (value: PassengerListValue) => void
  /**
   * Rooms the operator has selected (from RoomsStepperSection + occupancy).
   * When provided, each passenger gets a room-assignment dropdown.
   */
  roomUnits?: RoomUnitOption[]
  labels?: {
    heading?: string
    addPassenger?: string
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
  }
}

const DEFAULT_LABELS = {
  heading: "Passengers",
  addPassenger: "Add passenger",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  role: "Role",
  roleLead: "Lead",
  roleAdult: "Adult",
  roleChild: "Child",
  roleInfant: "Infant",
  room: "Room",
  noRoom: "Unassigned",
  remove: "Remove passenger",
  empty: "No passengers yet. Add at least one.",
} as const

const NO_ROOM = "__unassigned__"

/**
 * Passenger list for booking-create flows. Each row carries name + optional
 * email + role + optional room assignment. Inline-create only for now —
 * operators who want to pick an existing CRM person can do so from the
 * booking detail page afterwards, consistent with the lead-person picker's
 * edit-after-create story.
 *
 * ### Parent contract
 *
 * At submit time, the parent:
 * 1. Creates a CRM person for each row that doesn't match an existing one
 *    (email match + name, or skip when the operator intentionally left
 *    email blank).
 * 2. Inserts a `booking_travelers` row per passenger with `participantType`
 *    derived from the role (`lead` / `adult` → traveler; `child` / `infant`
 *    → traveler with travelerCategory set).
 * 3. Exactly one row should have `role: "lead"` — enforced at submit, not
 *    here. The UI lets the operator pick whichever layout they want, then
 *    the submit handler errors if the invariant isn't met.
 */
export function PassengersSection({ value, onChange, roomUnits, labels }: PassengersSectionProps) {
  const merged = { ...DEFAULT_LABELS, ...labels }
  const roleLabels: Record<PassengerRole, string> = {
    lead: merged.roleLead,
    adult: merged.roleAdult,
    child: merged.roleChild,
    infant: merged.roleInfant,
  }

  const updateAt = (index: number, patch: Partial<PassengerEntry>) => {
    const next = value.passengers.map((p, i) => (i === index ? { ...p, ...patch } : p))
    onChange({ passengers: next })
  }

  const removeAt = (index: number) => {
    onChange({ passengers: value.passengers.filter((_, i) => i !== index) })
  }

  const addRow = () => {
    // First passenger defaults to `lead` so the operator doesn't have to
    // remember to flip the role on the initial row.
    const role: PassengerRole = value.passengers.length === 0 ? "lead" : "adult"
    onChange({ passengers: [...value.passengers, createBlankPassenger(role)] })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>{merged.heading}</Label>
        <Button type="button" size="sm" variant="ghost" onClick={addRow}>
          {merged.addPassenger}
        </Button>
      </div>

      {value.passengers.length === 0 ? (
        <p className="text-xs text-muted-foreground">{merged.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.passengers.map((passenger, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: row identity is positional
              key={index}
              className="flex flex-col gap-2 rounded-md border p-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={merged.firstName}
                  value={passenger.firstName}
                  onChange={(e) => updateAt(index, { firstName: e.target.value })}
                />
                <Input
                  placeholder={merged.lastName}
                  value={passenger.lastName}
                  onChange={(e) => updateAt(index, { lastName: e.target.value })}
                />
              </div>

              <Input
                type="email"
                placeholder={merged.email}
                value={passenger.email}
                onChange={(e) => updateAt(index, { email: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{merged.role}</Label>
                  <Select
                    value={passenger.role}
                    onValueChange={(v) =>
                      updateAt(index, { role: (v ?? "adult") as PassengerRole })
                    }
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
                      value={passenger.roomUnitId ?? NO_ROOM}
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
                            // passenger is *already* in should stay selectable so
                            // re-renders don't strip the selection.
                            disabled={
                              unit.remainingCapacity <= 0 && passenger.roomUnitId !== unit.unitId
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
