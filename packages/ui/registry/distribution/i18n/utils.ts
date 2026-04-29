import { formatMessage } from "@voyantjs/i18n"
import type { DistributionUiI18n } from "../../../../distribution-ui/src/index"
import type { RegistryDistributionEntity, RegistryDistributionMessages } from "./messages"

export function formatRegistryDistributionDate(
  i18n: DistributionUiI18n,
  value: string | null | undefined,
) {
  if (!value) {
    return i18n.messages.common.dateTimeFallback
  }

  return i18n.formatDate(value)
}

export function formatRegistryDistributionDateTime(
  i18n: DistributionUiI18n,
  value: string | null | undefined,
) {
  if (!value) {
    return i18n.messages.common.dateTimeFallback
  }

  return i18n.formatDateTime(value)
}

export function formatRegistryDistributionCount(
  messages: RegistryDistributionMessages,
  entity: RegistryDistributionEntity,
  count: number,
) {
  const label =
    count === 1 ? messages.common.entities[entity].one : messages.common.entities[entity].other
  return `${count} ${label}`
}

export function formatRegistryDistributionSummary(
  template: string,
  values: Record<string, string | number>,
) {
  return formatMessage(template, values)
}
