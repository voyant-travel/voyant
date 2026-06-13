import type { PackageI18nValue } from "@voyantjs/i18n"
import { formatMessage } from "@voyantjs/i18n"
import type { SlotOption } from "../index.js"
import type { ResourcesUiMessages } from "./messages.js"

export const RESOURCE_KIND_VALUES = [
  "guide",
  "vehicle",
  "room",
  "boat",
  "equipment",
  "other",
] as const

export function formatSelectionLabel(
  count: number,
  noun: { singular: string; plural: string },
  template: string,
) {
  return formatMessage(template, {
    count,
    noun: count === 1 ? noun.singular : noun.plural,
  })
}

export function formatSelectionSummary(count: number, template: string) {
  return formatMessage(template, { count })
}

export function formatResourceSlotLabel(
  slot: SlotOption,
  options: {
    template: string
    formatDate: PackageI18nValue<ResourcesUiMessages>["formatDate"]
  },
) {
  const time = slot.startsAt
    ? options.formatDate(slot.startsAt, { timeStyle: "short" })
    : slot.dateLocal
  return formatMessage(options.template, {
    date: slot.dateLocal,
    time,
  })
}

export function formatDateTimeOrFallback(
  value: string | null,
  options: {
    fallback: string
    formatDateTime: PackageI18nValue<ResourcesUiMessages>["formatDateTime"]
  },
) {
  return value ? options.formatDateTime(value) : options.fallback
}
