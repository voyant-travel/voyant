"use client"

import type { AvailabilitySlotRecord } from "@voyantjs/availability-react"

import type { RegistryProductsMessages } from "./i18n/messages"

export const SLOT_STATUS_VALUES = ["open", "closed", "sold_out", "cancelled"] as const

export const slotStatusVariant: Record<
  AvailabilitySlotRecord["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "default",
  closed: "secondary",
  sold_out: "outline",
  cancelled: "destructive",
}

export function combineLocalToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00Z`).toISOString()
}

export function isoToLocalDate(iso: string): string {
  const date = new Date(iso)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isoToLocalTime(iso: string): string {
  const date = new Date(iso)
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

export function formatSlotDate(iso: string): string {
  return isoToLocalDate(iso)
}

export function formatSlotTime(iso: string): string {
  return isoToLocalTime(iso)
}

export function formatDuration(
  slot: AvailabilitySlotRecord,
  messages: RegistryProductsMessages["productAvailability"],
): string {
  if (slot.nights != null || slot.days != null) {
    const parts: string[] = []
    if (slot.days != null) {
      parts.push(
        `${slot.days} ${slot.days === 1 ? messages.durationUnits.day : messages.durationUnits.days}`,
      )
    }
    if (slot.nights != null) {
      parts.push(
        `${slot.nights} ${
          slot.nights === 1 ? messages.durationUnits.night : messages.durationUnits.nights
        }`,
      )
    }
    return parts.join(" / ")
  }

  if (!slot.endsAt) return "—"

  const start = new Date(slot.startsAt).getTime()
  const end = new Date(slot.endsAt).getTime()
  const diffMs = end - start
  if (diffMs <= 0) return "—"

  const hours = diffMs / 3_600_000
  if (hours < 24) {
    return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}${messages.durationUnits.hourSuffix}`
  }

  const nights = Math.round(
    (new Date(`${formatSlotDate(slot.endsAt)}T00:00:00Z`).getTime() -
      new Date(`${formatSlotDate(slot.startsAt)}T00:00:00Z`).getTime()) /
      86_400_000,
  )
  return `${nights} ${nights === 1 ? messages.durationUnits.night : messages.durationUnits.nights}`
}

export function formatCapacity(
  slot: AvailabilitySlotRecord,
  messages: RegistryProductsMessages["productAvailability"],
): string {
  if (slot.unlimited) return messages.unlimitedCapacity
  if (slot.initialPax == null) return "—"
  const remaining = slot.remainingPax ?? slot.initialPax
  return `${remaining} / ${slot.initialPax}`
}

export function getDefaultTimezone() {
  return typeof Intl !== "undefined"
    ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC") // i18n-literal-ok timezone fallback
    : "UTC" // i18n-literal-ok timezone fallback
}

export function getTimezoneOptions(current?: string) {
  const values =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC"]

  const unique = new Set<string>(["UTC", ...values])
  if (current) unique.add(current)
  return Array.from(unique).sort((left, right) => left.localeCompare(right))
}

export function toNullableNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function computeNights(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0
  const start = new Date(`${startDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  const diffDays = Math.round((end - start) / 86_400_000)
  return diffDays > 0 ? diffDays : 0
}
