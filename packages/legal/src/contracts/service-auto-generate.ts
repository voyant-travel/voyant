import { bookingsService } from "@voyantjs/bookings"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { contractRecordsService } from "./service-contracts.js"
import type { ContractDocumentGenerator } from "./service-documents.js"
import { contractDocumentsService } from "./service-documents.js"
import { contractSeriesService } from "./service-series.js"
import { contractTemplatesService } from "./service-templates.js"

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
    balanceDueCents: number

    // Payment-schedule-derived (deposit + balance from
    // booking_payment_schedules). Empty when no schedule exists.
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
}

export interface AutoGenerateContractRuntime {
  generator: ContractDocumentGenerator
  eventBus?: import("@voyantjs/core").EventBus
  /**
   * Runtime bindings forwarded into `resolveVariables` so consumers
   * can read deploy-specific env vars (e.g. `DOCUMENTS_BASE_URL`)
   * without restructuring every auto-generate call site to know
   * about them.
   */
  bindings?: Record<string, unknown> | null
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
): Promise<
  | { status: "ok"; contractId: string; attachmentId: string }
  | { status: "template_not_found" }
  | { status: "template_version_missing" }
  | { status: "booking_not_found" }
  | { status: "contract_create_failed" }
  | { status: "document_failed"; reason: string }
> {
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
  // A booking should have at most one active customer-scope contract;
  // operators wanting a fresh one use the regenerate admin route.
  const existingContracts = await contractRecordsService.listContracts(db, {
    bookingId: event.bookingId,
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
  const leadTraveler =
    travelers.find((t) => t.isPrimary) ??
    travelers.find((t) => t.participantType === "traveler") ??
    travelers[0] ??
    null

  const now = new Date()
  const todayIso = now.toISOString().slice(0, 10)
  const todayIsoDateTime = now.toISOString()
  const todayTime = todayIsoDateTime.slice(11, 19)

  const sellCurrency = booking.sellCurrency ?? ""
  const totalCents = booking.sellAmountCents ?? 0
  const startDate = booking.startDate ?? ""
  const endDate = booking.endDate ?? ""
  const durationNights = computeNights(startDate, endDate)

  const mappedTravelers: ContractTravelerVariable[] = travelers.map((t, i) => {
    const fullName = [t.firstName, t.lastName].filter(Boolean).join(" ").trim()
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
      dateOfBirth: "",
      document: {
        type: "",
        number: "",
        country: "",
        issuingAuthority: "",
        issueDate: "",
        expiryDate: "",
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

      entityModule: "",
      entityId: "",
      vertical: "",
      productName: "",
      productSubtitle: "",
      destination: "",

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

      paidAmountCents: 0,
      balanceDueCents: totalCents,

      depositAmountCents: 0,
      depositDueDate: "",
      balanceAmountCents: 0,
      balanceDueDate: "",
      paymentPolicy: {
        source: "operator_default",
      },

      roomsSummary: "",

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
      dateOfBirth: "",
      companyName: "",
      vatId: "",
      registrationNumber: "",
      address: {
        line1: booking.contactAddressLine1 ?? "",
        line2: "",
        city: booking.contactCity ?? "",
        region: booking.contactRegion ?? "",
        postal: booking.contactPostalCode ?? "",
        country: booking.contactCountry ?? "",
      },
      document: {
        type: "",
        number: "",
        country: "",
        issuingAuthority: "",
        issueDate: "",
        expiryDate: "",
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

    items: [],
    addons: [],

    product: {
      title: "",
      subtitle: "",
      destination: "",
      module: "",
      id: "",
      vertical: "",
      heroImageUrl: "",
    },

    departureSlot: {
      slotId: "",
      startAt: startDate,
      endAt: endDate,
      durationDays: durationNights,
      departureCity: "",
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
      method: "",
      amountCents: totalCents,
      currency: sellCurrency,
      schedule: [],
      capturedAt: "",
      createdAt: "",
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
    : (defaults as unknown as Record<string, unknown>)

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
    },
    {
      generator: runtime.generator,
      eventBus: runtime.eventBus,
    },
  )

  if (result.status === "generated") {
    return { status: "ok", contractId: contractRecord.id, attachmentId: result.attachment.id }
  }

  return { status: "document_failed", reason: result.status }
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
