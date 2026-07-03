import { formatMessage } from "@voyant-travel/i18n"
import type { PromotionsUiMessages } from "./i18n/messages.js"
import type {
  PromotionalOfferRecord,
  PromotionalOfferScope,
  PromotionInsertInput,
} from "./index.js"
import { promotionalOfferScopeSchema } from "./index.js"

export type ScopeKind = PromotionalOfferScope["kind"]

export const SCOPE_KINDS: ScopeKind[] = [
  "global",
  "products",
  "categories",
  "destinations",
  "markets",
  "audiences",
  "fare_codes",
  "cabin_grades",
]

export const AUDIENCE_OPTIONS: Array<"staff" | "customer" | "partner" | "supplier"> = [
  "staff",
  "customer",
  "partner",
  "supplier",
]

export interface PromotionFormState {
  name: string
  slug: string
  description: string
  discountType: "percentage" | "fixed_amount"
  discountPercent: string
  discountAmountCents: number | null
  currency: string
  scopeKind: ScopeKind
  scopeIds: string
  scopeAudiences: Array<"staff" | "customer" | "partner" | "supplier">
  minPax: string
  validFrom: string
  validUntil: string
  code: string
  stackable: boolean
  active: boolean
}

export function emptyPromotionForm(): PromotionFormState {
  return {
    name: "",
    slug: "",
    description: "",
    discountType: "percentage",
    discountPercent: "",
    discountAmountCents: null,
    currency: "USD",
    scopeKind: "global",
    scopeIds: "",
    scopeAudiences: ["customer"],
    minPax: "",
    validFrom: "",
    validUntil: "",
    code: "",
    stackable: false,
    active: true,
  }
}

export function offerToPromotionForm(offer: PromotionalOfferRecord): PromotionFormState {
  const base = emptyPromotionForm()
  base.name = offer.name
  base.slug = offer.slug
  base.description = offer.description ?? ""
  base.discountType = offer.discountType
  base.discountPercent = offer.discountPercent ?? ""
  base.discountAmountCents = offer.discountAmountCents ?? null
  base.currency = offer.currency ?? "USD"
  base.scopeKind = offer.scope.kind
  base.scopeIds = scopeIdsToString(offer.scope)
  base.scopeAudiences = offer.scope.kind === "audiences" ? [...offer.scope.audiences] : ["customer"]
  base.minPax = offer.conditions.minPax != null ? String(offer.conditions.minPax) : ""
  base.validFrom = offer.validFrom ? toDateTimePickerValue(offer.validFrom) : ""
  base.validUntil = offer.validUntil ? toDateTimePickerValue(offer.validUntil) : ""
  base.code = offer.code ?? ""
  base.stackable = offer.stackable
  base.active = offer.active
  return base
}

export function scopeIdsToString(scope: PromotionalOfferScope): string {
  switch (scope.kind) {
    case "products":
      return scope.productIds.join(", ")
    case "categories":
      return scope.categoryIds.join(", ")
    case "destinations":
      return scope.destinationIds.join(", ")
    case "markets":
      return scope.marketIds.join(", ")
    case "fare_codes":
      return scope.fareCodes.join(", ")
    case "cabin_grades":
      return scope.cabinGradeCodes.join(", ")
    default:
      return ""
  }
}

export function toDateTimePickerValue(iso: string): string {
  return iso.slice(0, 16)
}

export function parseScopeIds(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function scopeIdsToFormValue(ids: string[]): string {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).join(", ")
}

export function buildPromotionScope(state: PromotionFormState): PromotionalOfferScope {
  switch (state.scopeKind) {
    case "global":
      return { kind: "global" }
    case "products":
      return { kind: "products", productIds: parseScopeIds(state.scopeIds) }
    case "categories":
      return { kind: "categories", categoryIds: parseScopeIds(state.scopeIds) }
    case "destinations":
      return { kind: "destinations", destinationIds: parseScopeIds(state.scopeIds) }
    case "markets":
      return { kind: "markets", marketIds: parseScopeIds(state.scopeIds) }
    case "audiences":
      return { kind: "audiences", audiences: state.scopeAudiences }
    case "fare_codes":
      return { kind: "fare_codes", fareCodes: parseScopeIds(state.scopeIds) }
    case "cabin_grades":
      return { kind: "cabin_grades", cabinGradeCodes: parseScopeIds(state.scopeIds) }
  }
}

export function buildPromotionPayload(
  state: PromotionFormState,
  messages: PromotionsUiMessages["promotionDialog"],
  scopeLabel: string,
): PromotionInsertInput | { error: string } {
  const name = state.name.trim()
  const slug = state.slug.trim()
  const code = state.code.trim()
  const minPax = state.minPax.trim()

  if (!name) return { error: messages.validation.nameRequired }
  if (!slug) return { error: messages.validation.slugRequired }
  if (!/^[a-z0-9-]+$/.test(slug)) return { error: messages.validation.slugInvalid }
  if (code && !/^[A-Za-z0-9_-]+$/.test(code)) return { error: messages.validation.codeInvalid }

  const discountPercent = state.discountType === "percentage" ? Number(state.discountPercent) : null
  if (state.discountType === "percentage") {
    if (!state.discountPercent) return { error: messages.validation.discountPercentRequired }
    if (!Number.isFinite(discountPercent) || discountPercent == null || discountPercent <= 0) {
      return { error: messages.validation.discountPercentInvalid }
    }
    if (discountPercent > 100) return { error: messages.validation.discountPercentInvalid }
  }

  if (state.discountType === "fixed_amount") {
    if (state.discountAmountCents == null || state.discountAmountCents <= 0) {
      return { error: messages.validation.discountAmountRequired }
    }
    if (!state.currency.trim()) return { error: messages.validation.currencyRequired }
  }

  if (minPax && (!Number.isInteger(Number(minPax)) || Number(minPax) <= 0)) {
    return { error: messages.validation.minPaxInvalid }
  }

  const validFrom = parseOptionalDate(state.validFrom)
  const validUntil = parseOptionalDate(state.validUntil)
  if (validFrom === "invalid") return { error: messages.validation.validFromInvalid }
  if (validUntil === "invalid") return { error: messages.validation.validUntilInvalid }
  if (validFrom != null && validUntil != null && validFrom.getTime() >= validUntil.getTime()) {
    return { error: messages.validation.validRangeInvalid }
  }

  const scope = buildPromotionScope(state)
  const scopeResult = promotionalOfferScopeSchema.safeParse(scope)
  if (!scopeResult.success) {
    return {
      error: formatMessage(messages.validation.scopeIdsRequired, {
        scope: scopeLabel,
      }),
    }
  }

  const payload: PromotionInsertInput = {
    name,
    slug,
    description: state.description.trim() || null,
    discountType: state.discountType,
    discountPercent,
    discountAmountCents: state.discountType === "fixed_amount" ? state.discountAmountCents : null,
    currency: state.discountType === "fixed_amount" ? state.currency.trim().toUpperCase() : null,
    scope,
    conditions: minPax ? { minPax: Number(minPax) } : {},
    validFrom: validFrom ? validFrom.toISOString() : null,
    validUntil: validUntil ? validUntil.toISOString() : null,
    code: code || null,
    stackable: state.stackable,
    active: state.active,
  }
  return payload
}

function parseOptionalDate(value: string): Date | "invalid" | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed
}
