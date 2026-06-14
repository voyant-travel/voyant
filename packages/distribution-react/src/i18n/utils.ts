import { formatMessage } from "@voyant-travel/i18n"

import type { DistributionEntity, DistributionUiMessages } from "./messages.js"

export function formatDistributionCount(
  messages: DistributionUiMessages,
  entity: DistributionEntity,
  count: number,
) {
  const label =
    count === 1 ? messages.common.entities[entity].one : messages.common.entities[entity].other
  return `${count} ${label}`
}

export function formatDistributionSummary(
  template: string,
  values: Record<string, string | number>,
) {
  return formatMessage(template, values)
}
