"use client"

import {
  type BookingItemTravelerRecord,
  type BookingTravelerRecord,
  useBookingItemTravelerMutation,
  useBookingItemTravelers,
  useTravelers,
} from "@voyantjs/bookings-react"
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Plus, Trash2, UserCheck } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

const roles = [
  "traveler",
  "occupant",
  "primary_contact",
  "service_assignee",
  "beneficiary",
  "other",
] as const

export interface BookingItemTravelersProps {
  bookingId: string
  itemId: string
}

function getRoleLabel(
  role: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["itemParticipants"],
) {
  switch (role) {
    case "traveler":
      return messages.roleTraveler
    case "occupant":
      return messages.roleOccupant
    case "primary_contact":
      return messages.rolePrimaryContact
    case "service_assignee":
      return messages.roleServiceAssignee
    case "beneficiary":
      return messages.roleBeneficiary
    case "other":
      return messages.roleOther
    default:
      return role.replace(/_/g, " ")
  }
}

export function BookingItemTravelers({ bookingId, itemId }: BookingItemTravelersProps) {
  const travelerMessages = useAdminMessages().bookings.detail.itemParticipants
  const { data: travelersLinksData } = useBookingItemTravelers(bookingId, itemId)
  const { data: travelersData } = useTravelers(bookingId)
  const { add, remove } = useBookingItemTravelerMutation(bookingId, itemId)

  const [selectedTravelerId, setSelectedTravelerId] = React.useState("")
  const [selectedRole, setSelectedRole] = React.useState<string>("traveler")

  const assignedTravelers = travelersLinksData?.data ?? []
  const travelers = travelersData?.data ?? []

  const assignedIds = new Set(assignedTravelers.map((link) => link.travelerId))
  const availableTravelers = travelers.filter((traveler) => !assignedIds.has(traveler.id))

  const travelerMap = new Map<string, BookingTravelerRecord>()
  for (const traveler of travelers) {
    travelerMap.set(traveler.id, traveler)
  }

  const handleAssign = () => {
    if (!selectedTravelerId) return
    add.mutate(
      { travelerId: selectedTravelerId, role: selectedRole },
      {
        onSuccess: () => {
          setSelectedTravelerId("")
          setSelectedRole("traveler")
        },
      },
    )
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <UserCheck className="h-3.5 w-3.5" />
        {travelerMessages.title}
      </div>

      {assignedTravelers.length === 0 ? (
        <p className="text-xs text-muted-foreground">{travelerMessages.empty}</p>
      ) : (
        <div className="space-y-1">
          {assignedTravelers.map((link: BookingItemTravelerRecord) => {
            const traveler = travelerMap.get(link.travelerId)
            return (
              <div
                key={link.id}
                className="flex items-center justify-between rounded px-2 py-1 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>
                    {traveler ? `${traveler.firstName} ${traveler.lastName}` : link.travelerId}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {getRoleLabel(link.role, travelerMessages)}
                  </Badge>
                  {link.isPrimary && (
                    <Badge variant="default" className="text-xs">
                      {travelerMessages.primaryBadge}
                    </Badge>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(travelerMessages.removeConfirm)) {
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

      {availableTravelers.length > 0 && (
        <div className="flex items-end gap-2 border-t pt-3">
          <div className="flex-1">
            <Select
              items={availableTravelers.map((traveler) => ({
                label: `${traveler.firstName} ${traveler.lastName}`,
                value: traveler.id,
              }))}
              value={selectedTravelerId}
              onValueChange={(v) => setSelectedTravelerId(v ?? "")}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder={travelerMessages.selectTravelerPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {availableTravelers.map((traveler) => (
                  <SelectItem key={traveler.id} value={traveler.id}>
                    {traveler.firstName} {traveler.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v ?? "traveler")}
              items={roles.map((r) => ({ label: r.replace("_", " "), value: r }))}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {getRoleLabel(r, travelerMessages)}
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
            disabled={!selectedTravelerId || add.isPending}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {travelerMessages.assignAction}
          </Button>
        </div>
      )}
    </div>
  )
}
