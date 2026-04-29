import { formatMessage, type PackageI18nValue } from "@voyantjs/i18n"

import type { RegistryLegalMessages } from "./messages"

export function formatRegistryLegalDate(
  i18n: PackageI18nValue<RegistryLegalMessages>,
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

export function formatRegistryLegalDateTime(
  i18n: PackageI18nValue<RegistryLegalMessages>,
  value: string | null | undefined,
): string {
  if (!value) {
    return i18n.messages.common.none
  }

  return i18n.formatDateTime(value)
}

export function formatRegistryLegalSummary(
  template: string,
  values: Record<string, string | number>,
) {
  return formatMessage(template, values)
}
