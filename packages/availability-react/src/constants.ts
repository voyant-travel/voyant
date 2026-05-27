import type { AvailabilitySlotRow } from "./schemas.js"

export const NONE_VALUE = "__none__"

export const booleanOptions = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
] as const

export const slotStatusOptions = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "sold_out", label: "Sold Out" },
  { value: "cancelled", label: "Cancelled" },
] as const

export const slotStatusVariant: Record<
  AvailabilitySlotRow["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "default",
  closed: "secondary",
  sold_out: "destructive",
  cancelled: "outline",
}

export type SlotStatusTone = "success" | "warning" | "danger" | "neutral"

export const slotStatusTone: Record<AvailabilitySlotRow["status"], SlotStatusTone> = {
  open: "success",
  closed: "danger",
  sold_out: "danger",
  cancelled: "neutral",
}
