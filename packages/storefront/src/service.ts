import type { EventBus } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  bootstrapStorefrontBookingSession,
  type StorefrontBookingSessionBootstrapOptions,
} from "./service-booking-session-bootstrap.js"
import {
  getStorefrontDeparture,
  getStorefrontDepartureItinerary,
  getStorefrontProductAvailabilitySummary,
  getStorefrontProductExtensions,
  listStorefrontProductDepartures,
  previewStorefrontDeparturePrice,
} from "./service-departures.js"
import {
  createStorefrontLeadSignal,
  type StorefrontIntakeGuard,
  type StorefrontIntakeOptions,
  subscribeStorefrontNewsletter,
} from "./service-intake.js"
import { evaluateStorefrontTransportEligibility } from "./service-transport-eligibility.js"
import {
  type StorefrontBookingSessionBootstrapInput,
  type StorefrontDepartureListQuery,
  type StorefrontDeparturePricePreviewInput,
  type StorefrontFormField,
  type StorefrontFormFieldInput,
  type StorefrontLeadIntakeInput,
  type StorefrontNewsletterSubscribeInput,
  type StorefrontOfferApplyInput,
  type StorefrontOfferMutationResult,
  type StorefrontOfferRedeemInput,
  type StorefrontPaymentMethod,
  type StorefrontPaymentMethodCode,
  type StorefrontPaymentMethodInput,
  type StorefrontProductAvailabilitySummaryQuery,
  type StorefrontPromotionalOffer,
  type StorefrontSettings,
  type StorefrontSettingsInput,
  type StorefrontSettingsPatchInput,
  storefrontSettingsInputSchema,
  storefrontSettingsSchema,
} from "./validation.js"
import type {
  StorefrontTransportEligibilityInput,
  StorefrontTransportEligibilityResult,
  StorefrontTransportEligibilityRuleInput,
} from "./validation-transport-eligibility.js"

export interface StorefrontServiceOptions {
  settings?: StorefrontSettingsInput
  resolveSettings?: (
    context: StorefrontRequestContext,
  ) => Promise<StorefrontSettingsInput> | StorefrontSettingsInput
  updateSettings?: (
    input: StorefrontSettings,
    context: StorefrontRequestContext,
  ) =>
    | Promise<StorefrontSettingsInput | StorefrontSettings>
    | StorefrontSettingsInput
    | StorefrontSettings
  offers?: StorefrontOfferResolvers
  resolveOffers?: (
    context: StorefrontRequestContext,
  ) =>
    | Promise<StorefrontOfferResolvers | null | undefined>
    | StorefrontOfferResolvers
    | null
    | undefined
  transportEligibilityRules?: StorefrontTransportEligibilityRuleInput[]
  resolveTransportEligibilityRules?: (
    input: {
      departureId: string
      productId?: string | null
      travelStartsOn?: string | null
      travelEndsOn?: string | null
    } & StorefrontRequestContext,
  ) =>
    | Promise<StorefrontTransportEligibilityRuleInput[]>
    | StorefrontTransportEligibilityRuleInput[]
  intake?: StorefrontIntakeOptions
  bookingSessionBootstrap?: StorefrontBookingSessionBootstrapOptions
}

export interface StorefrontRequestContext {
  db?: PostgresJsDatabase
  eventBus?: EventBus
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
  applyOffer?: (
    input: {
      slug: string
      body: StorefrontOfferApplyInput
    } & StorefrontRequestContext,
  ) => Promise<StorefrontOfferMutationResult> | StorefrontOfferMutationResult
  redeemOffer?: (
    input: {
      body: StorefrontOfferRedeemInput
    } & StorefrontRequestContext,
  ) => Promise<StorefrontOfferMutationResult> | StorefrontOfferMutationResult
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

function normalizePaymentSchedule(
  schedule: NonNullable<NonNullable<StorefrontSettingsInput["payment"]>["defaultSchedule"]> | null,
) {
  if (!schedule) return null

  return {
    depositPercent: schedule.depositPercent ?? null,
    balanceDueDaysBeforeDeparture: schedule.balanceDueDaysBeforeDeparture ?? null,
  }
}

function normalizeBankTransfer(
  bankTransfer: NonNullable<NonNullable<StorefrontSettingsInput["payment"]>["bankTransfer"]> | null,
) {
  if (!bankTransfer) return null

  return {
    accountHolder: bankTransfer.accountHolder ?? null,
    bankName: bankTransfer.bankName ?? null,
    iban: bankTransfer.iban ?? null,
    bic: bankTransfer.bic ?? null,
    paymentReference: bankTransfer.paymentReference ?? null,
    instructions: bankTransfer.instructions ?? null,
  }
}

function mergePaymentSchedule(
  current: StorefrontSettings["payment"]["defaultSchedule"],
  patch: NonNullable<
    NonNullable<StorefrontSettingsPatchInput["payment"]>["defaultSchedule"]
  > | null,
) {
  if (patch === null) return null

  return {
    ...(current ?? {
      depositPercent: null,
      balanceDueDaysBeforeDeparture: null,
    }),
    ...patch,
  }
}

function mergeBankTransfer(
  current: StorefrontSettings["payment"]["bankTransfer"],
  patch: NonNullable<NonNullable<StorefrontSettingsPatchInput["payment"]>["bankTransfer"]> | null,
) {
  if (patch === null) return null

  return {
    ...(current ?? {
      accountHolder: null,
      bankName: null,
      iban: null,
      bic: null,
      paymentReference: null,
      instructions: null,
    }),
    ...patch,
  }
}

export function resolveStorefrontSettings(input?: StorefrontSettingsInput): StorefrontSettings {
  const parsed = storefrontSettingsInputSchema.parse(input ?? {})

  return storefrontSettingsSchema.parse({
    branding: {
      logoUrl: parsed.branding?.logoUrl ?? null,
      faviconUrl: parsed.branding?.faviconUrl ?? null,
      brandMarkUrl: parsed.branding?.brandMarkUrl ?? null,
      primaryColor: parsed.branding?.primaryColor ?? null,
      accentColor: parsed.branding?.accentColor ?? null,
      supportedLanguages: parsed.branding?.supportedLanguages ?? [],
    },
    support: {
      email: parsed.support?.email ?? null,
      phone: parsed.support?.phone ?? null,
      links: parsed.support?.links ?? [],
    },
    legal: {
      termsUrl: parsed.legal?.termsUrl ?? null,
      privacyUrl: parsed.legal?.privacyUrl ?? null,
      cancellationUrl: parsed.legal?.cancellationUrl ?? null,
      defaultContractTemplateId: parsed.legal?.defaultContractTemplateId ?? null,
    },
    localization: {
      defaultLocale: parsed.localization?.defaultLocale ?? null,
      currencyDisplay: parsed.localization?.currencyDisplay ?? "code",
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
      defaultSchedule: normalizePaymentSchedule(parsed.payment?.defaultSchedule ?? null),
      bankTransfer: normalizeBankTransfer(parsed.payment?.bankTransfer ?? null),
    },
  })
}

export function mergeStorefrontSettingsPatch(
  current: StorefrontSettings,
  patch: StorefrontSettingsPatchInput,
): StorefrontSettings {
  return resolveStorefrontSettings({
    branding: patch.branding ? { ...current.branding, ...patch.branding } : current.branding,
    support: patch.support ? { ...current.support, ...patch.support } : current.support,
    legal: patch.legal ? { ...current.legal, ...patch.legal } : current.legal,
    localization: patch.localization
      ? { ...current.localization, ...patch.localization }
      : current.localization,
    forms: patch.forms
      ? {
          billing: patch.forms.billing
            ? { ...current.forms.billing, ...patch.forms.billing }
            : current.forms.billing,
          travelers: patch.forms.travelers
            ? { ...current.forms.travelers, ...patch.forms.travelers }
            : current.forms.travelers,
        }
      : current.forms,
    payment: patch.payment
      ? {
          ...current.payment,
          ...patch.payment,
          defaultSchedule:
            patch.payment.defaultSchedule === undefined
              ? current.payment.defaultSchedule
              : mergePaymentSchedule(
                  current.payment.defaultSchedule,
                  patch.payment.defaultSchedule,
                ),
          bankTransfer:
            patch.payment.bankTransfer === undefined
              ? current.payment.bankTransfer
              : mergeBankTransfer(current.payment.bankTransfer, patch.payment.bankTransfer),
        }
      : current.payment,
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

  async function updateSettings(
    patch: StorefrontSettingsPatchInput,
    context: StorefrontRequestContext = {},
  ) {
    if (!options?.updateSettings) {
      return null
    }

    const current = await resolveSettings(context)
    const next = mergeStorefrontSettingsPatch(current, patch)
    return resolveStorefrontSettings(await options.updateSettings(next, context))
  }

  async function resolveOffers(context: StorefrontRequestContext = {}) {
    return (await options?.resolveOffers?.(context)) ?? options?.offers
  }

  async function resolveTransportEligibilityRules(
    input: {
      departureId: string
      productId?: string | null
      travelStartsOn?: string | null
      travelEndsOn?: string | null
    } & StorefrontRequestContext,
  ) {
    return (
      (await options?.resolveTransportEligibilityRules?.(input)) ??
      options?.transportEligibilityRules ??
      []
    )
  }

  async function checkIntakeGuard(
    input:
      | {
          kind: "lead"
          body: StorefrontLeadIntakeInput
          context: StorefrontRequestContext
        }
      | {
          kind: "newsletter"
          body: StorefrontNewsletterSubscribeInput
          context: StorefrontRequestContext
        },
  ) {
    return options?.intake?.guard?.(input)
  }

  return {
    getSettings(): StorefrontSettings {
      return settings
    },
    resolveSettings,
    updateSettings,
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
    async checkDepartureTransportEligibility(input: {
      departureId: string
      productId?: string | null
      body: StorefrontTransportEligibilityInput
      context?: StorefrontRequestContext
    }): Promise<StorefrontTransportEligibilityResult> {
      const { context, body, departureId } = input
      const needsDeparture =
        context?.db && (!input.productId || !body.travelStartsOn || !body.travelEndsOn)
      const departure =
        needsDeparture && context?.db ? await getStorefrontDeparture(context.db, departureId) : null
      const productId = input.productId ?? departure?.productId ?? null
      const travelStartsOn =
        body.travelStartsOn ?? departure?.dateLocal ?? departure?.startAt?.slice(0, 10) ?? null
      const travelEndsOn =
        body.travelEndsOn ?? departure?.endAt?.slice(0, 10) ?? departure?.dateLocal ?? null
      const rules = await resolveTransportEligibilityRules({
        ...(context ?? {}),
        departureId,
        productId,
        travelStartsOn,
        travelEndsOn,
      })

      return evaluateStorefrontTransportEligibility({
        departureId,
        productId,
        travelStartsOn,
        travelEndsOn,
        travelers: body.travelers,
        rules,
      })
    },
    async bootstrapBookingSession(
      context: StorefrontRequestContext & { db: PostgresJsDatabase },
      input: StorefrontBookingSessionBootstrapInput,
      userId?: string,
    ) {
      return bootstrapStorefrontBookingSession(
        context,
        input,
        options?.bookingSessionBootstrap,
        userId,
      )
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
    async applyOffer(input: {
      slug: string
      body: StorefrontOfferApplyInput
      context?: StorefrontRequestContext
    }): Promise<StorefrontOfferMutationResult | null> {
      const { context, ...offerInput } = input
      return (
        (await resolveOffers(context)?.then((resolvers) =>
          resolvers?.applyOffer?.({ ...offerInput, ...(context ?? {}) }),
        )) ?? null
      )
    },
    async redeemOffer(input: {
      body: StorefrontOfferRedeemInput
      context?: StorefrontRequestContext
    }): Promise<StorefrontOfferMutationResult | null> {
      const { context, ...offerInput } = input
      return (
        (await resolveOffers(context)?.then((resolvers) =>
          resolvers?.redeemOffer?.({ ...offerInput, ...(context ?? {}) }),
        )) ?? null
      )
    },
    checkIntakeGuard,
    createLead(input: { body: StorefrontLeadIntakeInput; context: StorefrontRequestContext }) {
      return createStorefrontLeadSignal(input)
    },
    subscribeNewsletter(input: {
      body: StorefrontNewsletterSubscribeInput
      context: StorefrontRequestContext
    }) {
      return subscribeStorefrontNewsletter({
        ...input,
        requestDoubleOptIn: options?.intake?.requestNewsletterDoubleOptIn,
      })
    },
  }
}

export type { StorefrontIntakeGuard, StorefrontIntakeOptions }
