import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  getStorefrontDeparture,
  getStorefrontDepartureItinerary,
  getStorefrontProductAvailabilitySummary,
  getStorefrontProductExtensions,
  listStorefrontProductDepartures,
  previewStorefrontDeparturePrice,
} from "./service-departures.js"
import {
  type StorefrontDepartureListQuery,
  type StorefrontDeparturePricePreviewInput,
  type StorefrontFormField,
  type StorefrontFormFieldInput,
  type StorefrontPaymentMethod,
  type StorefrontPaymentMethodCode,
  type StorefrontPaymentMethodInput,
  type StorefrontProductAvailabilitySummaryQuery,
  type StorefrontPromotionalOffer,
  type StorefrontSettings,
  type StorefrontSettingsInput,
  storefrontSettingsInputSchema,
  storefrontSettingsSchema,
} from "./validation.js"

export interface StorefrontServiceOptions {
  settings?: StorefrontSettingsInput
  resolveSettings?: (
    context: StorefrontRequestContext,
  ) => Promise<StorefrontSettingsInput> | StorefrontSettingsInput
  offers?: StorefrontOfferResolvers
  resolveOffers?: (
    context: StorefrontRequestContext,
  ) =>
    | Promise<StorefrontOfferResolvers | null | undefined>
    | StorefrontOfferResolvers
    | null
    | undefined
}

export interface StorefrontRequestContext {
  db?: PostgresJsDatabase
  env?: unknown
  context?: unknown
}

export interface StorefrontOfferResolvers {
  listApplicableOffers?: (
    input: {
      productId: string
      departureId?: string
      locale?: string
    } & StorefrontRequestContext,
  ) => Promise<StorefrontPromotionalOffer[]> | StorefrontPromotionalOffer[]
  getOfferBySlug?: (
    input: {
      slug: string
      locale?: string
    } & StorefrontRequestContext,
  ) => Promise<StorefrontPromotionalOffer | null> | StorefrontPromotionalOffer | null
}

const defaultPaymentLabels: Record<StorefrontPaymentMethodCode, string> = {
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  voucher: "Voucher",
  invoice: "Invoice",
}

function normalizeField(field: StorefrontFormFieldInput): StorefrontFormField {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    placeholder: field.placeholder ?? null,
    description: field.description ?? null,
    autocomplete: field.autocomplete ?? null,
    options: field.options,
  }
}

function normalizePaymentMethod(method: StorefrontPaymentMethodInput): StorefrontPaymentMethod {
  return {
    code: method.code,
    label: method.label ?? defaultPaymentLabels[method.code],
    description: method.description ?? null,
    enabled: method.enabled,
  }
}

export function resolveStorefrontSettings(input?: StorefrontSettingsInput): StorefrontSettings {
  const parsed = storefrontSettingsInputSchema.parse(input ?? {})

  return storefrontSettingsSchema.parse({
    branding: {
      logoUrl: parsed.branding?.logoUrl ?? null,
      supportedLanguages: parsed.branding?.supportedLanguages ?? [],
    },
    support: {
      email: parsed.support?.email ?? null,
      phone: parsed.support?.phone ?? null,
    },
    legal: {
      termsUrl: parsed.legal?.termsUrl ?? null,
      privacyUrl: parsed.legal?.privacyUrl ?? null,
      defaultContractTemplateId: parsed.legal?.defaultContractTemplateId ?? null,
    },
    forms: {
      billing: {
        fields: (parsed.forms?.billing?.fields ?? []).map(normalizeField),
      },
      travelers: {
        fields: (parsed.forms?.travelers?.fields ?? []).map(normalizeField),
      },
    },
    payment: {
      defaultMethod: parsed.payment?.defaultMethod ?? null,
      methods: (parsed.payment?.methods ?? []).map(normalizePaymentMethod),
    },
  })
}

export function createStorefrontService(options?: StorefrontServiceOptions) {
  const settings = resolveStorefrontSettings(options?.settings)

  async function resolveSettings(context: StorefrontRequestContext = {}) {
    if (!options?.resolveSettings) {
      return settings
    }

    return resolveStorefrontSettings(await options.resolveSettings(context))
  }

  async function resolveOffers(context: StorefrontRequestContext = {}) {
    return (await options?.resolveOffers?.(context)) ?? options?.offers
  }

  return {
    getSettings(): StorefrontSettings {
      return settings
    },
    resolveSettings,
    getDeparture(db: PostgresJsDatabase, departureId: string) {
      return getStorefrontDeparture(db, departureId)
    },
    listProductDepartures(
      db: PostgresJsDatabase,
      productId: string,
      query: StorefrontDepartureListQuery,
    ) {
      return listStorefrontProductDepartures(db, productId, query)
    },
    previewDeparturePrice(
      db: PostgresJsDatabase,
      departureId: string,
      input: StorefrontDeparturePricePreviewInput,
    ) {
      return previewStorefrontDeparturePrice(db, departureId, input)
    },
    getProductExtensions(db: PostgresJsDatabase, productId: string, optionId?: string) {
      return getStorefrontProductExtensions(db, productId, optionId)
    },
    getProductAvailabilitySummary(
      db: PostgresJsDatabase,
      productId: string,
      query: StorefrontProductAvailabilitySummaryQuery,
    ) {
      return getStorefrontProductAvailabilitySummary(db, productId, query)
    },
    getDepartureItinerary(
      db: PostgresJsDatabase,
      input: { departureId: string; productId: string },
    ) {
      return getStorefrontDepartureItinerary(db, input)
    },
    async listApplicableOffers(input: {
      productId: string
      departureId?: string
      locale?: string
      context?: StorefrontRequestContext
    }): Promise<StorefrontPromotionalOffer[]> {
      const { context, ...offerInput } = input
      const offers = await resolveOffers(context)?.then((resolvers) =>
        resolvers?.listApplicableOffers?.({ ...offerInput, ...(context ?? {}) }),
      )
      return offers ?? []
    },
    async getOfferBySlug(input: {
      slug: string
      locale?: string
      context?: StorefrontRequestContext
    }): Promise<StorefrontPromotionalOffer | null> {
      const { context, ...offerInput } = input
      return (
        (await resolveOffers(context)?.then((resolvers) =>
          resolvers?.getOfferBySlug?.({ ...offerInput, ...(context ?? {}) }),
        )) ?? null
      )
    },
  }
}
