import { actionLedgerHonoModule } from "@voyantjs/action-ledger"
import { availabilityHonoModule } from "@voyantjs/availability"
import { bookingRequirementsHonoModule } from "@voyantjs/booking-requirements"
import { bookingsSupplierExtension, createBookingsHonoModule } from "@voyantjs/bookings"
import { createCheckoutHonoModule } from "@voyantjs/checkout"
import { createCrmHonoModule, crmBookingExtension, crmService } from "@voyantjs/crm"
import { createCustomerPortalHonoModule } from "@voyantjs/customer-portal"
import { distributionBookingExtension, distributionHonoModule } from "@voyantjs/distribution"
import { externalRefsHonoModule } from "@voyantjs/external-refs"
import { extrasHonoModule } from "@voyantjs/extras"
import { facilitiesHonoModule } from "@voyantjs/facilities"
import {
  bookingsCreateExtension,
  createFinanceHonoModule,
  createVoyantDataFxExchangeRateResolver,
} from "@voyantjs/finance"
import { groundHonoModule } from "@voyantjs/ground"
import { createApp, createPublicDocumentDeliveryHonoModule } from "@voyantjs/hono"
import { identityHonoModule } from "@voyantjs/identity"
import { createLegalHonoModule } from "@voyantjs/legal"
import { marketsHonoModule } from "@voyantjs/markets"
import {
  createDefaultBookingDocumentAttachment,
  createNotificationsHonoModule,
} from "@voyantjs/notifications"
import { pricingHonoModule } from "@voyantjs/pricing"
import { productsBookingExtension, productsHonoModule } from "@voyantjs/products"
import { resourcesHonoModule } from "@voyantjs/resources"
import { sellabilityHonoModule } from "@voyantjs/sellability"
import { createStorefrontHonoModule } from "@voyantjs/storefront"
import { createStorefrontVerificationHonoModule } from "@voyantjs/storefront-verification"
import { suppliersHonoModule } from "@voyantjs/suppliers"
import { transactionsBookingExtension, transactionsHonoModule } from "@voyantjs/transactions"
import { resolveNotificationProviders } from "../lib/notifications"
import { createVideoUploadTicket } from "../lib/video-uploads"
import authHandler, {
  hasAuthPermission,
  resolveAuthRequest,
  validateApiTokenAccess,
} from "./auth/handler"
import { catalogBridgeBundle } from "./catalog-bridge"
import { mountCatalogContentRoutes } from "./catalog-content"
import { createInvitationsRoutes } from "./invitations"
import { dbFromEnvForApp } from "./lib/db"
import {
  createDocumentStorage,
  createMediaStorage,
  guessMimeType,
  resolveDocumentDownloadUrl,
} from "./lib/storage"
import { mountCatalogMcpRoutes, mountCatalogSearchRoutes } from "./mcp"

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
})
const storefrontVerificationHonoModule = createStorefrontVerificationHonoModule({
  resolveProviders: resolveNotificationProviders,
  email: {
    subject: "Your verification code",
  },
})
const storefrontHonoModule = createStorefrontHonoModule()
const checkoutHonoModule = createCheckoutHonoModule({
  resolveProviders: resolveNotificationProviders,
})
const customerPortalHonoModule = createCustomerPortalHonoModule({
  resolveDocumentDownloadUrl: (bindings, storageKey) =>
    resolveDocumentDownloadUrl(bindings as CloudflareBindings, storageKey),
})

const financeModule = createFinanceHonoModule({
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
    resolveDocumentDownloadUrl(bindings as unknown as CloudflareBindings, storageKey),
  resolveInvoiceExchangeRateResolver: (bindings) => {
    const env = bindings as unknown as CloudflareBindings
    return createVoyantDataFxExchangeRateResolver({
      apiKey: env.VOYANT_CLOUD_API_KEY,
      baseUrl: env.VOYANT_CLOUD_API_URL,
    })
  },
})
const legalModule = createLegalHonoModule({
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
    resolveDocumentDownloadUrl(bindings as unknown as CloudflareBindings, storageKey),
  resolveDocumentStorage: (bindings) =>
    createDocumentStorage(bindings as unknown as CloudflareBindings),
})

const publicDocumentDeliveryModule = createPublicDocumentDeliveryHonoModule<CloudflareBindings>({
  resolveStorage: createDocumentStorage,
})

const crmHonoModule = createCrmHonoModule()
const bookingsHonoModule = createBookingsHonoModule({
  resolveTravelSnapshot: (db, personId, { kms }) =>
    crmService.loadPersonTravelSnapshot(db, personId, { kms }),
  // Storefront booking session bootstrap + update flows hand the
  // billing contact and per-traveler snapshots to this resolver, which
  // dedupes by normalized email/phone via `identity_contact_points` and
  // upserts a CRM person on miss. Returns the resolved person id (or
  // `null` to skip linkage on this row). See issue #961.
  resolveBillingPerson: async (db, contact, ctx) => {
    const person = await crmService.upsertPersonFromContact(db, contact, {
      source: ctx.source,
      sourceRef: ctx.sourceRef,
    })
    return person?.id ?? null
  },
  resolveTravelerPerson: async (db, contact, ctx) => {
    const person = await crmService.upsertPersonFromContact(db, contact, {
      source: ctx.source,
      sourceRef: ctx.sourceRef,
    })
    return person?.id ?? null
  },
})

export const app = createApp<CloudflareBindings>({
  // `dbFromEnvForApp` returns `{ db, dispose }`; the Hono db middleware
  // schedules `dispose()` via `executionCtx.waitUntil` after the
  // response is sent, so each request gets its own Pool and closes it
  // before the isolate sleeps.
  db: (env) => dbFromEnvForApp(env),
  publicPaths: [
    "/v1/public/customer-portal/contact-exists",
    "/v1/public/storefront-verification",
    "/v1/public/checkout",
    "/v1/public/documents",
    "/v1/public/invitations",
    "/v1/public/leads",
    "/v1/public/newsletter",
  ],
  modules: [
    actionLedgerHonoModule,
    crmHonoModule,
    availabilityHonoModule,
    facilitiesHonoModule,
    groundHonoModule,
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
    publicDocumentDeliveryModule,
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
  plugins: [catalogBridgeBundle],
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

    // GET /v1/admin/documents/files/* — admin-only stream of private document bytes.
    hono.get("/v1/admin/documents/files/*", async (c) => {
      const storage = createDocumentStorage(c.env)
      if (!storage) {
        return c.json({ error: "Storage not configured" }, 503)
      }

      const rawKey = c.req.path.replace("/v1/admin/documents/files/", "")
      const key = rawKey
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/")
      if (!key) return c.json({ error: "Missing key" }, 400)

      const buffer = await storage.get(key)
      if (!buffer) return c.json({ error: "Not found" }, 404)

      const headers = new Headers()
      headers.set("Content-Type", guessMimeType(key))
      headers.set("Cache-Control", "private, no-store")
      headers.set("Content-Length", String(buffer.byteLength))
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

    mountCatalogMcpRoutes(hono)
    mountCatalogSearchRoutes(hono)
    mountCatalogContentRoutes(hono)
  },
})
