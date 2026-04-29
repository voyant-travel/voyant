import { formatMessage, type PackageI18nValue } from "@voyantjs/i18n"

import type { RegistryCrmMessages } from "./messages"

export function formatRegistryCrmMoney(
  i18n: PackageI18nValue<RegistryCrmMessages>,
  cents: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (cents == null) {
    return i18n.messages.common.none
  }

  const normalizedCurrency = currency ?? "USD"

  try {
    return i18n.formatCurrency(cents / 100, normalizedCurrency)
  } catch {
    return `${(cents / 100).toFixed(2)} ${normalizedCurrency}`
  }
}

export function formatRegistryCrmDate(
  i18n: PackageI18nValue<RegistryCrmMessages>,
  value: string | null | undefined,
): string {
  if (!value) {
    return i18n.messages.common.none
  }

  return i18n.formatDate(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatRegistryCrmRelative(
  i18n: PackageI18nValue<RegistryCrmMessages>,
  value: string | null | undefined,
): string {
  if (!value) {
    return i18n.messages.common.none
  }

  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days < 1) {
    return i18n.messages.common.today
  }

  if (days < 7) {
    return formatMessage(i18n.messages.common.relativeTime.daysAgo, { count: days })
  }

  if (days < 30) {
    return formatMessage(i18n.messages.common.relativeTime.weeksAgo, {
      count: Math.floor(days / 7),
    })
  }

  if (days < 365) {
    return formatMessage(i18n.messages.common.relativeTime.monthsAgo, {
      count: Math.floor(days / 30),
    })
  }

  return formatMessage(i18n.messages.common.relativeTime.yearsAgo, {
    count: Math.floor(days / 365),
  })
}
