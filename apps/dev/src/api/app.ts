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
import { createFinanceHonoModule } from "@voyantjs/finance"
import { groundHonoModule } from "@voyantjs/ground"
import { createApp } from "@voyantjs/hono"
import { hospitalityHonoModule } from "@voyantjs/hospitality"
import { identityHonoModule } from "@voyantjs/identity"
import { marketsHonoModule } from "@voyantjs/markets"
import {
  createDefaultBookingDocumentAttachment,
  createNotificationsHonoModule,
} from "@voyantjs/notifications"
import { octoHonoModule } from "@voyantjs/octo"
import { pricingHonoModule } from "@voyantjs/pricing"
import { productsBookingExtension, productsHonoModule } from "@voyantjs/products"
import { resourcesHonoModule } from "@voyantjs/resources"
import { sellabilityHonoModule } from "@voyantjs/sellability"
import { createStorefrontHonoModule } from "@voyantjs/storefront"
import { suppliersHonoModule } from "@voyantjs/suppliers"
import { transactionsBookingExtension, transactionsHonoModule } from "@voyantjs/transactions"
import { resolveNotificationProviders } from "../lib/notifications"
import authHandler, { hasAuthPermission, resolveAuthRequest } from "./auth/handler"
import { getDashboardSummary } from "./dashboard-summary"
import { createInvitationsRoutes } from "./invitations"
import { getDbFromHyperdrive } from "./lib/db"
import { createMediaStorage, guessMimeType, resolveDocumentDownloadUrl } from "./lib/storage"

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
})

const crmHonoModule = createCrmHonoModule()
const bookingsHonoModule = createBookingsHonoModule({
  resolveTravelSnapshot: (db, personId, { kms }) =>
    crmService.loadPersonTravelSnapshot(db, personId, { kms }),
})

export const app = createApp<CloudflareBindings>({
  db: (env) => getDbFromHyperdrive(env),
  publicPaths: [
    "/v1/public/customer-portal/contact-exists",
    "/v1/public/checkout",
    "/v1/public/invitations",
  ],
  modules: [
    actionLedgerHonoModule,
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
    octoHonoModule,
    transactionsHonoModule,
    resourcesHonoModule,
    sellabilityHonoModule,
    distributionHonoModule,
    suppliersHonoModule,
    productsHonoModule,
    bookingsHonoModule,
    financeModule,
    storefrontHonoModule,
    customerPortalHonoModule,
    checkoutHonoModule,
  ],
  extensions: [
    bookingsSupplierExtension,
    productsBookingExtension,
    crmBookingExtension,
    transactionsBookingExtension,
    distributionBookingExtension,
  ],
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

    hono.get("/v1/dashboard/summary", async (c) => {
      return c.json(await getDashboardSummary(c.get("db")))
    })

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
  },
})
