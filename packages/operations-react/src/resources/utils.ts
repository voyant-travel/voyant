import type { SlotOption } from "./schemas.js"

export function nullableString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed ? trimmed : null
}

export function nullableNumber(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed ? Number(trimmed) : null
}

export function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return ""
  return value.slice(0, 16)
}

export function toIsoDateTime(value: string | null | undefined) {
  if (!value) return null
  return new Date(value).toISOString()
}

export function formatDateTime(value: string | null) {
  return value ? value.replace("T", " ").slice(0, 16) : "-"
}

export function labelById(
  options: Array<{ id: string; name?: string; bookingNumber?: string }>,
  id: string | null,
) {
  if (!id) return "-"
  const match = options.find((option) => option.id === id)
  return match?.name ?? match?.bookingNumber ?? id
}

export function slotLabel(slot: SlotOption) {
  return `${slot.dateLocal} · ${formatDateTime(slot.startsAt)}`
}

export function formatSelectionLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}
