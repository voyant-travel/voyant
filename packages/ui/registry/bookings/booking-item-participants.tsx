"use client"

import {
  type BookingPassengerRecord,
  useBookingItemParticipantMutation,
  useBookingItemParticipants,
  usePassengers,
} from "@voyantjs/bookings-react"
import { Plus, Trash2, UserCheck } from "lucide-react"
import * as React from "react"

import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { useRegistryBookingsMessagesOrDefault } from "./i18n"

const roles = [
  "traveler",
  "occupant",
  "primary_contact",
  "service_assignee",
  "beneficiary",
  "other",
] as const

export interface BookingItemParticipantsProps {
  bookingId: string
  itemId: string
}

export function BookingItemParticipants({ bookingId, itemId }: BookingItemParticipantsProps) {
  const { data: participantsData } = useBookingItemParticipants(bookingId, itemId)
  const { data: passengersData } = usePassengers(bookingId)
  const { add, remove } = useBookingItemParticipantMutation(bookingId, itemId)
  const messages = useRegistryBookingsMessagesOrDefault()

  const [selectedPassengerId, setSelectedPassengerId] = React.useState("")
  const [selectedRole, setSelectedRole] = React.useState<string>("traveler")

  const participants = participantsData?.data ?? []
  const passengers = passengersData?.data ?? []

  const assignedIds = new Set(participants.map((p) => p.participantId))
  const availablePassengers = passengers.filter((p) => !assignedIds.has(p.id))

  const passengerMap = new Map<string, BookingPassengerRecord>()
  for (const p of passengers) {
    passengerMap.set(p.id, p)
  }

  const handleAssign = () => {
    if (!selectedPassengerId) return
    add.mutate(
      { participantId: selectedPassengerId, role: selectedRole },
      {
        onSuccess: () => {
          setSelectedPassengerId("")
          setSelectedRole("traveler")
        },
      },
    )
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <UserCheck className="h-3.5 w-3.5" />
        {messages.bookingItemParticipants.title}
      </div>

      {participants.length === 0 ? (
        <p className="text-xs text-muted-foreground">{messages.bookingItemParticipants.empty}</p>
      ) : (
        <div className="space-y-1">
          {participants.map((link) => {
            const passenger = passengerMap.get(link.participantId)
            return (
              <div
                key={link.id}
                className="flex items-center justify-between rounded px-2 py-1 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>
                    {passenger
                      ? `${passenger.firstName} ${passenger.lastName}`
                      : link.participantId}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {messages.bookingItemParticipants.roleLabels[link.role]}
                  </Badge>
                  {link.isPrimary && (
                    <Badge variant="default" className="text-xs">
                      {messages.bookingItemParticipants.primaryBadge}
                    </Badge>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(messages.bookingItemParticipants.actions.removeConfirm)) {
                      remove.mutate(link.id)
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {availablePassengers.length > 0 && (
        <div className="flex items-end gap-2 border-t pt-3">
          <div className="flex-1">
            <Select
              value={selectedPassengerId}
              onValueChange={(v) => setSelectedPassengerId(v ?? "")}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue
                  placeholder={messages.bookingItemParticipants.selectPassengerPlaceholder}
                />
              </SelectTrigger>
              <SelectContent>
                {availablePassengers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v ?? "traveler")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {messages.bookingItemParticipants.roleLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={handleAssign}
            disabled={!selectedPassengerId || add.isPending}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {messages.bookingItemParticipants.actions.assign}
          </Button>
        </div>
      )}
    </div>
  )
}
