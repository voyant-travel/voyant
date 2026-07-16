import { adminAvailabilityMessages } from "@voyant-travel/i18n"
import type { AvailabilitySlotRow } from "./schemas.js"

export const NONE_VALUE = "__none__"

const labels = adminAvailabilityMessages.en.availability

export const booleanOptions = [
  { value: "true", label: labels.details.yes },
  { value: "false", label: labels.details.no },
] as const

export const slotStatusOptions = [
  { value: "open", label: labels.statusOpen },
  { value: "closed", label: labels.statusClosed },
  { value: "sold_out", label: labels.statusSoldOut },
  { value: "cancelled", label: labels.statusCancelled },
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
