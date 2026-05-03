import { availabilityHonoModule } from "@voyantjs/availability"
import { bookingRequirementsHonoModule } from "@voyantjs/booking-requirements"
import { bookingsHonoModule, bookingsSupplierExtension } from "@voyantjs/bookings"
import {
  type CheckoutBankTransferDetails,
  type CheckoutPaymentStarter,
  createCheckoutHonoModule,
} from "@voyantjs/checkout"
import { crmBookingExtension, crmHonoModule } from "@voyantjs/crm"
import { createCustomerPortalHonoModule } from "@voyantjs/customer-portal"
import { distributionBookingExtension, distributionHonoModule } from "@voyantjs/distribution"
import { externalRefsHonoModule } from "@voyantjs/external-refs"
import { extrasHonoModule } from "@voyantjs/extras"
import {
  bookingsQuickCreateExtension,
  createFinanceHonoModule,
  financeService,
} from "@voyantjs/finance"
import { paymentSessions } from "@voyantjs/finance/schema"
import { createApp } from "@voyantjs/hono"
import { identityHonoModule } from "@voyantjs/identity"
import { createLegalHonoModule, createPdfContractDocumentGenerator } from "@voyantjs/legal"
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
import { productsBookingExtension, productsHonoModule } from "@voyantjs/products"
import { resourcesHonoModule } from "@voyantjs/resources"
import { sellabilityHonoModule } from "@voyantjs/sellability"
import { createStorefrontHonoModule } from "@voyantjs/storefront"
import { createStorefrontVerificationHonoModule } from "@voyantjs/storefront-verification"
import { suppliersHonoModule } from "@voyantjs/suppliers"
import { transactionsBookingExtension, transactionsHonoModule } from "@voyantjs/transactions"
import { eq, or } from "drizzle-orm"
import { resolveNotificationProviders } from "../lib/notifications"
import { createVideoUploadTicket } from "../lib/video-uploads"
import authHandler, { hasAuthPermission, resolveAuthRequest } from "./auth/handler"
import { mountCatalogBookingRoutes } from "./catalog-booking"
import { catalogBridgeBundle } from "./catalog-bridge"
import { mountCatalogContentRoutes } from "./catalog-content"
import { mountCatalogSearchRoutes } from "./catalog-search"
import { channelPushBundle, mountChannelPushAdminRoutes } from "./channel-push"
import { mountFlightRoutes } from "./flights"
import { createInvitationsRoutes } from "./invitations"
import { getDbFromHyperdrive } from "./lib/db"
import {
  createDocumentStorage,
  createMediaStorage,
  guessMimeType,
  resolveDocumentDownloadUrl,
} from "./lib/storage"
import { mountCatalogMcpRoutes } from "./mcp"

const notificationsHonoModule = createNotificationsHonoModule({
  resolveProviders: resolveNotificationProviders,
  resolveDocumentAttachmentResolver: (bindings) => async (document) => {
    if (document.storageKey) {
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
  // `getDbFromHyperdrive` returns either drizzle flavor (postgres-js or
  // neon-http) depending on env. `resolveDb` accepts the union via
  // `AnyDrizzleDb`, so no double-cast is needed here.
  resolveDb: (bindings) => getDbFromHyperdrive(bindings as unknown as CloudflareBindings),
  autoConfirmAndDispatch: {
    enabled: true,
    templateSlug: "booking-confirmation",
  },
})
const storefrontVerificationHonoModule = createStorefrontVerificationHonoModule({
  resolveProviders: resolveNotificationProviders,
  email: {
    subject: "Your verification code",
  },
})
const storefrontHonoModule = createStorefrontHonoModule()

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

const checkoutHonoModule = createCheckoutHonoModule({
  resolveProviders: resolveNotificationProviders,
  resolvePaymentStarters: (): Record<string, CheckoutPaymentStarter> => ({
    netopia: netopiaCheckoutStarter,
  }),
  resolveBankTransferDetails,
})
const customerPortalHonoModule = createCustomerPortalHonoModule({
  resolveDocumentDownloadUrl: (bindings, storageKey) =>
    resolveDocumentDownloadUrl(bindings as CloudflareBindings, storageKey),
})

const financeModule = createFinanceHonoModule({
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
    resolveDocumentDownloadUrl(bindings as unknown as CloudflareBindings, storageKey),
})
const legalModule = createLegalHonoModule({
  // `getDbFromHyperdrive` returns either drizzle flavor; `resolveDb` accepts
  // the union via `AnyDrizzleDb`, so no double-cast is needed here.
  resolveDb: (bindings) => getDbFromHyperdrive(bindings as unknown as CloudflareBindings),
  resolveDocumentDownloadUrl: (bindings, storageKey) =>
    resolveDocumentDownloadUrl(bindings as unknown as CloudflareBindings, storageKey),
  // Wire a PDF document generator against the private DOCUMENTS_BUCKET so
  // auto-generated contracts + manual regeneration land in R2. Returning
  // `undefined` when no bucket is configured keeps the module wired but
  // inert — the generate-document endpoint falls back to a 501.
  resolveDocumentGenerator: (bindings) => {
    const storage = createDocumentStorage(bindings as unknown as CloudflareBindings)
    if (!storage) return undefined
    return createPdfContractDocumentGenerator({ storage })
  },
  // Opt into the booking.confirmed subscriber. Template slug must match a
  // row in `contract_templates`; seed one named "customer-services" via
  // the admin UI (see the template README) or via a DB migration.
  // Opt into the booking.confirmed subscriber. `templateSlug` must match a
  // row in `contract_templates` that has a `currentVersionId` pointing at a
  // template version with Liquid body. The operator seed script creates
  // `customer-sales-agreement` with a Liquid body + published version; any
  // other slug is fine as long as it exists before the first confirm.
  autoGenerateContractOnConfirmed: {
    enabled: true,
    templateSlug: "customer-sales-agreement",
    scope: "customer",
    language: "en",
  },
})

export const app = createApp<CloudflareBindings>({
  db: (env) => getDbFromHyperdrive(env),
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
    // Netopia webhook receiver. Netopia's servers POST here without a
    // session cookie or bearer; the plugin handler matches the inbound
    // payload to a payment session by orderID and validates the
    // processor's response shape. This is the URL set in
    // `NETOPIA_NOTIFY_URL`.
    "/v1/finance/providers/netopia/callback",
  ],
  modules: [
    crmHonoModule,
    availabilityHonoModule,
    identityHonoModule,
    notificationsHonoModule,
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
    bookingsHonoModule,
    financeModule,
    legalModule,
    storefrontHonoModule,
    customerPortalHonoModule,
    storefrontVerificationHonoModule,
    checkoutHonoModule,
  ],
  extensions: [
    bookingsSupplierExtension,
    bookingsQuickCreateExtension,
    productsBookingExtension,
    crmBookingExtension,
    transactionsBookingExtension,
    distributionBookingExtension,
  ],
  plugins: [catalogBridgeBundle, channelPushBundle, netopiaHonoBundle()],
  auth: {
    handler: () => ({
      fetch: async (request, env, ctx) =>
        authHandler.fetch(request, env, ctx as ExecutionContext | undefined),
    }),
    resolve: async ({ request, env }) => resolveAuthRequest(request, env),
    hasPermission: async ({ request, env }) => hasAuthPermission(request, env),
  },
  additionalRoutes: (hono) => {
    // Admin-issued invitation flow (single-tenant sign-up is otherwise gated
    // at the Better Auth layer).
    hono.route("/", createInvitationsRoutes())

    // POST /v1/uploads — upload public/editorial media via the configured
    // media storage provider. Sensitive documents should use private
    // document-aware flows instead of this route.
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
      const bankTransfer = resolveBankTransferDetails(c.env as Record<string, unknown>)
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
      const db = getDbFromHyperdrive(c.env)
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
      const db = getDbFromHyperdrive(c.env)
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
      const db = getDbFromHyperdrive(c.env)
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

    mountCatalogMcpRoutes(hono)
    mountCatalogSearchRoutes(hono)
    mountCatalogBookingRoutes(hono)
    mountCatalogContentRoutes(hono)
    mountChannelPushAdminRoutes(hono)
    mountFlightRoutes(hono)
  },
})
