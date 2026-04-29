import { availabilityHonoModule } from "@voyantjs/availability"
import { bookingRequirementsHonoModule } from "@voyantjs/booking-requirements"
import { bookingsHonoModule, bookingsSupplierExtension } from "@voyantjs/bookings"
import { createCheckoutHonoModule } from "@voyantjs/checkout"
import { crmBookingExtension, crmHonoModule } from "@voyantjs/crm"
import { createCustomerPortalHonoModule } from "@voyantjs/customer-portal"
import { distributionBookingExtension, distributionHonoModule } from "@voyantjs/distribution"
import { externalRefsHonoModule } from "@voyantjs/external-refs"
import { extrasHonoModule } from "@voyantjs/extras"
import { bookingsQuickCreateExtension, createFinanceHonoModule } from "@voyantjs/finance"
import { createApp } from "@voyantjs/hono"
import { identityHonoModule } from "@voyantjs/identity"
import { createLegalHonoModule, createPdfContractDocumentGenerator } from "@voyantjs/legal"
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
import { createInvitationsRoutes } from "./invitations"
import { getDbFromHyperdrive } from "./lib/db"
import {
  createDocumentStorage,
  createMediaStorage,
  guessMimeType,
  resolveDocumentDownloadUrl,
} from "./lib/storage"

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
  },
})
