"use client"

import { useBookingGroups } from "@voyantjs/bookings-react"

import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/voyant-ui/components"

const GROUP_NONE = "__none__"

export type SharedRoomMode = "create" | "join"

export interface SharedRoomValue {
  enabled: boolean
  mode: SharedRoomMode
  /** Only meaningful in "join" mode. */
  groupId: string
}

export const emptySharedRoomValue: SharedRoomValue = {
  enabled: false,
  mode: "create",
  groupId: "",
}

export interface SharedRoomSectionProps {
  value: SharedRoomValue
  onChange: (value: SharedRoomValue) => void
  /**
   * The product context for fetching joinable groups. When unset, the join
   * dropdown is disabled even if the user toggles into join mode.
   */
  productId?: string
  enabled?: boolean
  labels?: {
    toggle?: string
    createMode?: string
    joinMode?: string
    selectPlaceholder?: string
    noGroups?: string
    createHint?: string
  }
}

const DEFAULT_LABELS = {
  toggle: "Link to a shared-room group",
  createMode: "Create new group",
  joinMode: "Join existing",
  selectPlaceholder: "Select a group...",
  noGroups: "No existing groups for this product",
  createHint: "A new group will be created with this booking as the primary member.",
} as const

/**
 * Shared-room (partaj) attachment section. Operators use it to either create a
 * new `booking_groups` row at booking-create time or join an existing group
 * that already has a primary booking.
 *
 * The section only handles the *selection* — the parent dialog owns the
 * create-group + add-member mutations because they fire *after* the booking
 * insert (we need the new booking id to attach).
 */
export function SharedRoomSection({
  value,
  onChange,
  productId,
  enabled = true,
  labels,
}: SharedRoomSectionProps) {
  const merged = { ...DEFAULT_LABELS, ...labels }

  const { data: groupsData } = useBookingGroups({
    productId: productId || undefined,
    limit: 50,
    enabled: enabled && value.enabled && value.mode === "join" && Boolean(productId),
  })
  const existingGroups = groupsData?.data ?? []

  const set = (patch: Partial<SharedRoomValue>) => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <input
          id="shared-room-toggle"
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        <Label htmlFor="shared-room-toggle" className="text-sm">
          {merged.toggle}
        </Label>
      </div>

      {value.enabled && (
        <div className="flex flex-col gap-2 pl-6">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={value.mode === "create" ? "default" : "ghost"}
              onClick={() => set({ mode: "create" })}
            >
              {merged.createMode}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={value.mode === "join" ? "default" : "ghost"}
              onClick={() => set({ mode: "join" })}
            >
              {merged.joinMode}
            </Button>
          </div>

          {value.mode === "join" && (
            <Select
              items={
                existingGroups.length === 0
                  ? [{ label: merged.noGroups, value: GROUP_NONE }]
                  : existingGroups.map((g) => ({ label: g.label, value: g.id }))
              }
              value={value.groupId || GROUP_NONE}
              onValueChange={(v) => set({ groupId: v === GROUP_NONE ? "" : (v ?? "") })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={merged.selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {existingGroups.length === 0 ? (
                  <SelectItem value={GROUP_NONE} disabled>
                    {merged.noGroups}
                  </SelectItem>
                ) : (
                  existingGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          {value.mode === "create" && (
            <p className="text-xs text-muted-foreground">{merged.createHint}</p>
          )}
        </div>
      )}
    </div>
  )
}
