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
import { bookingsQuickCreateExtension, createFinanceHonoModule } from "@voyantjs/finance"
import { groundHonoModule } from "@voyantjs/ground"
import { createApp } from "@voyantjs/hono"
import { hospitalityHonoModule } from "@voyantjs/hospitality"
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
import authHandler, { hasAuthPermission, resolveAuthRequest } from "./auth/handler"
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

function requireCloudflareBindings(bindings: unknown): CloudflareBindings {
  if (!bindings || typeof bindings !== "object") {
    throw new Error("Cloudflare bindings are required")
  }
  return bindings as CloudflareBindings
}

const notificationsHonoModule = createNotificationsHonoModule({
  resolveProviders: resolveNotificationProviders,
  resolveDocumentAttachmentResolver: (bindings) => async (document) => {
    if (document.storageKey) {
      const path = await resolveDocumentDownloadUrl(
        requireCloudflareBindings(bindings),
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
    resolveDocumentDownloadUrl(requireCloudflareBindings(bindings), storageKey),
})

const financeModule = createFinanceHonoModule({
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
    resolveDocumentDownloadUrl(requireCloudflareBindings(bindings), storageKey),
})
const legalModule = createLegalHonoModule({
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
    resolveDocumentDownloadUrl(requireCloudflareBindings(bindings), storageKey),
  resolveDocumentStorage: (bindings) => createDocumentStorage(requireCloudflareBindings(bindings)),
})

const crmHonoModule = createCrmHonoModule()
const bookingsHonoModule = createBookingsHonoModule({
  resolveTravelSnapshot: (db, personId, { kms }) =>
    crmService.loadPersonTravelSnapshot(db, personId, { kms }),
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
    "/v1/public/invitations",
    "/v1/public/bookings",
    "/v1/public/leads",
    "/v1/public/newsletter",
  ],
  modules: [
    crmHonoModule,
    availabilityHonoModule,
    facilitiesHonoModule,
    hospitalityHonoModule,
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
  plugins: [catalogBridgeBundle],
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

    mountCatalogMcpRoutes(hono)
    mountCatalogSearchRoutes(hono)
    mountCatalogContentRoutes(hono)
  },
})
