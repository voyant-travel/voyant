import { actionLedgerHonoModule } from "@voyantjs/action-ledger"
import { availabilityHonoModule } from "@voyantjs/availability"
import { bookingRequirementsHonoModule } from "@voyantjs/booking-requirements"
import { bookingsSupplierExtension, createBookingsHonoModule } from "@voyantjs/bookings"
import { bookingItems, bookings } from "@voyantjs/bookings/schema"
import { createCatalogSearchHonoModule } from "@voyantjs/catalog"
import { type EmbeddingProvider, executeSemanticSearch } from "@voyantjs/catalog-rag"
import {
  type CheckoutBankTransferDetails,
  type CheckoutPaymentStarter,
  createCheckoutHonoModule,
} from "@voyantjs/checkout"
import { createCrmHonoModule, crmBookingExtension, crmService } from "@voyantjs/crm"
import { createCustomerPortalHonoModule } from "@voyantjs/customer-portal"
import { distributionBookingExtension, distributionHonoModule } from "@voyantjs/distribution"
import { externalRefsHonoModule } from "@voyantjs/external-refs"
import { extrasHonoModule } from "@voyantjs/extras"
import { bookingsCreateExtension, createFinanceHonoModule, financeService } from "@voyantjs/finance"
import { bookingPaymentSchedules, invoices, paymentSessions } from "@voyantjs/finance/schema"
import { createApp } from "@voyantjs/hono"
import { identityHonoModule } from "@voyantjs/identity"
import {
  type AutoGenerateContractOptions,
  autoGenerateContractForBooking,
  type ContractDocumentGenerator,
  createBrowserRenderedPdfContractDocumentSerializer,
  createLegalHonoModule,
  createPdfContractDocumentGenerator,
  createStorageBackedContractDocumentGenerator,
} from "@voyantjs/legal"
import { marketsHonoModule } from "@voyantjs/markets"
import {
  createDefaultBookingDocumentAttachment,
  createNotificationsHonoModule,
} from "@voyantjs/notifications"
import {
  createNetopiaCheckoutStarter,
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaHonoBundle,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyantjs/plugin-netopia"
import { pricingHonoModule } from "@voyantjs/pricing"
import {
  createDefaultProductBrochureTemplate,
  generateAndStoreProductBrochure,
  productsBookingExtension,
  productsHonoModule,
} from "@voyantjs/products"
import { promotionsHonoModule } from "@voyantjs/promotions"
import { createPromotionsStorefrontResolvers } from "@voyantjs/promotions/service-storefront"
import { resourcesHonoModule } from "@voyantjs/resources"
import { sellabilityHonoModule } from "@voyantjs/sellability"
import { createStorefrontHonoModule } from "@voyantjs/storefront"
import { createStorefrontVerificationHonoModule } from "@voyantjs/storefront-verification"
import { suppliersHonoModule } from "@voyantjs/suppliers"
import { transactionsBookingExtension, transactionsHonoModule } from "@voyantjs/transactions"
import { mountWorkflowRunsAdminRoutes, WorkflowRunnerRegistry } from "@voyantjs/workflow-runs"
import { createCloudflareEdgeDriver } from "@voyantjs/workflows-orchestrator-cloudflare"
import { and, asc, desc, eq, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { createProductBrochurePrinter } from "../lib/brochure-printer"
import { resolveNotificationProviders } from "../lib/notifications"
import { createVideoUploadTicket } from "../lib/video-uploads"
import { tryGetCloudClient } from "../lib/voyant-cloud"
import { mountActionLedgerHealthRoutes } from "./action-ledger-health"
import authHandler, {
  hasAuthPermission,
  resolveAuthRequest,
  validateApiTokenAccess,
} from "./auth/handler"
import {
  bookingScheduleBundle,
  mountBookingPaymentScheduleRoutes,
  mountPublicPaymentPolicyRoutes,
  readPolicySourceFromInternalNotes,
} from "./booking-schedule"
import { mountBookingTaxPreviewRoutes } from "./booking-tax-preview"
import { mountCatalogBookingRoutes } from "./catalog-booking"
import { catalogBridgeBundle } from "./catalog-bridge"
import {
  createCatalogCheckoutBundle,
  mountCatalogCheckoutRoutes,
  rebuildBookingItemTaxLines,
} from "./catalog-checkout"
import { mountCatalogContentRoutes } from "./catalog-content"
import { channelPushBundle, mountChannelPushAdminRoutes } from "./channel-push"
import { mountFlightRoutes } from "./flights"
import { createInvitationsRoutes } from "./invitations"
import { buildCatalogContext } from "./lib/catalog-context"
import { dbFromEnvForApp, getDbFromEnv } from "./lib/db"
import {
  createDocumentStorage,
  createMediaStorage,
  guessMimeType,
  readDocumentContentBase64,
  resolveDocumentDownloadUrl,
} from "./lib/storage"
import { mountCatalogMcpRoutes } from "./mcp"
import { getOperatorSettings, mountOperatorSettingsRoutes } from "./settings"
import { createSmartbillSettlementPollers, smartbillOperatorBundle } from "./smartbill"

const notificationsHonoModule = createNotificationsHonoModule({
  resolveProviders: resolveNotificationProviders,
  resolveDocumentAttachmentResolver: (bindings) => async (document) => {
    if (document.storageKey) {
      const contentBase64 = await readDocumentContentBase64(
        bindings as unknown as CloudflareBindings,
        document.storageKey,
      )
      if (contentBase64) {
        return {
          filename: document.name,
          contentBase64,
          contentType: document.mimeType ?? undefined,
        }
      }

      const path = await resolveDocumentDownloadUrl(
        bindings as unknown as CloudflareBindings,
        document.storageKey,
      )
      if (path) {
        return {
          filename: document.name,
          path,
          contentType: document.mimeType ?? undefined,
        }
      }
    }

    return createDefaultBookingDocumentAttachment(document)
  },
  // Auto-dispatch the booking-confirmation bundle when a booking flips to
  // `confirmed`. The subscriber runs in the same process as the emitter via
  // the in-process event bus; errors are logged, not rethrown, so a flaky
  // mailer can't block the confirm request.
  //
  // KNOWN LEAK: `resolveDb` is called per-booking-confirmation by the
  // module's subscriber and leaks a Neon WebSocket Pool until isolate
  // teardown (the factory contract is `(bindings) => VoyantDb`, with no
  // dispose hook). Volume is low (1 per confirmed booking), so this
  // doesn't move the operational needle today. Fixing it properly
  // requires widening the module-factory contract in `@voyantjs/bookings`
  // to accept the `DisposableDb` shape — tracked alongside the rest of
  // the audit in #510.
  resolveDb: (bindings) => getDbFromEnv(bindings as unknown as CloudflareBindings),
  autoConfirmAndDispatch: {
    enabled: true,
    templateSlug: "booking-confirmation",
  },
})

const catalogSearchHonoModule = createCatalogSearchHonoModule({
  resolveRuntime: (c) => {
    const ctx = buildCatalogContext(c)
    return {
      indexer: ctx.catalog.indexer,
      embeddings: ctx.catalog.embeddings,
      defaultScope: ctx.defaultScope,
    }
  },
  executeSearch: ({ adapter, embeddings, slice, request }) =>
    executeSemanticSearch({
      adapter,
      embeddings: embeddings as EmbeddingProvider | undefined,
      slice,
      request,
    }),
})
const storefrontVerificationHonoModule = createStorefrontVerificationHonoModule({
  resolveProviders: resolveNotificationProviders,
  email: {
    subject: "Your verification code",
  },
})
const storefrontHonoModule = createStorefrontHonoModule({
  // Wire the promotions resolver into the storefront's previously-empty
  // `/v1/public/products/:productId/offers` and `/v1/public/offers/:slug`
  // endpoints. Per docs/architecture/promotions-architecture.md §8.
  offers: createPromotionsStorefrontResolvers(),
})

// Netopia is the only configured `pay-by-link` provider in this template.
// Container bootstrap (via `netopiaHonoBundle`) caches the resolved runtime
// options, so the starter only needs the `payload` from the request — env
// resolution happens lazily inside the starter's `startProvider`.
const netopiaCheckoutStarter = createNetopiaCheckoutStarter()

function resolveBankTransferDetails(
  bindings: Record<string, unknown>,
): CheckoutBankTransferDetails | null {
  const env = bindings as unknown as CloudflareBindings
  if (!env.BANK_TRANSFER_BENEFICIARY || !env.BANK_TRANSFER_IBAN) return null
  return {
    provider: "bank-transfer",
    beneficiary: env.BANK_TRANSFER_BENEFICIARY,
    iban: env.BANK_TRANSFER_IBAN,
    bankName: env.BANK_TRANSFER_BANK_NAME ?? null,
    // Currency comes from the invoice (per-booking); env value would be
    // wrong for any deal not in the deploy's home currency. Notes here are
    // just deploy-wide boilerplate — per-call collection notes override.
    notes: env.BANK_TRANSFER_NOTES ?? null,
  }
}

function bankTransferDetailsFromOperatorSettings(
  operatorProfile: Awaited<ReturnType<typeof getOperatorSettings>>,
  bindings: Record<string, unknown>,
): CheckoutBankTransferDetails | null {
  const envDetails = resolveBankTransferDetails(bindings)
  const beneficiary = operatorProfile?.legalName || operatorProfile?.name || envDetails?.beneficiary
  const iban = operatorProfile?.iban || envDetails?.iban
  if (!beneficiary || !iban) return null
  return {
    provider: "bank-transfer",
    beneficiary,
    iban,
    bankName: operatorProfile?.bank || envDetails?.bankName || null,
    notes: envDetails?.notes ?? null,
  }
}

async function buildPublicBankTransferInstructions(
  db: PostgresJsDatabase,
  bookingNumber: string,
  session: {
    invoiceId: string | null
    amountCents: number
    currency: string
  },
  bindings: Record<string, unknown>,
) {
  const operatorProfile = await getOperatorSettings(db)
  const details = bankTransferDetailsFromOperatorSettings(operatorProfile, bindings)
  if (!details) return null

  const [invoice] = session.invoiceId
    ? await db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          dueDate: invoices.dueDate,
          balanceDueCents: invoices.balanceDueCents,
          currency: invoices.currency,
        })
        .from(invoices)
        .where(eq(invoices.id, session.invoiceId))
        .limit(1)
    : []

  return {
    beneficiary: details.beneficiary,
    iban: details.iban,
    bankName: details.bankName ?? "—",
    reference: `BOOK-${bookingNumber}`,
    amountCents: invoice?.balanceDueCents ?? session.amountCents,
    currency: invoice?.currency ?? session.currency,
    dueAt: invoice?.dueDate ?? null,
    proformaNumber: invoice?.invoiceNumber ?? null,
  }
}

const checkoutHonoModule = createCheckoutHonoModule({
  resolveProviders: resolveNotificationProviders,
  resolvePaymentStarters: (): Record<string, CheckoutPaymentStarter> => ({
    netopia: netopiaCheckoutStarter,
  }),
  resolveBankTransferDetails,
})
/**
 * Process-wide registry of workflow runners. Bundles register their
 * runners on bootstrap (see `createCatalogCheckoutBundle`) so the
 * `/v1/admin/workflow-runs/:id/{rerun,resume}` endpoints can dispatch
 * a workflow by name. The dashboard's "Rerun" / "Resume" buttons are
 * powered by this registry. Self-hosted workflow services should
 * register runners that call `createNodeSelfHostWorkflowClient(...)`
 * and forward resume calls with `ctx.resumeFromStep` and
 * `ctx.seedResults`.
 */
const workflowRunnerRegistry = new WorkflowRunnerRegistry()

const customerPortalHonoModule = createCustomerPortalHonoModule({
  resolveDocumentDownloadUrl: (bindings, storageKey) =>
    resolveDocumentDownloadUrl(bindings as CloudflareBindings, storageKey),
})

// Wires the env-driven KMS provider into CRM admin routes so
// operator UIs can read/write decrypted PII (passport snapshots,
// dietary/accessibility blobs) through `/v1/admin/crm/people/...`.
const crmHonoModule = createCrmHonoModule()

// `resolveTravelSnapshot` lets the booking-traveler "with travel
// details" route auto-snapshot dietary/accessibility/primary-passport
// from the linked `crm.people` row when an operator picks an existing
// person. Bookings stays free of any direct CRM dep — the resolver
// is wired here at template assembly time and receives the same KMS
// provider the route already resolved.
const bookingsHonoModule = createBookingsHonoModule({
  resolveTravelSnapshot: (db, personId, { kms }) =>
    crmService.loadPersonTravelSnapshot(db, personId, { kms }),
})

const financeModule = createFinanceHonoModule({
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
    resolveDocumentDownloadUrl(bindings as unknown as CloudflareBindings, storageKey),
  resolveInvoiceSettlementPollers: (bindings) =>
    createSmartbillSettlementPollers(bindings as unknown as CloudflareBindings),
})
/**
 * Build the `ContractDocumentGenerator` configured for this template.
 * Used by both the legal module's `resolveDocumentGenerator` (for the
 * subscriber + admin regenerate route) and by the explicit
 * `generate_contract_pdf` step in `checkout-finalize`. Centralising
 * here means both paths use the same renderer (Cloud SDK browser
 * rendering when available, basic pdf-lib otherwise).
 *
 * Returns `null` when no DOCUMENTS_BUCKET is configured — callers
 * treat that as "contract documents are not stored on this deploy".
 */
function resolveContractDocumentGenerator(
  env: CloudflareBindings,
): ContractDocumentGenerator | null {
  const storage = createDocumentStorage(env)
  if (!storage) return null
  const cloud = tryGetCloudClient(env)
  if (cloud) {
    return createStorageBackedContractDocumentGenerator({
      storage,
      serializer: createBrowserRenderedPdfContractDocumentSerializer({
        cloudClient: cloud,
      }),
    })
  }
  // Local dev / no cloud key — fall back to the basic pdf-lib
  // serializer. Contract PDFs will be plain text but the worker
  // boots and downstream flows complete. Prod deploys MUST set
  // VOYANT_CLOUD_API_KEY.
  console.warn(
    "[operator] VOYANT_CLOUD_API_KEY not set — using basic pdf-lib serializer. " +
      "Contract PDFs will be unstyled. Set the key to enable browser-rendered output.",
  )
  return createPdfContractDocumentGenerator({ storage })
}

/**
 * Auto-generate config for the customer-sales-agreement template.
 * Shared by the legal module's `booking.confirmed` subscriber AND by
 * the explicit `generate_contract_pdf` step in `checkout-finalize` so
 * both paths produce identical contracts. The function
 * `autoGenerateContractForBooking` is idempotent — if a contract
 * document already exists for the booking, the second caller becomes
 * a no-op (whichever path runs first wins).
 *
 * Template slug must match a row in `contract_templates` whose
 * `currentVersionId` points at a published Liquid version. The
 * operator seed script creates `customer-sales-agreement`.
 */
/**
 * Default contract number series name. `autoGenerateContractForBooking`
 * looks up an active series with this name at issue time (post-payment)
 * and allocates the next number — that's how contracts get
 * `CTR-2026-00001` / etc. instead of staying unnumbered. The series
 * row is created lazily on first checkout fire (see
 * `ensureDefaultContractSeries`) so a fresh deploy doesn't need a
 * manual seed step. Operators can rename / customise the prefix
 * afterwards via the admin Series page without breaking the wiring
 * — lookup is by name, not id.
 */
const DEFAULT_CONTRACT_SERIES_NAME = "customer-contracts"
const MAX_BROCHURE_PDF_BYTES = 5 * 1024 * 1024

const AUTO_GENERATE_CONTRACT_OPTIONS: AutoGenerateContractOptions = {
  enabled: true,
  templateSlug: "customer-sales-agreement",
  scope: "customer",
  language: "en",
  seriesName: DEFAULT_CONTRACT_SERIES_NAME,
  // Promote the storefront's acceptance marker (saved by
  // catalog-checkout into booking.internalNotes) into the proper
  // `acceptance.*` variables, and fold in the operator profile
  // (from Settings → Operator) so the post-confirm render fills
  // `operator.*` instead of leaving every variable blank.
  resolveVariables: async ({ db, booking, defaults, bindings }) => {
    const env = bindings as unknown as CloudflareBindings
    const acceptance = parseAcceptanceMarker(booking.internalNotes ?? "")
    const schedule = await loadBookingPaymentSchedule(db, booking.id)
    const roomsSummary = await deriveRoomsSummary(db, booking.id)
    const operatorProfile = await getOperatorSettings(db)

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
    // workflows keep working — CF will fail to fetch the localhost
    // resources but the inline-styled PDF still generates. In prod
    // this MUST be set to a publicly-reachable URL.
    const documentsBaseUrl = env?.DOCUMENTS_BASE_URL?.trim() || env?.APP_URL?.trim() || ""

    return {
      ...defaults,
      documents: {
        // Templates use this to compose absolute URLs for logos /
        // signatures / hosted fonts. Examples in Liquid:
        //   <img src="{{ documents.base_url }}/v1/media/logo.png">
        //   <link rel="stylesheet" href="{{ documents.base_url }}/css/contract.css">
        //
        // Aliased keys (`baseUrl` + `base_url`) so template authors
        // can use either casing without editing the resolver.
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
          // The booking-schedule subscriber stamps the resolved
          // cascade layer onto the booking's internalNotes when it
          // computes the schedule. Read it back here so the
          // contract reflects which layer applied
          // (supplier / operator_default / category / listing /
          // booking).
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
        iban: operatorProfile?.iban ?? "",
        bank: operatorProfile?.bank ?? "",
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
        // Drive `contract.source` from the booking's origin so
        // contract templates can branch on whether the deal came
        // through self-service (storefront), an agent / partner,
        // or a back-office issue. Fallback to the legal default
        // ("self_service") when the booking sourceType is missing
        // or unrecognised.
        source: bookingSourceTypeToContractSource(booking.sourceType),
      },
      customer: customerOverride
        ? {
            ...defaults.customer,
            // Booking snapshot wins when present; live CRM data fills
            // any gap. Falsy snapshot strings (`""`) lose to non-empty
            // overrides so legacy bookings without contact_* still
            // render a populated customer block.
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

/**
 * Fetch the customer's CRM record + primary identity address so the
 * contract render falls back to live data when the booking row's
 * snapshot columns are empty (legacy bookings, or bookings created
 * via flows that didn't snapshot). Returns null when no CRM record
 * is linked — the resolver keeps `defaults.customer` (snapshot only).
 */
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

/**
 * Generate (or fetch existing) the contract PDF for a booking, using
 * the same template + variables config as the legal subscriber.
 * Idempotent — `autoGenerateContractForBooking` short-circuits when a
 * contract document already exists for this booking.
 *
 * Wired into `createCatalogCheckoutBundle({ generateContractPdf })`
 * so the explicit `generate_contract_pdf` checkout-finalize step can
 * call it.
 *
 * **Failure semantics**: on any non-`ok` status, this throws with a
 * structured message. The catalog workflow step's `runStep` wrapper
 * catches the throw and records it as a `failed` step in
 * `workflow_run_steps`, which the dashboard renders red with the
 * error message — operators get to SEE that the PDF generation
 * failed instead of silently looking at a green run with no
 * attachment. The booking + invoice + payment-link steps already
 * succeeded so the resume-from-failed-step UX picks up here without
 * re-issuing the invoice.
 *
 * Returns null only when the generator is intentionally unwired
 * (no DOCUMENTS_BUCKET binding) — that's a deployment choice, not
 * a failure to surface.
 */
/**
 * Idempotent: ensures the default `customer-contracts` series exists.
 * Called lazily from the contract-generation path so a fresh deploy
 * doesn't need a manual seed step before the first checkout. Once
 * the series exists we skip the insert; renames + prefix changes by
 * operators stick because lookup is by name, not id.
 */
async function ensureDefaultContractSeries(db: PostgresJsDatabase): Promise<void> {
  const { contractsService } = await import("@voyantjs/legal/contracts")
  const existing = await contractsService.findSeriesByName(db, DEFAULT_CONTRACT_SERIES_NAME)
  if (existing) return
  try {
    await contractsService.createSeries(db, {
      name: DEFAULT_CONTRACT_SERIES_NAME,
      // CTR-2026-00001 — year-stamped prefix because most operators
      // reset contract numbers per fiscal year. The series'
      // `resetStrategy: "never"` default works fine here; bumping to
      // "yearly" later just resets the sequence on Jan 1 without
      // changing the prefix.
      prefix: `CTR-${new Date().getFullYear()}-`,
      separator: "",
      padLength: 5,
      resetStrategy: "never",
      scope: "customer",
      active: true,
    })
  } catch (err) {
    console.warn("[operator] ensureDefaultContractSeries failed", err)
  }
}

/**
 * Reset every existing customer contract for the booking so the next
 * `autoGenerateContractForBooking` invocation rebuilds variables from
 * the latest booking data and re-renders the template.
 *
 * Steps per contract:
 *   - delete any `document` attachments (legal cascades to storage cleanup
 *     via attachment lifecycle hooks)
 *   - null out `renderedBody` so `ensureRenderedContract` re-renders from
 *     the current template body with the freshly-resolved variables
 *
 * Used by the Documents tab's per-row Regenerate action — the legacy
 * `regenerateDocument` mutation just re-runs the PDF printer over the
 * previously-stored variables/body, which is why placeholders looked
 * unfilled when the initial render had partial inputs.
 */
async function resetContractDocumentForBooking(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<void> {
  const { contractsService } = await import("@voyantjs/legal/contracts")
  const { contracts: contractsTable } = await import("@voyantjs/legal/schema")
  const existing = await contractsService.listContracts(db, { bookingId, limit: 25, offset: 0 })
  for (const contract of existing.data) {
    const attachments = await contractsService.listAttachments(db, contract.id)
    for (const attachment of attachments) {
      if (attachment.kind === "document") {
        await contractsService.deleteAttachment(db, attachment.id)
      }
    }
    await db
      .update(contractsTable)
      .set({ renderedBody: null, updatedAt: new Date() })
      .where(eq(contractsTable.id, contract.id))
  }
}

async function generateContractPdfForBooking(
  env: CloudflareBindings,
  db: PostgresJsDatabase,
  eventBus: import("@voyantjs/core").EventBus | undefined,
  bookingId: string,
  options: { force?: boolean } = {},
): Promise<{ contractId: string; attachmentId: string } | null> {
  const generator = resolveContractDocumentGenerator(env)
  if (!generator) return null

  // Lazy seed — creates the default series on the first contract
  // generation. No-ops on subsequent fires.
  await ensureDefaultContractSeries(db)

  // Resolve bookingNumber for the event payload — `autoGenerateContractForBooking`
  // requires it (it's used for the contract title).
  const [bookingRow] = await db
    .select({ bookingNumber: bookings.bookingNumber })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!bookingRow) {
    throw new Error(`generateContractPdfForBooking: booking ${bookingId} not found`)
  }

  // Force-regenerate path: `autoGenerateContractForBooking` is idempotent —
  // it short-circuits when a document attachment already exists. To rebuild
  // variables from current booking data and re-render the PDF, we first
  // delete the existing document attachment(s) and clear `renderedBody` on
  // the contract row so the rebuild branch fires with fresh inputs.
  if (options.force) {
    await resetContractDocumentForBooking(db, bookingId)
  }

  const result = await autoGenerateContractForBooking(
    db,
    { bookingId, bookingNumber: bookingRow.bookingNumber, actorId: null },
    AUTO_GENERATE_CONTRACT_OPTIONS,
    { generator, eventBus, bindings: env as unknown as Record<string, unknown> },
  )

  if (result.status === "ok") {
    return { contractId: result.contractId, attachmentId: result.attachmentId }
  }

  // Surface the underlying failure reason so the dashboard step
  // row says e.g. "document_failed: generator_failed" instead of
  // sitting silent. `result.reason` is set by autoGenerateContractForBooking
  // to whatever generateContractDocument returned — typically
  // `generator_failed` (Cloud SDK / R2 upload error) or
  // `template_not_found`.
  const reason = "reason" in result && typeof result.reason === "string" ? result.reason : "unknown"
  throw new Error(
    `Contract PDF generation failed: ${result.status} (${reason}). ` +
      "Check wrangler logs for the underlying generator error " +
      "(Cloud SDK call, R2 upload, or template render).",
  )
}

const legalModule = createLegalHonoModule({
  // KNOWN LEAK: same shape as the bookings `resolveDb` above — leaks a
  // Pool per legal-event subscriber call until the module factory's
  // contract widens to accept `DisposableDb`. Tracked in #510.
  resolveDb: (bindings) => getDbFromEnv(bindings as unknown as CloudflareBindings),
  resolveDocumentDownloadUrl: (bindings, storageKey) =>
    resolveDocumentDownloadUrl(bindings as unknown as CloudflareBindings, storageKey),
  resolveDocumentStorage: (bindings) =>
    createDocumentStorage(bindings as unknown as CloudflareBindings),
  resolveDocumentGenerator: (bindings) =>
    resolveContractDocumentGenerator(bindings as unknown as CloudflareBindings) ?? undefined,
  autoGenerateContractOnConfirmed: AUTO_GENERATE_CONTRACT_OPTIONS,
})

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

/**
 * Map the booking's `source_type` enum onto the contract template's
 * `contract.source` — used by templates to branch on how the booking
 * came in (e.g. agent-issued contracts list two signature lines, the
 * self-service path embeds an acceptance fingerprint).
 *
 * Mapping:
 *   `manual` / `internal`   → `"staff_issued"`  (operator-issued
 *                             from the admin)
 *   `direct`                → `"self_service"` (customer self-served
 *                             via the storefront)
 *   `affiliate` / `ota`     → `"agent"`        (third-party seller)
 *   `reseller` / `api_partner` → `"agent"`
 *   anything else / null    → `"self_service"` (safe default — most
 *                             contracts use the digital-acceptance
 *                             flow)
 */
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

/**
 * Read the booking's payment schedule and surface a deposit / balance
 * summary alongside the full schedule list. Both surfaces are exposed
 * to contract templates: the deposit + balance keys for the typical
 * "advance / remainder" copy pattern, and `payment.schedule[]` for
 * templates that want to render every installment.
 */
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

/**
 * Best-effort accommodation summary from the booking's items. Uses
 * the title field on each line so the operator gets whatever wording
 * was used at booking time ("1× Double room — BB"). Operators with a
 * structured cabin/room model override via their own
 * `resolveVariables` callback.
 */
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
  const lines = accommodationLines.length > 0 ? accommodationLines : []
  return lines.map((r) => `${r.quantity}× ${r.title}`).join(", ")
}

export const app = createApp<CloudflareBindings>({
  // `dbFromEnvForApp` returns `{ db, dispose }`; the Hono db middleware
  // schedules `dispose()` via `executionCtx.waitUntil` after the
  // response is sent, so each request gets its own Pool and closes it
  // before the isolate sleeps.
  db: (env) => dbFromEnvForApp(env),
  // Workflow runtime — Cloudflare edge composition. Per-run state lives
  // in the `WorkflowRunDO` Durable Object exported from `entry.ts`;
  // serialized manifests live in the `WORKFLOW_MANIFESTS` KV namespace.
  // Step bodies dispatch through `createInlineDispatcher` (set up inside
  // the DO), so workflow code lives in this same Worker.
  //
  // The `driver` field is a function-of-bindings: createApp invokes it
  // at lazy bootstrap time once env bindings are resolved. Uncomment
  // the durable_objects + kv_namespaces blocks in wrangler.jsonc and
  // run `wrangler kv namespace create WORKFLOW_MANIFESTS` to provision
  // the bindings; without them, bootstrap fails with a clear error.
  workflows: {
    driver: (bindings: unknown) => {
      const env = bindings as CloudflareBindings
      return createCloudflareEdgeDriver({
        orchestratorNamespace: env.WORKFLOW_RUN_DO,
        manifestKv: env.WORKFLOW_MANIFESTS,
      })
    },
  },
  publicPaths: [
    "/v1/public/customer-portal/contact-exists",
    "/v1/public/storefront-verification",
    "/v1/public/checkout",
    // Invitation redemption is reachable without a session.
    "/v1/public/invitations",
    // Payment-link landing page reads the session via TypeID (unguessable)
    // and the bank-transfer block from a config endpoint. Both must be
    // reachable without auth — the customer arrives from an emailed link.
    "/v1/public/finance/payment-sessions",
    "/v1/public/payment-link-config",
    "/v1/public/payment-link",
    // Storefront booking journey — quote / book / drafts run
    // unauthenticated against the customer surface. Per
    // booking-journey-architecture §10 Phase B (the journey is
    // auth-less or session-token-bound; this template takes the
    // auth-less posture and assigns `actor: "customer"`).
    "/v1/public/catalog",
    // Storefront post-card-payment status poll. The booking id is a
    // TypeID in the redirect URL; the response exposes only non-PII state.
    "/v1/public/bookings",
    // Storefront product / cruise / hospitality detail —
    // drives the `/shop/products/...` page's content fetch.
    "/v1/public/products",
    "/v1/public/cruises",
    "/v1/public/hospitality",
    // Storefront public CRM intake. Host deployments can wire captcha /
    // rate-limit checks through the storefront intake guard.
    "/v1/public/leads",
    "/v1/public/newsletter",
    // Storefront contract preview — the booking journey resolves the
    // active customer-scope template and renders its preview HTML
    // before the customer accepts. Both the slug-resolution lookup
    // and the by-slug preview render live under this prefix.
    "/v1/public/legal",
    // Operator profile + customer payment policy (sanitized subset).
    // The storefront contract preview reads operator name / address /
    // license + the deposit terms from here so it can render the
    // operator block and a deposit/balance schedule before the booking
    // exists.
    "/v1/public/settings/operator",
    // Cascade-aware policy resolver — storefront preview hits this
    // with `(entityModule, entityId)` + journey selections to get
    // the policy that will apply at booking time (supplier /
    // category / listing / operator default).
    "/v1/public/payment-policy",
    // Netopia webhook receiver. Netopia's servers POST here without a
    // session cookie or bearer; the plugin handler matches the inbound
    // payload to a payment session by orderID and validates the
    // processor's response shape. This is the URL set in
    // `NETOPIA_NOTIFY_URL`.
    "/v1/finance/providers/netopia/callback",
  ],
  modules: [
    actionLedgerHonoModule,
    crmHonoModule,
    availabilityHonoModule,
    identityHonoModule,
    externalRefsHonoModule,
    extrasHonoModule,
    bookingRequirementsHonoModule,
    pricingHonoModule,
    marketsHonoModule,
    transactionsHonoModule,
    resourcesHonoModule,
    sellabilityHonoModule,
    distributionHonoModule,
    suppliersHonoModule,
    productsHonoModule,
    promotionsHonoModule,
    catalogSearchHonoModule,
    bookingsHonoModule,
    financeModule,
    legalModule,
    notificationsHonoModule,
    storefrontHonoModule,
    customerPortalHonoModule,
    storefrontVerificationHonoModule,
    checkoutHonoModule,
  ],
  extensions: [
    bookingsSupplierExtension,
    bookingsCreateExtension,
    productsBookingExtension,
    crmBookingExtension,
    transactionsBookingExtension,
    distributionBookingExtension,
  ],
  plugins: [
    // bookingScheduleBundle subscribes to booking.confirmed BEFORE
    // legal's auto-generate-contract subscriber so the rendered
    // contract reads the freshly-written deposit/balance rows.
    bookingScheduleBundle,
    catalogBridgeBundle,
    createCatalogCheckoutBundle({
      workflowRunnerRegistry,
      generateContractPdf: ({ env, db, eventBus, bookingId }) =>
        generateContractPdfForBooking(env, db, eventBus, bookingId),
    }),
    smartbillOperatorBundle,
    channelPushBundle,
    netopiaHonoBundle(),
  ],
  auth: {
    handler: () => ({
      fetch: async (request, env, ctx) =>
        authHandler.fetch(request, env, ctx as ExecutionContext | undefined),
    }),
    resolve: async ({ request, env }) => resolveAuthRequest(request, env),
    hasPermission: async ({ request, env }) => hasAuthPermission(request, env),
    validateApiKey: async ({ env, db, apiKey }) => validateApiTokenAccess(env, db, apiKey),
  },
  additionalRoutes: (hono) => {
    // Admin-issued invitation flow (single-tenant sign-up is otherwise gated
    // at the Better Auth layer).
    hono.route("/", createInvitationsRoutes())

    // Action ledger diagnostics. GET is read-only drift health; POST writes
    // a synthetic canary action and verifies the relay row is visible.
    mountActionLedgerHealthRoutes(hono)

    // Operator profile + default customer payment policy. Backs the
    // admin Settings → Operator page and the storefront contract
    // preview's operator block.
    mountOperatorSettingsRoutes(hono)

    // Booking-level payment-policy override + schedule regeneration.
    // POST /v1/admin/bookings/:bookingId/payment-schedule/regenerate
    mountBookingPaymentScheduleRoutes(hono)

    // Real-time tax preview for the admin booking-create dialog.
    // POST /v1/admin/bookings/tax-preview
    mountBookingTaxPreviewRoutes(hono)

    // Rebuild `booking_item_tax_lines` from the catalog snapshot for a
    // booking. Repairs bookings created before the snapshot fallback in
    // `materializeBookingItemTaxLine` shipped — without this, invoices
    // generated from such bookings end up with 0 tax even though the
    // booking page shows the upstream tax from its catalog snapshot.
    // POST /v1/admin/bookings/:bookingId/rebuild-tax-lines
    hono.post("/v1/admin/bookings/:bookingId/rebuild-tax-lines", async (c) => {
      const bookingId = c.req.param("bookingId")
      try {
        const result = await rebuildBookingItemTaxLines(
          c.get("db") as unknown as PostgresJsDatabase,
          bookingId,
        )
        return c.json({ data: result })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ error: message }, 500)
      }
    })

    // Manual contract-PDF generation for the booking detail page's
    // Documents tab. Reuses the same `autoGenerateContractForBooking`
    // flow the `booking.confirmed` subscriber + the checkout-finalize
    // step use, so the variables (booking number, customer, operator
    // block, totals) match between automatic and manual paths.
    // POST /v1/admin/bookings/:bookingId/generate-contract
    hono.post("/v1/admin/bookings/:bookingId/generate-contract", async (c) => {
      const bookingId = c.req.param("bookingId")
      // Body is optional: callers may post `{}` (initial generate) or
      // `{ force: true }` (regenerate — rebuild variables + re-render).
      const body = await c.req.json<{ force?: boolean }>().catch(() => ({}) as { force?: boolean })
      try {
        const result = await generateContractPdfForBooking(
          c.env,
          c.get("db") as unknown as PostgresJsDatabase,
          c.get("eventBus"),
          bookingId,
          { force: body.force === true },
        )
        if (!result) {
          return c.json(
            { error: "Contract document storage not configured (missing DOCUMENTS_BUCKET)" },
            503,
          )
        }
        return c.json({ data: result })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return c.json({ error: message }, 502)
      }
    })

    // Storefront preview policy resolution. The customer-facing
    // booking journey calls this on mount + whenever the
    // sailing/cabin/rate-plan selection changes; the resolved policy
    // drives the deposit / balance preview in the contract dialog.
    // POST /v1/public/payment-policy/resolve
    mountPublicPaymentPolicyRoutes(hono)

    // POST /v1/uploads — upload public/editorial media via the configured
    // media storage provider. Sensitive documents should use private
    // document-aware flows instead of this route.
    hono.post("/v1/admin/products/:id/brochure/generate", async (c) => {
      const storage = createMediaStorage(c.env)
      if (!storage) {
        return c.json({ error: "Storage not configured" }, 503)
      }

      const productId = c.req.param("id")
      const cloud = tryGetCloudClient(c.env)
      let generated: Awaited<ReturnType<typeof generateAndStoreProductBrochure>>
      try {
        generated = await generateAndStoreProductBrochure(c.get("db"), productId, {
          storage,
          template: createDefaultProductBrochureTemplate(),
          ...(cloud ? { printer: createProductBrochurePrinter(c.env) } : {}),
          keyPrefix: `brochures/products/${productId}`,
          filename: ({ productId: generatedProductId, filename }) =>
            `brochure-${generatedProductId}-${Date.now()}-${filename}`,
          maxSizeBytes: MAX_BROCHURE_PDF_BYTES,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes("Generated brochure is too large")) {
          return c.json({ error: message }, 413)
        }
        throw err
      }

      await c.get("eventBus")?.emit("product.content.changed", {
        id: productId,
        axis: "media",
      })

      return c.json({
        data: generated.brochure,
        metadata: {
          filename: generated.filename,
          sizeBytes: generated.sizeBytes,
          storageKey: generated.storageKey,
          url: generated.url,
        },
      })
    })

    hono.post("/v1/uploads", async (c) => {
      const storage = createMediaStorage(c.env)
      if (!storage) {
        return c.json({ error: "Storage not configured" }, 503)
      }

      const body = await c.req.parseBody()
      const file = body.file
      if (!(file instanceof File)) {
        return c.json({ error: "Missing file field in multipart body" }, 400)
      }

      const ext = file.name.split(".").pop() ?? "bin"
      const key = `uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

      const result = await storage.upload(await file.arrayBuffer(), {
        key,
        contentType: file.type,
      })

      return c.json({
        key: result.key,
        url: result.url,
        mimeType: file.type,
        size: file.size,
      })
    })

    // POST /v1/uploads/video — request a one-shot upload ticket for video
    // bytes. The client uploads the video directly to `uploadUrl` (TUS
    // protocol). See `src/lib/video-uploads.ts` to swap providers.
    hono.post("/v1/uploads/video", async (c) => {
      const body = await c.req.json<{
        maxDurationSeconds: number
        name?: string | null
        requireSignedUrls?: boolean
        allowedOrigins?: string[]
        thumbnailTimestampPct?: number | null
        meta?: Record<string, string>
      }>()
      const ticket = await createVideoUploadTicket(c.env as Record<string, unknown>, body)
      return c.json(ticket)
    })

    // GET /v1/admin/documents/files/* — admin-only stream of private
    // documents bytes from the DOCUMENTS_BUCKET. Used as the fallback
    // download target for environments where the R2 binding isn't
    // backed by a real S3 SigV4 signer (every dev setup, plus
    // small-team prod deploys that haven't wired one up). The legal
    // package's contract-attachment download endpoint redirects here
    // when its `resolveDocumentDownloadUrl` resolves to a relative
    // storage key. Auth is the standard staff guard inherited from
    // `/v1/admin/*` middleware in createApp.
    hono.get("/v1/admin/documents/files/*", async (c) => {
      const storage = createDocumentStorage(c.env)
      if (!storage) {
        return c.json({ error: "Storage not configured" }, 503)
      }

      const rawKey = c.req.path.replace("/v1/admin/documents/files/", "")
      // Decode each path segment — `resolveDocumentDownloadUrl`
      // encodes them so storage keys with spaces / unicode survive
      // round-tripping through the URL.
      const key = rawKey
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/")
      if (!key) return c.json({ error: "Missing key" }, 400)

      const buffer = await storage.get(key)
      if (!buffer) return c.json({ error: "Not found" }, 404)

      const headers = new Headers()
      headers.set("Content-Type", guessMimeType(key))
      // Documents are private — keep them out of intermediary caches.
      headers.set("Cache-Control", "private, no-store")
      headers.set("Content-Length", String(buffer.byteLength))
      // Inline disposition lets the browser render PDFs in-tab; the
      // operator UI's "click on the name" UX expects open-in-tab.
      headers.set("Content-Disposition", `inline; filename="${key.split("/").pop() ?? "document"}"`)

      return new Response(buffer, { headers })
    })

    // GET /v1/media/* — serve public media via the configured media storage provider.
    hono.get("/v1/media/*", async (c) => {
      const storage = createMediaStorage(c.env)
      if (!storage) {
        return c.json({ error: "Storage not configured" }, 503)
      }

      const key = c.req.path.replace("/v1/media/", "")
      if (!key) {
        return c.json({ error: "Missing key" }, 400)
      }

      const buffer = await storage.get(key)
      if (!buffer) {
        return c.json({ error: "Not found" }, 404)
      }

      const headers = new Headers()
      headers.set("Content-Type", guessMimeType(key))
      headers.set("Cache-Control", "public, max-age=31536000, immutable")
      headers.set("Content-Length", String(buffer.byteLength))

      return new Response(buffer, { headers })
    })

    // GET /v1/public/payment-link-config — config block consumed by the
    // public `/pay/:sessionId` landing page. Returns the bank-transfer
    // instructions when configured, plus the brand context so the page
    // can render a header. Intentionally minimal — no PII, no secrets.
    hono.get("/v1/public/payment-link-config", async (c) => {
      const db = c.get("db") as PostgresJsDatabase
      const operatorProfile = await getOperatorSettings(db)
      const bankTransfer = bankTransferDetailsFromOperatorSettings(
        operatorProfile,
        c.env as Record<string, unknown>,
      )
      return c.json({
        data: {
          bankTransfer,
        },
      })
    })

    // POST /v1/public/payment-link/:sessionId/retry — create a fresh
    // payment_session targeting the same booking/invoice/etc. as the
    // original, so customers can retry after a failed/expired/cancelled
    // payment without being permanently locked into the dead session.
    // The original stays in the DB for audit. Already-paid sessions
    // return themselves (no-op) so retry is safe to call from the UI
    // without checking status first.
    hono.post("/v1/public/payment-link/:sessionId/retry", async (c) => {
      const sessionId = c.req.param("sessionId")
      const db = c.get("db")
      const [original] = await db
        .select()
        .from(paymentSessions)
        .where(eq(paymentSessions.id, sessionId))
        .limit(1)
      if (!original) return c.json({ error: "Session not found" }, 404)
      if (original.status === "paid" || original.status === "authorized") {
        return c.json({ data: { sessionId: original.id, alreadyPaid: true } })
      }
      const dbCast = db as unknown as Parameters<typeof financeService.createPaymentSession>[0]
      // Don't copy `clientReference` / `externalReference` to the retry —
      // Netopia derives its `orderID` from those fields, and reusing them
      // makes Netopia reject the new start as "Order already processed".
      // Letting them default to null means Netopia gets the new session.id
      // (unique by construction). Linkage back to the flight order is
      // preserved via `targetType` + `targetId`, and the resolver
      // endpoint searches all three keys so existing redirects still work.
      const fresh = await financeService.createPaymentSession(dbCast, {
        targetType: original.targetType,
        targetId: original.targetId ?? undefined,
        bookingId: original.bookingId ?? undefined,
        invoiceId: original.invoiceId ?? undefined,
        bookingPaymentScheduleId: original.bookingPaymentScheduleId ?? undefined,
        bookingGuaranteeId: original.bookingGuaranteeId ?? undefined,
        currency: original.currency,
        amountCents: original.amountCents,
        status: "pending",
        provider: original.provider ?? undefined,
        paymentMethod: original.paymentMethod ?? undefined,
        payerEmail: original.payerEmail ?? undefined,
        payerName: original.payerName ?? undefined,
        notes: original.notes ?? undefined,
      })
      return c.json({ data: { sessionId: fresh.id } })
    })

    // GET /v1/public/payment-link/resolve?ref=X — translate a customer-
    // facing reference (the orderID a processor echoes back, a booking
    // number, etc.) to the canonical session id. Tries id, clientReference,
    // and externalReference in that order. Used by the `/pay` resolver
    // route so processor redirects work regardless of which key was used.
    hono.get("/v1/public/payment-link/resolve", async (c) => {
      const ref = c.req.query("ref")
      if (!ref) return c.json({ error: "ref query param is required" }, 400)
      const db = c.get("db")
      const [session] = await db
        .select({ id: paymentSessions.id })
        .from(paymentSessions)
        .where(
          or(
            eq(paymentSessions.id, ref),
            eq(paymentSessions.clientReference, ref),
            eq(paymentSessions.externalReference, ref),
          ),
        )
        .limit(1)
      if (!session) return c.json({ error: "Payment session not found" }, 404)
      return c.json({ data: { sessionId: session.id } })
    })

    // POST /v1/public/payment-link/:sessionId/start-card — customer-facing
    // lazy-start for the configured card processor. Idempotent: if the
    // session already has a `redirectUrl`, returns it; otherwise calls
    // netopia.startPaymentSession with synthesized placeholder billing
    // (Netopia's hosted form collects the real billing from the customer)
    // and returns the new redirect URL.
    hono.post("/v1/public/payment-link/:sessionId/start-card", async (c) => {
      const sessionId = c.req.param("sessionId")
      const db = c.get("db")
      // `netopia.startPaymentSession` is typed against postgres-js; cast at
      // the call site since the union with neon-http is structurally
      // compatible for the queries Netopia issues.
      const dbCast = db as unknown as Parameters<typeof netopiaService.startPaymentSession>[0]
      const [session] = await db
        .select()
        .from(paymentSessions)
        .where(eq(paymentSessions.id, sessionId))
        .limit(1)
      if (!session) return c.json({ error: "Session not found" }, 404)
      if (session.redirectUrl) {
        return c.json({ data: { redirectUrl: session.redirectUrl } })
      }
      const runtime = c.var.container?.resolve(NETOPIA_RUNTIME_CONTAINER_KEY) as
        | ResolvedNetopiaRuntimeOptions
        | undefined
      if (!runtime) {
        return c.json({ error: "Card processor not configured" }, 503)
      }
      const [first, ...rest] = (session.payerName ?? "").trim().split(/\s+/)
      const last = rest.length > 0 ? rest.join(" ") : "Customer"
      try {
        const started = await netopiaService.startPaymentSession(
          dbCast,
          sessionId,
          {
            billing: {
              email: session.payerEmail ?? "tbd@example.com",
              phone: "0000000000",
              firstName: first || "Customer",
              lastName: last,
              city: "TBD",
              country: 642,
              state: "TBD",
              postalCode: "00000",
              details: "Pending — customer to confirm at payment.",
            },
            description: session.notes ?? `Payment ${sessionId}`,
          },
          runtime,
          undefined,
        )
        return c.json({
          data: {
            redirectUrl:
              started.session.redirectUrl ?? started.providerResponse.payment?.paymentURL ?? null,
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start card payment"
        return c.json({ error: message }, 502)
      }
    })

    // GET /v1/public/bookings/:bookingId/checkout-status — minimal
    // customer-facing status for the storefront confirmation page.
    // It intentionally exposes only non-PII state: booking status and
    // latest payment-session status. The page polls this after a card
    // redirect so it can move from "processing" to "thank you" once
    // the webhook/admin reconciliation has marked the session paid.
    hono.get("/v1/public/bookings/:bookingId/checkout-status", async (c) => {
      const bookingId = c.req.param("bookingId")
      const ref = c.req.query("session") ?? c.req.query("orderId") ?? c.req.query("ref") ?? null
      // Narrow the union to a single drizzle flavor so subsequent `.select`
      // result types stay specific (avoids `session: any` callback inference).
      const db = c.get("db") as PostgresJsDatabase

      const [booking] = await db
        .select({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
          status: bookings.status,
          updatedAt: bookings.updatedAt,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)
      if (!booking) return c.json({ error: "Booking not found" }, 404)

      const sessionRefFilter = ref
        ? or(
            eq(paymentSessions.id, ref),
            eq(paymentSessions.clientReference, ref),
            eq(paymentSessions.externalReference, ref),
            eq(paymentSessions.providerSessionId, ref),
            eq(paymentSessions.providerPaymentId, ref),
          )
        : undefined
      const sessionWhere = sessionRefFilter
        ? and(eq(paymentSessions.bookingId, bookingId), sessionRefFilter)
        : eq(paymentSessions.bookingId, bookingId)

      let sessions = await db
        .select({
          id: paymentSessions.id,
          status: paymentSessions.status,
          amountCents: paymentSessions.amountCents,
          currency: paymentSessions.currency,
          invoiceId: paymentSessions.invoiceId,
          paymentMethod: paymentSessions.paymentMethod,
          completedAt: paymentSessions.completedAt,
          failedAt: paymentSessions.failedAt,
          updatedAt: paymentSessions.updatedAt,
        })
        .from(paymentSessions)
        .where(sessionWhere)
        .orderBy(desc(paymentSessions.createdAt))
        .limit(5)

      // Some processors echo a reference that differs from our
      // payment_sessions id. If the ref-specific lookup missed, fall
      // back to the booking's sessions so a completed payment still
      // unlocks the thank-you state.
      if (sessions.length === 0 && ref) {
        sessions = await db
          .select({
            id: paymentSessions.id,
            status: paymentSessions.status,
            amountCents: paymentSessions.amountCents,
            currency: paymentSessions.currency,
            invoiceId: paymentSessions.invoiceId,
            paymentMethod: paymentSessions.paymentMethod,
            completedAt: paymentSessions.completedAt,
            failedAt: paymentSessions.failedAt,
            updatedAt: paymentSessions.updatedAt,
          })
          .from(paymentSessions)
          .where(eq(paymentSessions.bookingId, bookingId))
          .orderBy(desc(paymentSessions.createdAt))
          .limit(5)
      }

      const paidSession = sessions.find(
        (session) => session.status === "paid" || session.status === "authorized",
      )
      const latestSession = paidSession ?? sessions[0] ?? null
      const isBankTransferSession =
        latestSession?.paymentMethod === "bank_transfer" ||
        (booking.status === "awaiting_payment" && Boolean(latestSession?.invoiceId))
      const bankTransferInstructions =
        isBankTransferSession && latestSession
          ? await buildPublicBankTransferInstructions(
              db as PostgresJsDatabase,
              booking.bookingNumber,
              latestSession,
              c.env as Record<string, unknown>,
            )
          : null
      const failedStatuses = new Set(["failed", "cancelled", "expired"])
      const paymentStatus =
        booking.status === "confirmed" || paidSession
          ? "paid"
          : sessions.length > 0 && sessions.every((session) => failedStatuses.has(session.status))
            ? "failed"
            : "pending"

      return c.json({
        data: {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          bookingStatus: booking.status,
          paymentStatus,
          session: latestSession,
          bankTransferInstructions,
          updatedAt: (latestSession?.updatedAt ?? booking.updatedAt)?.toISOString?.() ?? null,
        },
      })
    })

    mountCatalogMcpRoutes(hono)
    mountCatalogBookingRoutes(hono)
    mountCatalogCheckoutRoutes(hono)
    mountCatalogContentRoutes(hono)
    mountChannelPushAdminRoutes(hono)
    mountFlightRoutes(hono)

    // Workflow runs admin surface — list/get + rerun/resume actions
    // feeding the standalone dashboard SPA in
    // apps/workflow-runs-dashboard. The registry is populated by
    // bundle bootstraps (e.g. catalog-checkout registers the
    // `checkout-finalize` runner).
    mountWorkflowRunsAdminRoutes(hono, {
      runners: workflowRunnerRegistry,
      resolveUserId: (c) => {
        // Hono Context — typed loosely so the package stays
        // transport-agnostic; pull the userId set by the auth
        // middleware. Returns null for runs triggered without an
        // active session (shouldn't happen on the admin surface).
        const ctx = c as { get: (key: string) => unknown }
        const userId = ctx.get("userId")
        return typeof userId === "string" ? userId : null
      },
    })
  },
})
