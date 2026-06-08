/**
 * `BookingDraft` + V1 engine contract schemas — versioned payloads
 * the journey, hooks, route handlers, owned handlers and source
 * adapters all agree on.
 *
 * Per `docs/architecture/booking-journey-architecture.md` §4 + §8.5.
 *
 * Why versioned: today's `quoteEntity` accepts an open
 * `parameters?: Record<string, unknown>` and returns `PricingBasis`.
 * That works for the tracer but won't scale across verticals,
 * adapters, the composer, and the storefront. Phase B pins the
 * shapes as Zod schemas and lets adapters / handlers declare which
 * version they speak via capability flags. When V2 lands, V1 stays
 * callable for one full minor-version cycle of every vertical.
 */

import { z } from "zod"

// ─────────────────────────────────────────────────────────────────
// Pax bands & traveler entry
// ─────────────────────────────────────────────────────────────────

export const paxBandCodeSchema = z.enum(["adult", "child", "infant", "senior", "student", "other"])
export type PaxBandCode = z.infer<typeof paxBandCodeSchema>

export const travelerEntryV1 = z.object({
  /** Stable client-side row id — the wizard uses it to keep
   *  travelers stable across re-renders and to attach passengers
   *  to room units. Defaults to a fresh uuid when omitted. */
  rowId: z.string().min(1).optional(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  band: paxBandCodeSchema.default("adult"),
  dateOfBirth: z.string().optional(), // ISO yyyy-mm-dd
  /**
   * Open-shape document map populated according to the descriptor's
   * `travelerFields[]`. Carrier of plaintext PII while the journey
   * is open; the commit path encrypts via
   * `booking_traveler_travel_details` (per booking-journey
   * §0.7). Never persisted plaintext.
   */
  documents: z.record(z.string(), z.unknown()).optional(),
  preferredLanguage: z.string().max(35).optional(),
  specialRequests: z.string().optional(),
  isPrimary: z.boolean().optional(),
})
export type TravelerEntryV1 = z.infer<typeof travelerEntryV1>

// ─────────────────────────────────────────────────────────────────
// Sub-step descriptor schemas
// ─────────────────────────────────────────────────────────────────

export const paxBandSpecV1 = z.object({
  code: z.string(),
  label: z.string(),
  minAge: z.number().int().nonnegative().optional(),
  maxAge: z.number().int().nonnegative().optional(),
  minCount: z.number().int().nonnegative(),
  maxCount: z.number().int().nonnegative(),
})
export type PaxBandSpecV1 = z.infer<typeof paxBandSpecV1>

export const cabinCategoryOptionV1 = z.object({
  id: z.string(),
  code: z.string().optional(),
  name: z.string(),
  type: z.string().optional(),
  capacityMin: z.number().int().nonnegative().optional(),
  capacityMax: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
})

export const cabinNumberOptionV1 = z.object({
  id: z.string(),
  code: z.string().optional(),
  label: z.string(),
  capacity: z.number().int().nonnegative().optional(),
  hasAccessibilityFeatures: z.boolean().optional(),
})

export const productVariantUnitOptionV1 = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  unitType: z.string().nullable().optional(),
  minQuantity: z.number().int().nonnegative().nullable().optional(),
  maxQuantity: z.number().int().nonnegative().nullable().optional(),
})

export const productVariantOptionV1 = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  units: z.array(productVariantUnitOptionV1).optional(),
})

export const ratePlanOptionV1 = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  chargeFrequency: z.enum(["per_night", "per_stay"]).optional(),
  cancellationPolicy: z.string().nullable().optional(),
  inclusions: z.array(z.string()).optional(),
  currency: z.string().optional(),
})

export const roomOptionV1 = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  capacity: z.number().int().nonnegative().nullable().optional(),
  baseRateHint: z.number().nullable().optional(),
  ratePlans: z.array(ratePlanOptionV1).optional(),
})

export const extensionOptionV1 = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().nullable().optional(),
  side: z.enum(["pre", "post"]),
  nights: z.number().int().nonnegative().nullable().optional(),
  pricePerPersonHint: z.number().nullable().optional(),
})

export const addonOfferV1 = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  kind: z.enum(["extras", "excursions", "insurance"]),
  groupKey: z.string().nullable().optional(),
  pricingMode: z.string().nullable().optional(),
  unitAmountCents: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  pricedPerPerson: z.boolean().nullable().optional(),
  selectionType: z
    .enum(["optional", "required", "default_selected", "unavailable"])
    .nullable()
    .optional(),
  minQuantity: z.number().int().nonnegative().nullable().optional(),
  maxQuantity: z.number().int().nonnegative().nullable().optional(),
  defaultQuantity: z.number().int().nonnegative().nullable().optional(),
})

export const configureSubStepV1 = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("departure"), required: z.literal(true) }),
  z.object({ kind: z.literal("product-option"), options: z.array(productVariantOptionV1) }),
  z.object({ kind: z.literal("cabin-category"), categories: z.array(cabinCategoryOptionV1) }),
  z.object({
    kind: z.literal("cabin-number"),
    perCategory: z.record(z.string(), z.array(cabinNumberOptionV1)),
  }),
  z.object({
    kind: z.literal("date-range"),
    minNights: z.number().int().positive(),
    maxNights: z.number().int().positive(),
  }),
  z.object({ kind: z.literal("occupancy"), bands: z.array(paxBandSpecV1) }),
  z.object({
    kind: z.literal("air-arrangement"),
    required: z.boolean().optional(),
  }),
])

export const accommodationSubStepV1 = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rooms"),
    options: z.array(roomOptionV1),
    sharedRoomAllowed: z.boolean(),
  }),
  z.object({
    kind: z.literal("extensions"),
    options: z.array(extensionOptionV1),
    allowsPre: z.boolean(),
    allowsPost: z.boolean(),
  }),
])

export const addonGroupV1 = z.object({
  kind: z.enum(["extras", "excursions", "insurance"]),
  label: z.string(),
  groupBy: z.enum(["port", "day"]).optional(),
  perGuestSelection: z.boolean(),
  items: z.array(addonOfferV1),
})

export const travelerFieldRequirementV1 = z.object({
  key: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  appliesToBands: z.array(z.string()).optional(),
})

export const bookingFieldRequirementV1 = z.object({
  key: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean(),
  group: z.enum(["billing", "company", "preferences"]),
})

export const bookingDraftShapeV1 = z.object({
  showsConfigure: z.boolean(),
  showsBilling: z.boolean(),
  showsTravelers: z.boolean(),
  showsAccommodation: z.boolean(),
  showsAddons: z.boolean(),
  showsPayment: z.boolean(),
  showsReview: z.literal(true),
  configureSubSteps: z.array(configureSubStepV1).optional(),
  paxBands: z.array(paxBandSpecV1),
  paxBandsAllowedTotal: z.object({ min: z.number().int(), max: z.number().int() }),
  travelerFields: z.array(travelerFieldRequirementV1),
  bookingFields: z.array(bookingFieldRequirementV1),
  accommodation: z
    .object({
      roomOptions: z.array(roomOptionV1).optional(),
      sharedRoomAllowed: z.boolean(),
      subSteps: z.array(accommodationSubStepV1).optional(),
    })
    .optional(),
  addons: z
    .object({
      catalog: z.array(addonOfferV1).optional(),
      groups: z.array(addonGroupV1).optional(),
    })
    .optional(),
  paymentIntents: z.array(z.enum(["hold", "card", "bank_transfer", "ticket_on_credit", "inquiry"])),
})

// ─────────────────────────────────────────────────────────────────
// PricingBreakdown — richer than PricingBasis, carries lines + taxes
// ─────────────────────────────────────────────────────────────────

export const pricingLineV1 = z.object({
  kind: z.enum(["base", "addon", "accommodation", "supplement", "discount", "fee"]),
  label: z.string(),
  quantity: z.number().nonnegative().optional(),
  unitAmount: z.number().int(),
  totalAmount: z.number().int(),
  taxIncluded: z.boolean().optional(),
})

export const pricingTaxV1 = z.object({
  code: z.string(),
  label: z.string(),
  rate: z.number().nonnegative(),
  amount: z.number().int(),
  base: z.number().int(),
  includedInPrice: z.boolean().optional(),
  scope: z.enum(["included", "excluded", "withheld"]).optional(),
})

export const pricingBreakdownV1 = z.object({
  currency: z.string().length(3),
  lines: z.array(pricingLineV1),
  taxes: z.array(pricingTaxV1),
  subtotal: z.number().int(),
  taxTotal: z.number().int(),
  total: z.number().int(),
})

export const bookingPaymentScheduleV1 = z.object({
  scheduleType: z.enum(["deposit", "installment", "balance", "hold", "other"]),
  status: z.enum(["pending", "due", "paid", "waived", "cancelled", "expired"]),
  dueDate: z.string(),
  currency: z.string().length(3),
  amountCents: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
})

// ─────────────────────────────────────────────────────────────────
// Draft state — what survives across step transitions
// ─────────────────────────────────────────────────────────────────

export const bookingDraftV1 = z.object({
  // What's being booked — populated from the catalog row, never mutated.
  entity: z.object({
    module: z.string(),
    id: z.string(),
    sourceKind: z.string(),
    sourceConnectionId: z.string().optional(),
    sourceRef: z.string().optional(),
  }),

  // Step 1 — Configure
  configure: z
    .object({
      departureSlotId: z.string().optional(),
      departureDate: z.string().optional(), // ISO yyyy-MM-dd
      departureTime: z.string().optional(), // ISO HH:mm
      // Pax counts keyed by band code — `paxBandCodeSchema` lists the
      // canonical codes but the wizard learns the active bands off the
      // descriptor, so we accept any string key. Counts default to 0
      // when omitted.
      pax: z.record(z.string(), z.number().int().nonnegative()).default(() => ({})),
      variantId: z.string().optional(),
      optionSelections: z
        .array(
          z.object({
            optionId: z.string(),
            optionName: z.string().optional(),
            optionUnitId: z.string().optional(),
            optionUnitName: z.string().optional(),
            quantity: z.number().int().nonnegative(),
          }),
        )
        .optional(),
      cabinCategoryId: z.string().optional(),
      cabinNumberId: z.string().optional(),
      dateRange: z
        .object({
          checkIn: z.string(),
          checkOut: z.string(),
        })
        .optional(),
      /** Air-arrangement intent for cruises. Per
       *  booking-journey-architecture §7. Other verticals ignore. */
      airArrangement: z.enum(["cruise_line", "independent", "none"]).optional(),
    })
    .default(() => ({ pax: {} })),

  // Step 2 — Billing
  billing: z
    .object({
      buyerType: z.enum(["B2C", "B2B"]).default("B2C"),
      contact: z.object({
        firstName: z.string().default(""),
        lastName: z.string().default(""),
        email: z.string().default(""),
        phone: z.string().optional(),
      }),
      address: z
        .object({
          line1: z.string().optional(),
          line2: z.string().optional(),
          city: z.string().optional(),
          postal: z.string().optional(),
          country: z.string().optional(),
        })
        .default({}),
      company: z
        .object({
          name: z.string(),
          vatId: z.string().optional(),
          registrationNumber: z.string().optional(),
        })
        .optional(),
      saveAsDefault: z.boolean().optional(),
    })
    .default({
      buyerType: "B2C",
      contact: { firstName: "", lastName: "", email: "" },
      address: {},
    }),

  // Step 3 — Travelers
  travelers: z.array(travelerEntryV1).default([]),

  // Step 4 — Accommodation
  accommodation: z
    .object({
      rooms: z.array(
        z.object({
          optionUnitId: z.string(),
          quantity: z.number().int().min(1),
          /** Selected rate plan (accommodations). When the descriptor's
           *  `RoomOption.ratePlans` is non-empty, the journey
           *  requires this before the Accommodation step is
           *  considered complete. */
          ratePlanId: z.string().optional(),
        }),
      ),
      travelerAssignments: z.record(z.string(), z.string()).default({}),
      sharedRoom: z
        .object({
          mode: z.enum(["create", "join"]),
          groupId: z.string().optional(),
          label: z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  // Step 5 — Add-ons
  addons: z.array(z.object({ extraId: z.string(), quantity: z.number().int().min(1) })).default([]),

  // Step 6 — Payment
  payment: z
    .object({
      intent: z
        .enum(["hold", "card", "bank_transfer", "ticket_on_credit", "inquiry"])
        .default("hold"),
      schedule: z.unknown().optional(),
    })
    .default({ intent: "hold" }),

  paymentSchedules: z.array(bookingPaymentScheduleV1).optional(),
  documentGeneration: z
    .object({
      contractDocument: z.boolean().optional(),
      invoiceDocument: z.boolean().optional(),
      /** `"proforma"` issues a placeholder document; defaults to a final `"invoice"`. */
      invoiceType: z.enum(["invoice", "proforma"]).optional(),
    })
    .optional(),

  /**
   * Operator-only: when true, the booking-create commit suppresses
   * post-commit notifications (e.g. the confirmation email). Set on the
   * admin review step; the owned handler forwards it to booking-create.
   */
  suppressNotifications: z.boolean().optional(),

  /**
   * Operator-only manual price override (admin review step). The owned
   * handler sends `amountCents` as `confirmedSellAmountCents` (which wins
   * over the quote/promotion price), the quote total as
   * `catalogSellAmountCents`, and the reason — booking-create requires a
   * reason when the two differ.
   */
  priceOverride: z
    .object({
      amountCents: z.number().int().min(0),
      reason: z.string(),
    })
    .optional(),

  /**
   * Operator-applied gift / refund-credit voucher (admin review step).
   * `voucherId` + `amountCents` mirror finance's `voucherRedemptionInput`
   * exactly; the owned handler forwards them to booking-create, which
   * atomically redeems the voucher inside the create transaction after
   * re-checking status / expiry / balance. The UI validates the code via
   * `/v1/public/vouchers/validate` before writing this. Distinct from
   * `promotionCode` (a customer discount code) — see the note there.
   */
  voucherRedemption: z
    .object({
      voucherId: z.string().min(1),
      amountCents: z.number().int().min(1),
    })
    .optional(),

  /**
   * Customer-typed promotion code. Validated case-insensitively against
   * `promotional_offers.code` at quote time when the operator template
   * wires `evaluatePromotions` on `QuoteEntityDeps`. Surfaces as a
   * `code_*` `invalidReason` on the quote when the code is bad.
   *
   * Per docs/architecture/promotions-architecture.md §7.0 — renamed
   * from the original placeholder `voucher: { code }` to avoid
   * collision with the finance `vouchers` domain (gift / refund credit
   * instruments at `packages/finance/src/schema.ts:239`).
   */
  promotionCode: z.string().optional(),
  /**
   * Operator-only notes — never shown to the customer. Set on
   * admin-surface review steps (operator dashboard) and surfaced on
   * the booking detail's notes panel.
   */
  internalNotes: z.string().optional(),
  /**
   * Customer-facing notes — "anything we should know?" Free-text
   * the customer fills on the storefront review step. Stored on
   * the booking and visible to ops; treat as untrusted input.
   */
  customerNotes: z.string().optional(),

  // Engine-controlled — written when /quote returns
  quoteId: z.string().optional(),
  quoteExpiresAt: z.string().optional(),
})

export type BookingDraftV1 = z.infer<typeof bookingDraftV1>
export type BookingDraftShapeV1 = z.infer<typeof bookingDraftShapeV1>
export type PricingBreakdownV1 = z.infer<typeof pricingBreakdownV1>

// ─────────────────────────────────────────────────────────────────
// Engine request / response contracts
// ─────────────────────────────────────────────────────────────────

export const quoteScopeV1 = z.object({
  locale: z.string(),
  audience: z.enum(["staff", "customer", "partner", "supplier"]),
  market: z.string(),
  currency: z.string().optional(),
})

export const quoteRequestV1 = z.object({
  entityModule: z.string(),
  entityId: z.string(),
  sourceKind: z.string(),
  sourceConnectionId: z.string().optional(),
  sourceRef: z.string().optional(),
  scope: quoteScopeV1,
  draft: bookingDraftV1.optional(),
  ttlMs: z.number().int().positive().optional(),
})

export const quoteResponseV1 = z.object({
  quoteId: z.string(),
  quotedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  available: z.boolean(),
  invalidReason: z.string().optional(),
  shape: bookingDraftShapeV1.optional(),
  pricing: pricingBreakdownV1.optional(),
  upstreamPayload: z.record(z.string(), z.unknown()).optional(),
})

export const bookRequestV1 = z
  .object({
    quoteId: z.string().optional(),
    draftId: z.string().optional(),
    bookingId: z.string().optional(),
    party: z.record(z.string(), z.unknown()).optional(),
    paymentIntent: z
      .union([
        z.object({ type: z.literal("hold") }),
        z.object({ type: z.literal("card"), tokenizedCard: z.string() }),
        z.object({ type: z.literal("ticket_on_credit"), agencyAccount: z.string() }),
      ])
      .optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    /** Idempotency — same key in 24h returns the existing booking. */
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine((v) => v.quoteId || v.draftId, {
    message: "either quoteId or draftId must be provided",
  })

export const bookResponseV1 = z.object({
  bookingId: z.string(),
  orderRef: z.string(),
  status: z.enum(["held", "confirmed", "ticketed", "failed"]),
  snapshotId: z.string(),
  pricing: pricingBreakdownV1.optional(),
  upstreamPayload: z.record(z.string(), z.unknown()).optional(),
})

export type QuoteRequestV1 = z.infer<typeof quoteRequestV1>
export type QuoteResponseV1 = z.infer<typeof quoteResponseV1>
export type BookRequestV1 = z.infer<typeof bookRequestV1>
export type BookResponseV1 = z.infer<typeof bookResponseV1>

// ─────────────────────────────────────────────────────────────────
// Hold lifecycle as separate operations — earlier drafts buried
// hold inside reserve/cancel; making it explicit lets adapters
// expose extend semantics without faking a full reserve.
// ─────────────────────────────────────────────────────────────────

export const holdExtendRequestV1 = z.object({ holdToken: z.string() })
export const holdReleaseRequestV1 = z.object({ holdToken: z.string() })

export type HoldExtendRequestV1 = z.infer<typeof holdExtendRequestV1>
export type HoldReleaseRequestV1 = z.infer<typeof holdReleaseRequestV1>

/**
 * Capability flag a handler / adapter declares to opt into the V1
 * contracts above. The engine refuses to dispatch to a handler whose
 * declared version doesn't match the request.
 */
export const ENGINE_CONTRACT_V1 = "v1" as const
export type EngineContractVersion = typeof ENGINE_CONTRACT_V1
