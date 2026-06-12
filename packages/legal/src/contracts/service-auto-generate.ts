// agent-quality: file-size exception -- owner: legal; existing service module stays co-located until a dedicated split preserves behavior and tests.
import { type ActionLedgerRequestContextValues, ledgerSensitiveRead } from "@voyantjs/action-ledger"
import {
  BOOKING_PII_READ_CAPABILITY,
  type BookingPiiService,
  bookingsService,
} from "@voyantjs/bookings"
import { bookingPiiAccessLog } from "@voyantjs/bookings/schema"
import { bookingPaymentSchedules, invoices, payments } from "@voyantjs/finance/schema"
import { and, asc, desc, eq, ne, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { ContractLifecycleHook } from "./lifecycle.js"
import { contractRecordsService } from "./service-contracts.js"
import type { ContractDocumentGenerator } from "./service-documents.js"
import { contractDocumentsService } from "./service-documents.js"
import { ContractSeriesAmbiguousError, contractSeriesService } from "./service-series.js"
import { renderTemplate } from "./service-shared.js"
import { contractTemplatesService } from "./service-templates.js"
import type { GenerateContractForBookingInput } from "./validation.js"

/**
 * Event shape emitted by `@voyantjs/bookings` on confirm. Duplicated here so
 * legal doesn't have to import the bookings service just for the interface —
 * the concrete `bookingsService` lookup happens inside the handler.
 */
export interface BookingConfirmedLikeEvent {
  bookingId: string
  bookingNumber: string
  actorId: string | null
}

/**
 * Variables passed to the contract template at render time. Consumers can
 * augment via `resolveVariables`; the built-in resolver supplies the fields
 * the default contract template expects.
 *
 * Mirrors the canonical Voyant contract surface so the same template body
 * renders identically at storefront preview time and at post-confirm
 * auto-generation time. Anything we can't fill from the persisted booking
 * row (acceptance fingerprint, operator info, line items breakdown,
 * vertical-specific schedule details) is emitted as an empty default — the
 * operator template's `resolveVariables` callback overrides them.
 */
export interface OperatorContextVariables {
  name: string
  legalName: string
  vatId: string
  registrationNumber: string
  address: string
  phone: string
  email: string
  website: string
  iban: string
  bank: string
  license: string
  licenseAuthority: string
  /** Human whose name appears on the operator-side signature line. */
  signatoryName: string
  /** Their role / title (e.g. "Managing Director"). */
  signatoryRole: string
}

export interface AcceptanceContextVariables {
  ipAddress: string
  userAgent: string
  acceptedAt: string
  marketingConsent: boolean
  templateSlug: string
  templateId: string
}

export interface ContractTravelerVariable {
  id: string
  index: number
  band: string
  participantType: string
  isLead: boolean
  isPrimary: boolean
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  dateOfBirth: string
  document: {
    type: string
    number: string
    country: string
    issuingAuthority: string
    issueDate: string
    expiryDate: string
  }
}

export interface ContractItemVariable {
  index: number
  kind: string
  description: string
  quantity: number
  unitAmountCents: number
  totalAmountCents: number
  currency: string
  taxIncluded: boolean
}

export interface DefaultContractVariables {
  // Top-level clocks
  today: string
  currentDate: string
  currentDateTime: string
  currentTime: string

  contract: {
    contractNumber: string
    /** Alias used by older templates: `{{ contract.number }}`. */
    number: string
    contractDate: string
    /** Alias used by templates that read `{{ contract.date }}`. */
    date: string
    issuedAt: string
    signedAt: string
    isManual: boolean
    series: string
    channel: string
    source: string
    status: string
  }

  booking: {
    bookingId: string
    bookingNumber: string
    /** Alias used by templates that read `{{ booking.number }}`. */
    number: string
    /** Alias used by templates that read `{{ booking.id }}`. */
    id: string
    status: string

    // Entity context
    entityModule: string
    entityId: string
    vertical: string
    productName: string
    productSubtitle: string
    destination: string

    // Pax — bands map keeps Voyant's flexible band model intact
    pax: number | null
    paxTotal: number
    paxAdult: number
    paxChild: number
    paxInfant: number
    paxBands: Record<string, number>

    // Trip dates (vertical-agnostic)
    travelDates: {
      start: string
      end: string
      durationNights: number
    }
    startDate: string | null
    endDate: string | null

    // Money — Voyant's sell vs cost split
    sellCurrency: string
    sellAmountCents: number | null
    sellSubtotalCents: number
    sellTaxAmountCents: number
    sellDiscountAmountCents: number
    costCurrency: string
    costAmountCents: number
    baseCurrency: string
    baseSellAmountCents: number
    marginPercent: number

    // Aliases used by older templates (`booking.currency`,
    // `booking.totalAmountCents`)
    currency: string
    totalAmountCents: number | null
    subtotalAmountCents: number
    taxAmountCents: number
    discountAmountCents: number

    // Settlement
    paidAmountCents: number
    /** Current remaining amount owed after completed payments / invoice balance. */
    amountDueCents: number
    balanceDueCents: number
    isPaidInFull: boolean

    // Gross scheduled installments from booking_payment_schedules. These are
    // payment-plan amounts, not net remaining balances; use amountDueCents /
    // balanceDueCents / isPaidInFull for current settlement state.
    depositAmountCents: number
    depositDueDate: string
    balanceAmountCents: number
    balanceDueDate: string

    // Trace of which cascade layer the active policy came from
    // ("operator_default" | "supplier" | "category" | "listing" |
    // "booking"). Useful for audit copy in the contract footer.
    paymentPolicy: {
      source: string
    }

    // Free-form summary of accommodation lines, e.g. "1× Double room".
    // Operators with structured cabin/room contracts can override via
    // `resolveVariables`.
    roomsSummary: string

    // Source provenance
    source: {
      kind: string
      type: string
      connectionId: string
      ref: string
      externalRef: string
      supplier: {
        id: string
        name: string
      }
    }

    // Notes
    internalNotes: string
    customerNotes: string
  }

  customer: {
    type: string
    firstName: string
    lastName: string
    fullName: string
    email: string
    phone: string
    dateOfBirth: string
    companyName: string
    vatId: string
    registrationNumber: string
    address: {
      line1: string
      line2: string
      city: string
      region: string
      postal: string
      country: string
    }
    document: {
      type: string
      number: string
      country: string
      issuingAuthority: string
      issueDate: string
      expiryDate: string
    }
  }

  leadTraveler: {
    id: string
    firstName: string
    lastName: string
    fullName: string
    email: string
    phone: string
  } | null

  travelers: ContractTravelerVariable[]
  /** Alias used by templates that read `{{ passengers }}`. */
  passengers: ContractTravelerVariable[]

  items: ContractItemVariable[]
  addons: ContractItemVariable[]

  product: {
    title: string
    subtitle: string
    destination: string
    module: string
    id: string
    vertical: string
    heroImageUrl: string
  }

  departureSlot: {
    slotId: string
    startAt: string
    endAt: string
    durationDays: number
    departureCity: string
  }
  sailing: {
    sailingId: string
    ship: string
    embarkationPort: string
    disembarkationPort: string
    airArrangement: string
    startDate: string
    endDate: string
    cabinCategoryId: string
    cabinNumberId: string
  }
  stay: {
    checkIn: string
    checkOut: string
    nights: number
    rooms: Array<{ optionUnitId: string; quantity: number; ratePlanId: string }>
    destination: string
  }

  payment: {
    intent: string
    method: string
    amountCents: number
    currency: string
    schedule: Array<{
      index: number
      type: string
      amountCents: number
      currency: string
      dueDate: string
      status: string
    }>
    capturedAt: string
    /** Alias for `capturedAt`, exposed for templates that prefer the
     *  `created_at` naming. */
    createdAt: string
    latestCompleted?: {
      method: string
      methodLabel: string
      date: string
    }
  }

  operator: OperatorContextVariables
  acceptance: AcceptanceContextVariables
}

/**
 * Hook point so consumers can extend (or replace) the template variables.
 * Receives the default payload plus the raw booking/travelers so the
 * consumer can fold in product/person/etc. lookups without re-fetching.
 */
export type ResolveContractVariablesFn = (context: {
  db: PostgresJsDatabase
  booking: NonNullable<Awaited<ReturnType<typeof bookingsService.getBookingById>>>
  travelers: Awaited<ReturnType<typeof bookingsService.listTravelers>>
  defaults: DefaultContractVariables
  /**
   * Runtime bindings (Cloudflare Worker `env` or Node `process.env`)
   * passed through from the auto-generate runtime. Use this to read
   * deploy-specific env vars like `DOCUMENTS_BASE_URL` for templates
   * that compose absolute resource URLs (logos, hosted fonts).
   *
   * `null` when the runtime didn't supply bindings — usually only in
   * tests; production code paths always pass them.
   */
  bindings?: Record<string, unknown> | null
}) => Promise<Record<string, unknown>> | Record<string, unknown>

export interface AutoGenerateContractOptions {
  enabled?: boolean
  /**
   * Slug of the contract template to use. The contract is created against
   * that template's `currentVersionId`. If the template has no current
   * version, the handler logs + bails.
   */
  templateSlug: string
  /**
   * Scope the contract defaults to when creating. Matches
   * `contractScopeEnum`; the default `"customer"` is right for the common
   * operator-issues-to-traveler case.
   */
  scope?: "customer" | "supplier" | "partner" | "channel" | "other"
  /**
   * When set, the contract tries to allocate a number from the matching
   * active series on issuance. Without it, the contract issues unnumbered.
   * @deprecated Prefer `seriesPrefixScope` — `name` has no unique
   * constraint, so this lookup throws if multiple active rows share the
   * name. `(prefix, scope)` is the natural key (partial-unique-indexed).
   */
  seriesName?: string
  /**
   * When set, resolves the active series via the `(prefix, scope)`
   * partial unique index. Takes precedence over `seriesName`.
   */
  seriesPrefixScope?: {
    prefix: string
    scope: "customer" | "supplier" | "partner" | "channel" | "other"
  }
  /**
   * Language code written onto the contract row. Used by the PDF
   * renderer to pick the right locale for date/currency filters.
   */
  language?: string
  /**
   * Optional variable extender — see `ResolveContractVariablesFn`.
   */
  resolveVariables?: ResolveContractVariablesFn
  /**
   * Dry-run mode used by the operator dashboard's "Add contract"
   * preview. Runs the same template lookup + variable build + render
   * pipeline as a full generate, but returns the rendered HTML without
   * persisting a contract row, allocating a series number, or asking
   * the PDF generator for bytes. Idempotency check is skipped so the
   * preview always reflects the current template + booking state.
   */
  previewMode?: boolean
}

export interface AutoGenerateContractRuntime {
  generator: ContractDocumentGenerator
  eventBus?: import("@voyantjs/core").EventBus
  lifecycleHooks?: readonly ContractLifecycleHook[]
  /**
   * Optional sensitive booking-traveler reader. When supplied, the default
   * resolver can include traveler DOB/document snapshots in the template bag.
   * When absent, those fields keep their empty-string fallbacks.
   */
  bookingPiiService?: BookingPiiService | null
  actionLedgerContext?: ActionLedgerRequestContextValues | null
  /**
   * Runtime bindings forwarded into `resolveVariables` so consumers
   * can read deploy-specific env vars (e.g. `DOCUMENTS_BASE_URL`)
   * without restructuring every auto-generate call site to know
   * about them.
   */
  bindings?: Record<string, unknown> | null
}

export type AutoGenerateContractResult =
  | { status: "ok"; contractId: string; attachmentId: string }
  | { status: "template_not_found" }
  | { status: "template_version_missing" }
  | { status: "booking_not_found" }
  | { status: "contract_create_failed" }
  | { status: "document_failed"; reason: string }
  | {
      status: "preview"
      html: string
      templateName: string
      templateLanguage: string
    }

export type GenerateContractForBookingResult =
  | AutoGenerateContractResult
  | { status: "series_not_found" }
  | { status: "series_ambiguous" }

/**
 * One-click admin path for a specific booking. It resolves the deployment's
 * default active template for the requested scope/channel/language and, by
 * default, requires a default active number series for that scope before
 * issuing the document. Deployments with only one active series keep the
 * legacy implicit-default behavior.
 */
export async function generateContractForBookingFromDefaults(
  db: PostgresJsDatabase,
  bookingId: string,
  input: GenerateContractForBookingInput,
  runtime: AutoGenerateContractRuntime,
  actorId: string | null = null,
): Promise<GenerateContractForBookingResult> {
  const template = await contractTemplatesService.getDefaultTemplate(db, {
    scope: input.scope,
    language: input.language,
    channelId: input.channelId ?? undefined,
    fallbackLanguages: input.fallbackLanguages,
  })
  if (!template) {
    return { status: "template_not_found" }
  }
  if (!template.currentVersionId) {
    return { status: "template_version_missing" }
  }

  const options: AutoGenerateContractOptions = {
    enabled: true,
    templateSlug: template.slug,
    scope: input.scope,
    language: input.language ?? template.language,
  }

  if (input.requireNumberSeries) {
    try {
      const series = await contractSeriesService.findDefaultActiveByScope(db, input.scope)
      if (!series) {
        return { status: "series_not_found" }
      }
      options.seriesPrefixScope = {
        prefix: series.prefix,
        scope: series.scope,
      }
    } catch (error) {
      if (error instanceof ContractSeriesAmbiguousError) {
        return { status: "series_ambiguous" }
      }
      throw error
    }
  }

  return autoGenerateContractForBooking(
    db,
    { bookingId, bookingNumber: "", actorId },
    options,
    runtime,
  )
}

/**
 * Core auto-generate handler. Fire this from a `booking.confirmed` subscriber.
 * On success, the booking now has an issued contract with an attachment
 * (the PDF / storage object produced by the configured generator) and a
 * `contract.document.generated` event has been emitted post-commit.
 *
 * Failure modes (all surfaced via the returned status):
 *  - `template_not_found`       — no active template matches the slug
 *  - `template_version_missing` — template exists but has no published version
 *  - `booking_not_found`        — booking disappeared between confirm + fire
 *  - `contract_create_failed`   — insert returned null
 *  - `document_<…>`             — pass-through of generateContractDocument statuses
 *
 * Callers (the subscriber wrapper) log these and move on — per the EventBus
 * contract, handler throws are swallowed anyway; returning a discriminated
 * status keeps tests honest.
 */
export async function autoGenerateContractForBooking(
  db: PostgresJsDatabase,
  event: BookingConfirmedLikeEvent,
  options: AutoGenerateContractOptions,
  runtime: AutoGenerateContractRuntime,
): Promise<AutoGenerateContractResult> {
  // Idempotency + storefront pre-create flow: if any contract for
  // this booking already exists, REUSE it.
  //
  //   - **Storefront pre-create**: at /checkout/start, the operator
  //     template creates a draft contract holding the acceptance
  //     metadata in `metadata.acceptance` (no rendered body yet —
  //     variables aren't fully resolved until booking.confirmed).
  //     This branch picks it up, fills in the variables we now know,
  //     and issues + generates the PDF — replacing the older
  //     "marker stashed in bookings.internal_notes" pattern.
  //
  //   - **Race**: two callers (subscriber + workflow step) collide on
  //     a confirmed booking. Whichever reaches generation first wins;
  //     the other sees the document already attached and returns ok.
  //
  //   - **Retry after failure**: PDF generation flaked, contract row
  //     still draft with no document. Re-attempt on the same row
  //     instead of creating duplicates.
  //
  // A booking should have at most one active contract per scope;
  // operators wanting a fresh one use the regenerate admin route.
  const scope = options.scope ?? "customer"
  const isPreview = options.previewMode === true
  // Preview always reflects the current template + booking state, so
  // skip the "existing contract → return its attachment" idempotency
  // branch. We still walk the rest of the pipeline (template lookup,
  // variable build, render).
  const existingContracts = isPreview
    ? { data: [] as Awaited<ReturnType<typeof contractRecordsService.listContracts>>["data"] }
    : await contractRecordsService.listContracts(db, {
        bookingId: event.bookingId,
        scope,
        limit: 1,
        offset: 0,
      })
  const existing = existingContracts.data[0]
  if (existing) {
    const attachments = await contractRecordsService.listAttachments(db, existing.id)
    const documentAttachment = attachments.find((a) => a.kind === "document")
    if (documentAttachment) {
      return {
        status: "ok",
        contractId: existing.id,
        attachmentId: documentAttachment.id,
      }
    }
    // Existing contract, no document. Fall through to build full
    // variables + update the contract row + generate the PDF. We
    // keep the draft's metadata.acceptance intact (don't overwrite)
    // so the storefront's acceptance fingerprint survives until the
    // signature row materializes.
  }

  // Resolve the template + its current version. Consumers configure the slug
  // once at module bootstrap; we look up on every fire so template body
  // edits are picked up without restart.
  const template = await contractTemplatesService.findTemplateBySlug(db, options.templateSlug)
  if (!template) {
    return { status: "template_not_found" }
  }
  if (!template.currentVersionId) {
    return { status: "template_version_missing" }
  }

  const booking = await bookingsService.getBookingById(db, event.bookingId)
  if (!booking) {
    return { status: "booking_not_found" }
  }

  const travelers = await bookingsService.listTravelers(db, event.bookingId)
  const travelerTravelDetails = await resolveTravelerTravelDetails(
    db,
    booking.id,
    travelers,
    runtime.bookingPiiService,
    event.actorId,
    runtime.actionLedgerContext,
  )
  const leadTraveler =
    travelers.find((t) => travelerTravelDetails.get(t.id)?.isLeadTraveler) ??
    travelers.find((t) => t.isPrimary) ??
    travelers.find((t) => t.participantType === "traveler") ??
    travelers[0] ??
    null
  const leadTravelerDetails = leadTraveler ? travelerTravelDetails.get(leadTraveler.id) : null
  const bookingItemContext = await resolveBookingItemContext(db, booking.id)

  const now = new Date()
  const todayIso = now.toISOString().slice(0, 10)
  const todayIsoDateTime = now.toISOString()
  const todayTime = todayIsoDateTime.slice(11, 19)

  const sellCurrency = booking.sellCurrency ?? ""
  const totalCents = booking.sellAmountCents ?? 0
  const startDate = booking.startDate ?? ""
  const endDate = booking.endDate ?? ""
  const durationNights = computeNights(startDate, endDate)
  const settlement = await resolveBookingSettlementVariables(db, booking.id, sellCurrency)
  const amountDueCents = computeAmountDueCents(settlement, totalCents)
  const isPaidInFull =
    amountDueCents <= 0 ||
    (settlement.balanceDueCents == null &&
      totalCents > 0 &&
      settlement.paidAmountCents >= totalCents)
  const paymentSchedule = await resolveBookingPaymentScheduleVariables(db, booking.id)
  const roomsSummary = deriveRoomsSummary(
    bookingItemContext.rawItems,
    bookingItemContext.roomOptionUnitIds,
  )

  const mappedTravelers: ContractTravelerVariable[] = travelers.map((t, i) => {
    const fullName = [t.firstName, t.lastName].filter(Boolean).join(" ").trim()
    const travelDetails = travelerTravelDetails.get(t.id)
    return {
      id: t.id,
      index: i + 1,
      band: t.participantType,
      participantType: t.participantType,
      isLead: leadTraveler?.id === t.id,
      isPrimary: t.isPrimary,
      firstName: t.firstName,
      lastName: t.lastName,
      fullName,
      email: t.email ?? "",
      phone: t.phone ?? "",
      dateOfBirth: travelDetails?.dateOfBirth ?? "",
      document: {
        type: travelDetails?.documentType ?? "",
        number: travelDetails?.documentNumber ?? "",
        country: travelDetails?.documentIssuingCountry ?? "",
        issuingAuthority: travelDetails?.documentIssuingAuthority ?? "",
        issueDate: "",
        expiryDate: travelDetails?.documentExpiry ?? "",
      },
    }
  })

  const customerFullName =
    [booking.contactFirstName, booking.contactLastName].filter(Boolean).join(" ").trim() ||
    (leadTraveler ? `${leadTraveler.firstName} ${leadTraveler.lastName}`.trim() : "")

  const defaults: DefaultContractVariables = {
    today: todayIso,
    currentDate: todayIso,
    currentDateTime: todayIsoDateTime,
    currentTime: todayTime,

    contract: {
      contractNumber: "",
      number: "",
      contractDate: todayIso,
      date: todayIso,
      issuedAt: todayIsoDateTime,
      signedAt: "",
      isManual: false,
      series: options.seriesName ?? "",
      channel: "",
      source: "",
      status: "draft",
    },

    booking: {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      number: booking.bookingNumber,
      id: booking.id,
      status: booking.status,

      entityModule: bookingItemContext.entityModule,
      entityId: bookingItemContext.entityId,
      vertical: bookingItemContext.vertical,
      productName: bookingItemContext.productTitle,
      productSubtitle: bookingItemContext.productSubtitle,
      destination: bookingItemContext.destination,

      pax: booking.pax,
      paxTotal: booking.pax ?? 0,
      paxAdult: 0,
      paxChild: 0,
      paxInfant: 0,
      paxBands: {},

      travelDates: {
        start: startDate,
        end: endDate,
        durationNights,
      },
      startDate: booking.startDate,
      endDate: booking.endDate,

      sellCurrency,
      sellAmountCents: booking.sellAmountCents ?? null,
      sellSubtotalCents: booking.sellAmountCents ?? 0,
      sellTaxAmountCents: 0,
      sellDiscountAmountCents: 0,
      costCurrency: "",
      costAmountCents: booking.costAmountCents ?? 0,
      baseCurrency: booking.baseCurrency ?? "",
      baseSellAmountCents: booking.baseSellAmountCents ?? 0,
      marginPercent: booking.marginPercent ?? 0,

      currency: sellCurrency,
      totalAmountCents: booking.sellAmountCents ?? null,
      subtotalAmountCents: booking.sellAmountCents ?? 0,
      taxAmountCents: 0,
      discountAmountCents: 0,

      paidAmountCents: settlement.paidAmountCents,
      amountDueCents,
      balanceDueCents: amountDueCents,
      isPaidInFull,

      depositAmountCents: paymentSchedule.depositAmountCents,
      depositDueDate: paymentSchedule.depositDueDate,
      balanceAmountCents: paymentSchedule.balanceAmountCents,
      balanceDueDate: paymentSchedule.balanceDueDate,
      paymentPolicy: {
        source: "operator_default",
      },

      roomsSummary,

      source: {
        kind: booking.sourceType ?? "",
        type: booking.sourceType ?? "",
        connectionId: "",
        ref: booking.externalBookingRef ?? "",
        externalRef: booking.externalBookingRef ?? "",
        supplier: { id: "", name: "" },
      },

      internalNotes: booking.internalNotes ?? "",
      customerNotes: "",
    },

    customer: {
      type: "B2C",
      firstName: booking.contactFirstName ?? "",
      lastName: booking.contactLastName ?? "",
      fullName: customerFullName,
      email: booking.contactEmail ?? "",
      phone: booking.contactPhone ?? "",
      dateOfBirth: leadTravelerDetails?.dateOfBirth ?? "",
      companyName: "",
      vatId: "",
      registrationNumber: "",
      address: {
        line1: booking.contactAddressLine1 ?? "",
        line2: booking.contactAddressLine2 ?? "",
        city: booking.contactCity ?? "",
        region: booking.contactRegion ?? "",
        postal: booking.contactPostalCode ?? "",
        country: booking.contactCountry ?? "",
      },
      document: {
        type: leadTravelerDetails?.documentType ?? "",
        number: leadTravelerDetails?.documentNumber ?? "",
        country: leadTravelerDetails?.documentIssuingCountry ?? "",
        issuingAuthority: leadTravelerDetails?.documentIssuingAuthority ?? "",
        issueDate: "",
        expiryDate: leadTravelerDetails?.documentExpiry ?? "",
      },
    },

    leadTraveler: leadTraveler
      ? {
          id: leadTraveler.id,
          firstName: leadTraveler.firstName,
          lastName: leadTraveler.lastName,
          fullName: [leadTraveler.firstName, leadTraveler.lastName]
            .filter(Boolean)
            .join(" ")
            .trim(),
          email: leadTraveler.email ?? "",
          phone: leadTraveler.phone ?? "",
        }
      : null,

    travelers: mappedTravelers,
    passengers: mappedTravelers,

    items: bookingItemContext.items,
    addons: [],

    product: {
      title: bookingItemContext.productTitle,
      subtitle: bookingItemContext.productSubtitle,
      destination: bookingItemContext.destination,
      module: bookingItemContext.entityModule,
      id: bookingItemContext.entityId,
      vertical: bookingItemContext.vertical,
      heroImageUrl: "",
    },

    departureSlot: {
      slotId: bookingItemContext.departureSlot.slotId,
      startAt: bookingItemContext.departureSlot.startAt || startDate,
      endAt: bookingItemContext.departureSlot.endAt || endDate,
      durationDays: bookingItemContext.departureSlot.durationDays ?? durationNights,
      departureCity: bookingItemContext.departureSlot.departureCity,
    },
    sailing: {
      sailingId: "",
      ship: "",
      embarkationPort: "",
      disembarkationPort: "",
      airArrangement: "",
      startDate: "",
      endDate: "",
      cabinCategoryId: "",
      cabinNumberId: "",
    },
    stay: {
      checkIn: "",
      checkOut: "",
      nights: durationNights,
      rooms: [],
      destination: "",
    },

    payment: {
      intent: "",
      method: settlement.latestCompleted?.methodLabel ?? "",
      amountCents: totalCents,
      currency: sellCurrency,
      schedule: paymentSchedule.entries,
      capturedAt: settlement.latestCompleted?.date ?? "",
      createdAt: settlement.latestCompleted?.date ?? "",
      latestCompleted: settlement.latestCompleted,
    },

    operator: {
      name: "",
      legalName: "",
      vatId: "",
      registrationNumber: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      iban: "",
      bank: "",
      license: "",
      licenseAuthority: "",
      signatoryName: "",
      signatoryRole: "",
    },

    acceptance: {
      ipAddress: "",
      userAgent: "",
      acceptedAt: "",
      marketingConsent: false,
      templateSlug: options.templateSlug,
      templateId: template.id,
    },
  }

  const variables = options.resolveVariables
    ? await options.resolveVariables({
        db,
        booking,
        travelers,
        defaults,
        bindings: runtime.bindings ?? null,
      })
    : defaultVariablesToRecord(defaults)

  // Preview branch: render the template body with the freshly-resolved
  // variables and return the HTML. We assume `html` format (matches the
  // contract templates the operator ships). No row gets created, no
  // series number is allocated, no PDF bytes are produced.
  if (isPreview) {
    const previewVersion = await contractTemplatesService.getTemplateVersionById(
      db,
      template.currentVersionId,
    )
    if (!previewVersion) {
      return { status: "template_version_missing" }
    }
    const html = renderTemplate(previewVersion.body, "html", variables)
    return {
      status: "preview",
      html,
      templateName: template.name,
      templateLanguage: options.language ?? template.language ?? "en",
    }
  }

  // Resolve a series if the consumer gave a (prefix, scope) or a name —
  // failure to find is non-fatal since a contract can issue without a
  // number (some operators use templates as standalone records and number
  // externally). prefix+scope wins when both are set.
  let seriesId: string | null = null
  if (options.seriesPrefixScope) {
    const series = await contractSeriesService.findActiveByPrefixScope(
      db,
      options.seriesPrefixScope.prefix,
      options.seriesPrefixScope.scope,
    )
    seriesId = series?.id ?? null
  } else if (options.seriesName) {
    const series = await contractSeriesService.findSeriesByName(db, options.seriesName)
    seriesId = series?.id ?? null
  }

  // Branch on whether the storefront pre-created a draft contract
  // at /checkout/start time (carrying the acceptance metadata on
  // `metadata.acceptance`) vs. a confirmed-without-storefront flow
  // where this is the first time we touch the contract.
  let contractRecord: NonNullable<
    Awaited<ReturnType<typeof contractRecordsService.createContract>>
  > | null = null
  if (existing) {
    // Pre-existing draft (or storefront pre-create): UPDATE it with
    // the freshly-resolved variables + templateVersionId before
    // issuing. We preserve `metadata.acceptance` from the draft if
    // present — the storefront stored the acceptance fingerprint
    // there and we need it for the signature row downstream.
    const preservedMetadata = (existing.metadata as Record<string, unknown> | null) ?? {}
    const updated = await contractRecordsService.updateContract(db, existing.id, {
      templateVersionId: template.currentVersionId,
      seriesId: existing.seriesId ?? seriesId,
      personId: existing.personId ?? booking.personId ?? null,
      organizationId: existing.organizationId ?? booking.organizationId ?? null,
      title: existing.title || `${template.name} — ${booking.bookingNumber}`,
      language: existing.language || options.language || template.language || "en",
      variables,
      metadata: {
        ...preservedMetadata,
        autoGenerated: true,
        trigger: "booking.confirmed",
        triggerActorId: event.actorId,
      },
    })
    contractRecord = updated ?? existing
  } else {
    contractRecord = await contractRecordsService.createContract(db, {
      scope: options.scope ?? "customer",
      status: "draft",
      title: `${template.name} — ${booking.bookingNumber}`,
      templateVersionId: template.currentVersionId,
      seriesId,
      bookingId: event.bookingId,
      personId: booking.personId ?? null,
      organizationId: booking.organizationId ?? null,
      language: options.language ?? template.language ?? "en",
      variables,
      metadata: {
        autoGenerated: true,
        trigger: "booking.confirmed",
        triggerActorId: event.actorId,
      },
    })
  }
  if (!contractRecord) {
    return { status: "contract_create_failed" }
  }

  const result = await contractDocumentsService.generateContractDocument(
    db,
    contractRecord.id,
    {
      issueIfDraft: true,
      replaceExisting: true,
      kind: "document",
      publicDelivery: false,
    },
    {
      generator: runtime.generator,
      eventBus: runtime.eventBus,
      lifecycleHooks: runtime.lifecycleHooks,
    },
  )

  if (result.status === "generated") {
    return { status: "ok", contractId: contractRecord.id, attachmentId: result.attachment.id }
  }

  return { status: "document_failed", reason: result.status }
}

function defaultVariablesToRecord(defaults: DefaultContractVariables): Record<string, unknown> {
  return { ...defaults }
}

type BookingItemRow = Awaited<ReturnType<typeof bookingsService.listItems>>[number]
type BookingTravelerRow = Awaited<ReturnType<typeof bookingsService.listTravelers>>[number]
type BookingTravelerTravelDetails = NonNullable<
  Awaited<ReturnType<BookingPiiService["getTravelerTravelDetails"]>>
>

interface BookingItemContext {
  entityModule: string
  entityId: string
  vertical: string
  productTitle: string
  productSubtitle: string
  destination: string
  departureSlot: {
    slotId: string
    startAt: string
    endAt: string
    durationDays: number | null
    departureCity: string
  }
  items: ContractItemVariable[]
  rawItems: BookingItemRow[]
  roomOptionUnitIds: ReadonlySet<string>
}

interface PaymentScheduleSummary {
  entries: DefaultContractVariables["payment"]["schedule"]
  depositAmountCents: number
  depositDueDate: string
  balanceAmountCents: number
  balanceDueDate: string
}

async function resolveTravelerTravelDetails(
  db: PostgresJsDatabase,
  bookingId: string,
  travelers: BookingTravelerRow[],
  pii: BookingPiiService | null | undefined,
  actorId: string | null,
  actionLedgerContext: ActionLedgerRequestContextValues | null | undefined,
): Promise<Map<string, BookingTravelerTravelDetails>> {
  const detailsByTraveler = new Map<string, BookingTravelerTravelDetails>()
  if (!pii || travelers.length === 0) return detailsByTraveler

  await Promise.all(
    travelers.map(async (traveler) => {
      const details = await ledgerSensitiveRead(
        db,
        {
          context: actionLedgerContext ?? {
            userId: actorId,
            actor: actorId ? "staff" : "system",
            callerType: actorId ? "staff" : "internal",
            isInternalRequest: actorId == null,
          },
          actionName: "booking.pii.read",
          actionVersion: "v1",
          targetType: "booking_traveler",
          targetId: traveler.id,
          routeOrToolName: "legal.contracts.bookings.generate-document",
          capabilityId: BOOKING_PII_READ_CAPABILITY.id,
          capabilityVersion: BOOKING_PII_READ_CAPABILITY.version,
          authorizationSource: "legal.contract.auto_generate",
          reasonCode: "contract_variable_resolution",
          disclosedFieldSet: ["dateOfBirth", "document"],
          disclosureSummary: "Contract variable traveler identity snapshot",
          decisionPolicy: "bookings-pii-scope-or-staff-v1",
          fallbackPrincipalId: actorId ?? "legal_contract_auto_generate",
        },
        () => pii.getTravelerTravelDetails(db, traveler.id, actorId),
      )
      await logBookingPiiContractRead(db, {
        bookingId,
        travelerId: traveler.id,
        actorId,
        actionLedgerContext,
      })
      if (details) {
        detailsByTraveler.set(traveler.id, details)
      }
    }),
  )

  return detailsByTraveler
}

async function logBookingPiiContractRead(
  db: PostgresJsDatabase,
  input: {
    bookingId: string
    travelerId: string
    actorId: string | null
    actionLedgerContext: ActionLedgerRequestContextValues | null | undefined
  },
) {
  await db.insert(bookingPiiAccessLog).values({
    bookingId: input.bookingId,
    travelerId: input.travelerId,
    actorId: input.actionLedgerContext?.userId ?? input.actorId,
    actorType: input.actionLedgerContext?.actor ?? (input.actorId ? "staff" : "system"),
    callerType: input.actionLedgerContext?.callerType ?? (input.actorId ? "staff" : "internal"),
    action: "read",
    outcome: "allowed",
    reason: "contract_variable_resolution",
    metadata: {
      routeOrToolName: "legal.contracts.bookings.generate-document",
      capabilityId: BOOKING_PII_READ_CAPABILITY.id,
      capabilityVersion: BOOKING_PII_READ_CAPABILITY.version,
    },
  })
}

async function resolveBookingItemContext(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<BookingItemContext> {
  const items = await bookingsService.listItems(db, bookingId)
  const primaryItem =
    items.find((item) => item.productNameSnapshot || item.productId || item.availabilitySlotId) ??
    items[0] ??
    null

  if (!primaryItem) {
    return emptyBookingItemContext()
  }

  const metadata = recordValue(primaryItem.metadata)
  const productId = primaryItem.productId ?? ""
  const linkedProductTitle =
    productId && !primaryItem.productNameSnapshot
      ? await resolveLinkedProductTitle(db, productId)
      : ""
  const destination = firstString(
    pickString(metadata, [
      "destination",
      "destinationName",
      "destination_name",
      "productDestination",
      "product_destination",
    ]),
    productId ? await resolveLinkedProductDestination(db, productId) : "",
  )

  const entityModule = firstString(
    pickString(metadata, ["entityModule", "entity_module", "module"]),
    productId ? "products" : "",
  )
  const entityId = firstString(pickString(metadata, ["entityId", "entity_id"]), productId)
  const vertical = firstString(
    pickString(metadata, ["vertical", "entityVertical", "entity_vertical", "productType"]),
    entityModule,
  )
  const productTitle = firstString(
    primaryItem.productNameSnapshot,
    linkedProductTitle,
    primaryItem.title,
  )
  const productSubtitle = firstString(
    primaryItem.optionNameSnapshot,
    primaryItem.unitNameSnapshot,
    primaryItem.description,
  )
  const departureSlot = await resolveDepartureSlotContext(db, primaryItem)
  const roomOptionUnitIds = await resolveRoomOptionUnitIds(db, items)

  return {
    entityModule,
    entityId,
    vertical,
    productTitle,
    productSubtitle,
    destination,
    departureSlot,
    items: items.map(mapBookingItemToContractItem),
    rawItems: items,
    roomOptionUnitIds,
  }
}

function emptyBookingItemContext(): BookingItemContext {
  return {
    entityModule: "",
    entityId: "",
    vertical: "",
    productTitle: "",
    productSubtitle: "",
    destination: "",
    departureSlot: {
      slotId: "",
      startAt: "",
      endAt: "",
      durationDays: null,
      departureCity: "",
    },
    items: [],
    rawItems: [],
    roomOptionUnitIds: new Set(),
  }
}

async function resolveBookingPaymentScheduleVariables(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<PaymentScheduleSummary> {
  const rows = await db
    .select()
    .from(bookingPaymentSchedules)
    .where(eq(bookingPaymentSchedules.bookingId, bookingId))
    .orderBy(asc(bookingPaymentSchedules.dueDate), asc(bookingPaymentSchedules.createdAt))

  const deposit = rows.find((row) => row.scheduleType === "deposit")
  const balance = rows.find((row) => row.scheduleType === "balance")

  return {
    entries: rows.map((row, index) => ({
      index: index + 1,
      type: row.scheduleType,
      amountCents: row.amountCents,
      currency: row.currency,
      dueDate: row.dueDate,
      status: row.status,
    })),
    depositAmountCents: deposit?.amountCents ?? 0,
    depositDueDate: deposit?.dueDate ?? "",
    balanceAmountCents: balance?.amountCents ?? 0,
    balanceDueDate: balance?.dueDate ?? "",
  }
}

function deriveRoomsSummary(
  items: BookingItemRow[],
  roomOptionUnitIds: ReadonlySet<string>,
): string {
  const lines = items
    .filter((item) => isAccommodationLikeItem(item, roomOptionUnitIds))
    .map((item) => {
      const label = firstString(item.unitNameSnapshot, item.optionNameSnapshot, item.title)
      if (!label) return ""
      return `${item.quantity ?? 1}× ${label}`
    })
    .filter(Boolean)

  return lines.join(", ")
}

function isAccommodationLikeItem(
  item: BookingItemRow,
  roomOptionUnitIds: ReadonlySet<string>,
): boolean {
  if (item.itemType === "accommodation") return true
  if (item.optionUnitId && roomOptionUnitIds.has(item.optionUnitId)) return true

  const metadata = recordValue(item.metadata)
  const unitType = pickString(metadata, [
    "unitType",
    "unit_type",
    "optionUnitType",
    "option_unit_type",
  ]).toLowerCase()

  return unitType === "room" || unitType === "accommodation"
}

async function resolveRoomOptionUnitIds(
  db: PostgresJsDatabase,
  items: BookingItemRow[],
): Promise<Set<string>> {
  const optionUnitIds = [
    ...new Set(
      items
        .map((item) => item.optionUnitId)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  ]
  if (optionUnitIds.length === 0) return new Set()

  try {
    const result = await db.execute(sql`
      SELECT id
      FROM option_units
      WHERE id IN (${sql.join(
        // agent-quality: raw-sql reviewed -- owner: legal; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        optionUnitIds.map((id) => sql`${id}`),
        sql`, `,
      )})
        AND unit_type IN ('room', 'accommodation')
    `)
    return new Set(toRows<{ id: string }>(result).map((row) => row.id))
  } catch (error) {
    if (isUndefinedTableError(error)) return new Set()
    throw error
  }
}

function mapBookingItemToContractItem(item: BookingItemRow, index: number): ContractItemVariable {
  const quantity = item.quantity ?? 1
  const unitAmountCents =
    item.unitSellAmountCents ??
    (item.totalSellAmountCents != null && quantity > 0
      ? Math.round(item.totalSellAmountCents / quantity)
      : 0)

  return {
    index: index + 1,
    kind: item.itemType,
    description: firstString(item.productNameSnapshot, item.title, item.description),
    quantity,
    unitAmountCents,
    totalAmountCents: item.totalSellAmountCents ?? unitAmountCents * quantity,
    currency: item.sellCurrency,
    taxIncluded: false,
  }
}

async function resolveDepartureSlotContext(
  db: PostgresJsDatabase,
  item: BookingItemRow,
): Promise<BookingItemContext["departureSlot"]> {
  const slotId = item.availabilitySlotId ?? ""
  const linkedSlot = slotId ? await resolveLinkedAvailabilitySlot(db, slotId) : null
  const startAt = normalizeDateTime(linkedSlot?.starts_at ?? item.startsAt)
  const endAt = normalizeDateTime(linkedSlot?.ends_at ?? item.endsAt)
  const durationDays =
    numberValue(linkedSlot?.days) ??
    (startAt && endAt
      ? Math.max(1, computeNights(startAt.slice(0, 10), endAt.slice(0, 10)) + 1)
      : null)

  return {
    slotId,
    startAt,
    endAt,
    durationDays,
    departureCity: extractDepartureCity(item.departureLabelSnapshot),
  }
}

async function resolveLinkedProductTitle(
  db: PostgresJsDatabase,
  productId: string,
): Promise<string> {
  try {
    const result = await db.execute<{ name: string | null }>(
      // agent-quality: raw-sql reviewed -- owner: legal; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      sql`select name from products where id = ${productId} limit 1`,
    )
    return toRows<{ name: string | null }>(result)[0]?.name ?? ""
  } catch (error) {
    if (isUndefinedTableError(error)) return ""
    throw error
  }
}

async function resolveLinkedProductDestination(
  db: PostgresJsDatabase,
  productId: string,
): Promise<string> {
  try {
    const result = await db.execute<{ destination: string | null }>(sql`
      select coalesce(dt.name, d.slug) as destination
      from product_destinations pd
      inner join destinations d on d.id = pd.destination_id
      left join destination_translations dt on dt.destination_id = d.id
      where pd.product_id = ${productId}
      order by
        pd.sort_order asc,
        case when dt.language_tag = 'en' then 0 else 1 end,
        dt.language_tag asc nulls last,
        d.slug asc
      limit 1
    `)
    return toRows<{ destination: string | null }>(result)[0]?.destination ?? ""
  } catch (error) {
    if (isUndefinedTableError(error)) return ""
    throw error
  }
}

async function resolveLinkedAvailabilitySlot(
  db: PostgresJsDatabase,
  slotId: string,
): Promise<{
  starts_at: Date | string | null
  ends_at: Date | string | null
  days: number | null
} | null> {
  try {
    const result = await db.execute<{
      starts_at: Date | string | null
      ends_at: Date | string | null
      days: number | null
    }>(sql`
      select starts_at, ends_at, days
      from availability_slots
      where id = ${slotId}
      limit 1
    `)
    return (
      toRows<{
        starts_at: Date | string | null
        ends_at: Date | string | null
        days: number | null
      }>(result)[0] ?? null
    )
  } catch (error) {
    if (isUndefinedTableError(error)) return null
    throw error
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function firstString(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function normalizeDateTime(value: Date | string | null | undefined): string {
  if (!value) return ""
  return value instanceof Date ? value.toISOString() : value
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function extractDepartureCity(label: string | null | undefined): string {
  const normalized = firstString(label)
  if (!normalized) return ""
  const separator = normalized.includes("—") ? "—" : normalized.includes("-") ? "-" : ""
  if (!separator) return ""
  const parts = normalized
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : ""
}

function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows
    return Array.isArray(rows) ? (rows as T[]) : []
  }
  return []
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  )
}

type SettlementInvoiceRow = Pick<
  typeof invoices.$inferSelect,
  "currency" | "baseCurrency" | "balanceDueCents" | "baseBalanceDueCents"
>

type SettlementPaymentRow = Pick<
  typeof payments.$inferSelect,
  "amountCents" | "currency" | "baseCurrency" | "baseAmountCents" | "paymentMethod" | "paymentDate"
>

async function resolveBookingSettlementVariables(
  db: PostgresJsDatabase,
  bookingId: string,
  bookingCurrency: string,
): Promise<{
  paidAmountCents: number
  balanceDueCents: number | null
  latestCompleted?: DefaultContractVariables["payment"]["latestCompleted"]
}> {
  const invoiceRows = await db
    .select({
      currency: invoices.currency,
      baseCurrency: invoices.baseCurrency,
      balanceDueCents: invoices.balanceDueCents,
      baseBalanceDueCents: invoices.baseBalanceDueCents,
    })
    .from(invoices)
    .where(and(eq(invoices.bookingId, bookingId), ne(invoices.status, "void")))

  const currency = bookingCurrency || invoiceRows[0]?.currency || ""

  const completedPaymentRows = await db
    .select({
      amountCents: payments.amountCents,
      currency: payments.currency,
      baseCurrency: payments.baseCurrency,
      baseAmountCents: payments.baseAmountCents,
      paymentMethod: payments.paymentMethod,
      paymentDate: payments.paymentDate,
    })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(
      and(
        eq(invoices.bookingId, bookingId),
        ne(invoices.status, "void"),
        eq(payments.status, "completed"),
      ),
    )
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt))

  const paidAmountCents = completedPaymentRows.reduce(
    (sum, payment) => sum + amountInCurrency(payment, currency),
    0,
  )
  const balanceDueCents =
    invoiceRows.length > 0
      ? invoiceRows.reduce((sum, invoice) => sum + invoiceBalanceInCurrency(invoice, currency), 0)
      : null
  const latestPayment = completedPaymentRows[0]

  return {
    paidAmountCents,
    balanceDueCents,
    latestCompleted: latestPayment
      ? {
          method: latestPayment.paymentMethod,
          methodLabel: formatPaymentMethodLabel(latestPayment.paymentMethod),
          date: latestPayment.paymentDate,
        }
      : undefined,
  }
}

function computeAmountDueCents(
  settlement: { paidAmountCents: number; balanceDueCents: number | null },
  totalCents: number,
): number {
  if (settlement.balanceDueCents != null) return Math.max(0, settlement.balanceDueCents)
  return Math.max(0, totalCents - settlement.paidAmountCents)
}

function amountInCurrency(payment: SettlementPaymentRow, currency: string): number {
  if (!currency || payment.currency === currency) return payment.amountCents
  if (payment.baseCurrency === currency) return payment.baseAmountCents ?? 0
  return 0
}

function invoiceBalanceInCurrency(invoice: SettlementInvoiceRow, currency: string): number {
  if (!currency || invoice.currency === currency) return invoice.balanceDueCents
  if (invoice.baseCurrency === currency) return invoice.baseBalanceDueCents ?? 0
  return 0
}

function formatPaymentMethodLabel(method: string): string {
  return method
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function computeNights(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
    const ms = end.getTime() - start.getTime()
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)))
  } catch {
    return 0
  }
}
