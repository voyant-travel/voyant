import { formatMessage } from "@voyant-travel/i18n"

import type { PromotionsUiMessages } from "./i18n/messages.js"
import type {
  PromotionalOfferApplicationMode,
  PromotionalOfferListStatus,
  PromotionalOfferRecord,
  PromotionalOfferScope,
  PromotionalOfferScopeKind,
} from "./index.js"

export const DEFAULT_PAGE_SIZE = 25
export const ALL = "__all__"
export const TABLE_COLUMN_COUNT = 8

export const scopeKinds: PromotionalOfferScopeKind[] = [
  "global",
  "products",
  "categories",
  "destinations",
  "markets",
  "audiences",
  "fare_codes",
  "cabin_grades",
]

export const applicationModes: PromotionalOfferApplicationMode[] = ["auto", "code"]
export const statusFilters: PromotionalOfferListStatus[] = [
  "active",
  "scheduled",
  "expired",
  "archived",
]

export function summarizeScope(scope: PromotionalOfferScope, messages: PromotionsUiMessages) {
  const summary = messages.promotionsPage.summaries
  switch (scope.kind) {
    case "global":
      return summary.globalScope
    case "products":
      return formatMessage(summary.productsScope, {
        count: scope.productIds.length,
        noun:
          scope.productIds.length === 1
            ? summary.productNouns.singular
            : summary.productNouns.plural,
      })
    case "categories":
      return formatMessage(summary.categoriesScope, {
        count: scope.categoryIds.length,
        noun:
          scope.categoryIds.length === 1
            ? summary.categoryNouns.singular
            : summary.categoryNouns.plural,
      })
    case "destinations":
      return formatMessage(summary.destinationsScope, {
        count: scope.destinationIds.length,
        noun:
          scope.destinationIds.length === 1
            ? summary.destinationNouns.singular
            : summary.destinationNouns.plural,
      })
    case "markets":
      return formatMessage(summary.marketsScope, {
        markets: scope.marketIds.join(", "),
      })
    case "audiences":
      return formatMessage(summary.audiencesScope, {
        audiences: scope.audiences
          .map((audience) => messages.common.audienceLabels[audience])
          .join(", "),
      })
    case "fare_codes":
      return formatMessage(summary.fareCodesScope, {
        fareCodes: scope.fareCodes.join(", "),
      })
    case "cabin_grades":
      return formatMessage(summary.cabinGradesScope, {
        cabinGradeCodes: scope.cabinGradeCodes.join(", "),
      })
  }
}

export function summarizeDiscount(
  offer: PromotionalOfferRecord,
  messages: PromotionsUiMessages["promotionsPage"],
) {
  if (offer.discountType === "percentage") {
    return `${offer.discountPercent ?? messages.summaries.unknownPercentage}%`
  }
  const cents = offer.discountAmountCents ?? 0
  const currency = offer.currency ?? ""
  return `${(cents / 100).toFixed(2)} ${currency}`.trim()
}

export function summarizeValidity(
  from: string | null,
  until: string | null,
  messages: PromotionsUiMessages["promotionsPage"],
) {
  if (from == null && until == null) return messages.summaries.anytime
  const fmt = (iso: string) => iso.slice(0, 10)
  if (from == null) {
    return formatMessage(messages.summaries.until, {
      date: fmt(until ?? ""),
    })
  }
  if (until == null) {
    return formatMessage(messages.summaries.from, {
      date: fmt(from),
    })
  }
  return formatMessage(messages.summaries.range, {
    from: fmt(from),
    until: fmt(until),
  })
}

export function getOfferStatus(offer: PromotionalOfferRecord): PromotionalOfferListStatus {
  if (!offer.active) return "archived"
  const now = Date.now()
  if (offer.validFrom != null && new Date(offer.validFrom).getTime() > now) return "scheduled"
  if (offer.validUntil != null && new Date(offer.validUntil).getTime() < now) return "expired"
  return "active"
}

export function statusBadgeVariant(
  status: PromotionalOfferListStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default"
    case "scheduled":
      return "secondary"
    case "expired":
      return "destructive"
    case "archived":
      return "outline"
  }
}
