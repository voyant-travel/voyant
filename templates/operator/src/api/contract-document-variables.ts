import { bookingItems } from "@voyantjs/bookings/schema"
import { crmService } from "@voyantjs/crm"
import { bookingPaymentSchedules } from "@voyantjs/finance/schema"
import type { AutoGenerateContractOptions } from "@voyantjs/legal"
import { asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { readPolicySourceFromInternalNotes } from "./booking-payment-policy-runtime"
import { getOperatorPaymentInstructions, getOperatorProfile } from "./settings"

export const DEFAULT_CONTRACT_SERIES_NAME = "customer-contracts"

export const AUTO_GENERATE_CONTRACT_OPTIONS: AutoGenerateContractOptions = {
  enabled: true,
  templateSlug: "customer-sales-agreement",
  scope: "customer",
  language: "en",
  seriesName: DEFAULT_CONTRACT_SERIES_NAME,
  // Promote the storefront's acceptance marker (saved by
  // catalog-checkout into booking.internalNotes) into the proper
  // `acceptance.*` variables, and fold in the operator profile
  // (from Settings -> Operator profile) so the post-confirm render
  // fills `operator.*` instead of leaving every variable blank.
  resolveVariables: async ({ db, booking, defaults, bindings }) => {
    const acceptance = parseAcceptanceMarker(booking.internalNotes ?? "")
    const schedule = await loadBookingPaymentSchedule(db, booking.id)
    const roomsSummary = await deriveRoomsSummary(db, booking.id)
    const [operatorProfile, paymentInstructions] = await Promise.all([
      getOperatorProfile(db),
      getOperatorPaymentInstructions(db),
    ])

    // Hydrate the customer block from the linked CRM person /
    // identity record when the booking's snapshot columns are
    // empty. Bookings created before snapshot-at-create landed
    // still have `contact_*` nulls; without this fallback the
    // contract template renders blank customer info even though
    // the data lives on the linked person.
    const customerOverride = await resolveCustomerVariables(
      db,
      booking.personId,
      booking.organizationId,
    )

    // Public base URL for any external resources templates load when
    // CF Browser Rendering pulls the HTML to a PDF. In dev this falls
    // back to APP_URL (localhost) so existing template authoring
    // workflows keep working; in prod this MUST be set to a
    // publicly-reachable URL.
    const documentsBaseUrl =
      readStringBinding(bindings, "DOCUMENTS_BASE_URL") || readStringBinding(bindings, "APP_URL")

    return {
      ...defaults,
      documents: {
        baseUrl: documentsBaseUrl,
        base_url: documentsBaseUrl,
      },
      booking: {
        ...defaults.booking,
        depositAmountCents: schedule.depositAmountCents,
        depositDueDate: schedule.depositDueDate,
        balanceAmountCents: schedule.balanceAmountCents,
        balanceDueDate: schedule.balanceDueDate,
        paymentPolicy: {
          source:
            readPolicySourceFromInternalNotes(booking.internalNotes ?? "") ?? "operator_default",
        },
        roomsSummary,
      },
      payment: {
        ...defaults.payment,
        schedule: schedule.entries,
      },
      operator: {
        ...defaults.operator,
        name: operatorProfile?.name ?? "",
        legalName: operatorProfile?.legalName ?? operatorProfile?.name ?? "",
        vatId: operatorProfile?.vatId ?? "",
        registrationNumber: operatorProfile?.registrationNumber ?? "",
        address: operatorProfile?.address ?? "",
        phone: operatorProfile?.phone ?? "",
        email: operatorProfile?.email ?? "",
        website: operatorProfile?.website ?? "",
        iban: paymentInstructions?.iban ?? "",
        bank: paymentInstructions?.bank ?? "",
        license: operatorProfile?.license ?? "",
        licenseAuthority: operatorProfile?.licenseAuthority ?? "",
        signatoryName: operatorProfile?.signatoryName ?? "",
        signatoryRole: operatorProfile?.signatoryRole ?? "",
      },
      acceptance: {
        ...defaults.acceptance,
        ipAddress: acceptance?.clientIp ?? "",
        userAgent: acceptance?.userAgent ?? "",
        acceptedAt: acceptance?.acceptedAt ?? "",
        marketingConsent: acceptance?.acceptedMarketing ?? false,
        templateSlug: acceptance?.templateSlug ?? defaults.acceptance.templateSlug,
        templateId: acceptance?.templateId ?? defaults.acceptance.templateId,
      },
      contract: {
        ...defaults.contract,
        signedAt: acceptance?.acceptedAt ?? defaults.contract.signedAt,
        source: bookingSourceTypeToContractSource(booking.sourceType),
      },
      customer: customerOverride
        ? {
            ...defaults.customer,
            firstName: defaults.customer.firstName || customerOverride.firstName,
            lastName: defaults.customer.lastName || customerOverride.lastName,
            fullName: defaults.customer.fullName || customerOverride.fullName,
            email: defaults.customer.email || customerOverride.email,
            phone: defaults.customer.phone || customerOverride.phone,
            dateOfBirth: defaults.customer.dateOfBirth || customerOverride.dateOfBirth,
            companyName: defaults.customer.companyName || customerOverride.companyName,
            address: {
              ...defaults.customer.address,
              line1: defaults.customer.address.line1 || customerOverride.address.line1,
              city: defaults.customer.address.city || customerOverride.address.city,
              region: defaults.customer.address.region || customerOverride.address.region,
              postal: defaults.customer.address.postal || customerOverride.address.postal,
              country: defaults.customer.address.country || customerOverride.address.country,
            },
          }
        : defaults.customer,
    }
  },
}

export function contractVariableBindings(env: CloudflareBindings): Record<string, unknown> {
  return {
    APP_URL: env.APP_URL,
    DOCUMENTS_BASE_URL: env.DOCUMENTS_BASE_URL,
  }
}

interface StoredContractAcceptance {
  templateId?: string
  templateSlug?: string
  acceptedAt?: string
  acceptedMarketing?: boolean
  clientIp?: string
  userAgent?: string
  renderedHtmlLength?: number
}

const ACCEPTANCE_MARKER_PREFIX = "__contract_acceptance__:"

function readStringBinding(
  bindings: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const value = bindings?.[key]
  return typeof value === "string" ? value.trim() : ""
}

function parseAcceptanceMarker(internalNotes: string): StoredContractAcceptance | null {
  for (const line of internalNotes.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith(ACCEPTANCE_MARKER_PREFIX)) {
      try {
        return JSON.parse(trimmed.slice(ACCEPTANCE_MARKER_PREFIX.length))
      } catch {
        return null
      }
    }
  }
  return null
}

function bookingSourceTypeToContractSource(sourceType: string | null | undefined): string {
  switch (sourceType) {
    case "manual":
    case "internal":
      return "staff_issued"
    case "direct":
      return "self_service"
    case "affiliate":
    case "ota":
    case "reseller":
    case "api_partner":
      return "agent"
    default:
      return "self_service"
  }
}

async function resolveCustomerVariables(
  db: PostgresJsDatabase,
  personId: string | null,
  organizationId: string | null,
): Promise<{
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  dateOfBirth: string
  companyName: string
  address: { line1: string; city: string; region: string; postal: string; country: string }
} | null> {
  if (personId) {
    const person = await crmService.getPersonById(db, personId)
    if (!person) return null
    const addresses = await crmService.listAddresses(db, "person", person.id).catch(() => [])
    const primary = addresses.find((a) => a.isPrimary) ?? addresses[0] ?? null
    const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ").trim()
    return {
      firstName: person.firstName ?? "",
      lastName: person.lastName ?? "",
      fullName,
      email: person.email ?? "",
      phone: person.phone ?? "",
      dateOfBirth: person.dateOfBirth ?? "",
      companyName: "",
      address: {
        line1: primary?.line1 ?? "",
        city: primary?.city ?? "",
        region: primary?.region ?? "",
        postal: primary?.postalCode ?? "",
        country: primary?.country ?? "",
      },
    }
  }
  if (organizationId) {
    const org = await crmService.getOrganizationById(db, organizationId)
    if (!org) return null
    const addresses = await crmService.listAddresses(db, "organization", org.id).catch(() => [])
    const primary = addresses.find((a) => a.isPrimary) ?? addresses[0] ?? null
    return {
      firstName: "",
      lastName: "",
      fullName: org.name ?? "",
      email: "",
      phone: "",
      dateOfBirth: "",
      companyName: org.name ?? "",
      address: {
        line1: primary?.line1 ?? "",
        city: primary?.city ?? "",
        region: primary?.region ?? "",
        postal: primary?.postalCode ?? "",
        country: primary?.country ?? "",
      },
    }
  }
  return null
}

interface ScheduleSummary {
  entries: Array<{
    index: number
    type: string
    amountCents: number
    currency: string
    dueDate: string
    status: string
  }>
  depositAmountCents: number
  depositDueDate: string
  balanceAmountCents: number
  balanceDueDate: string
}

async function loadBookingPaymentSchedule(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<ScheduleSummary> {
  const rows = await db
    .select()
    .from(bookingPaymentSchedules)
    .where(eq(bookingPaymentSchedules.bookingId, bookingId))
    .orderBy(asc(bookingPaymentSchedules.dueDate), asc(bookingPaymentSchedules.createdAt))

  const entries = rows.map((row, idx) => ({
    index: idx + 1,
    type: row.scheduleType,
    amountCents: row.amountCents,
    currency: row.currency,
    dueDate: row.dueDate,
    status: row.status,
  }))

  const deposit = rows.find((r) => r.scheduleType === "deposit")
  const balance = rows.find((r) => r.scheduleType === "balance")

  return {
    entries,
    depositAmountCents: deposit?.amountCents ?? 0,
    depositDueDate: deposit?.dueDate ?? "",
    balanceAmountCents: balance?.amountCents ?? 0,
    balanceDueDate: balance?.dueDate ?? "",
  }
}

async function deriveRoomsSummary(db: PostgresJsDatabase, bookingId: string): Promise<string> {
  const rows = await db
    .select({
      title: bookingItems.title,
      quantity: bookingItems.quantity,
      itemType: bookingItems.itemType,
    })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))

  const accommodationLines = rows.filter((r) => r.itemType === "accommodation")
  return accommodationLines.map((r) => `${r.quantity}× ${r.title}`).join(", ")
}
