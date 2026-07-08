// agent-quality: file-size exception -- this is the lazy counterpart to the
// framework's standard composition registry: one small metadata/loader factory
// per standard module or extension. Keeping it together preserves manifest-order
// reviewability while avoiding value imports of the standard module graph.
import { OpenAPIHono } from "@hono/zod-openapi"
import type {
  BookingRequirementsHonoModuleOptions,
  BookingsHonoModuleOptions,
} from "@voyant-travel/bookings"
import type { CatalogSearchRoutesOptions } from "@voyant-travel/catalog"
import {
  bulkReindexProductsWorkflowManifest,
  promotionAffectedAllFilter,
} from "@voyant-travel/commerce/promotions/workflow-bulk-reindex-manifest"
import type { BootstrapHandler } from "@voyant-travel/core"
import type { CheckoutNotificationDelivery } from "@voyant-travel/finance/checkout"
import type { CheckoutReminderRunRecord } from "@voyant-travel/finance/checkout-validation"
import type { LazyRoutesLoader } from "@voyant-travel/hono"
import type { CompositionRegistry } from "@voyant-travel/hono/composition"
import type { HonoExtension, HonoModule } from "@voyant-travel/hono/module"
import type { CreateLegalHonoModuleOptions } from "@voyant-travel/legal"
import type { CreateNotificationsHonoModuleOptions } from "@voyant-travel/notifications"
import type { relationshipsService } from "@voyant-travel/relationships"
import type { StorefrontIntakePersistence } from "@voyant-travel/storefront"
import type { StorefrontVerificationRoutesOptions } from "@voyant-travel/storefront/verification"
import type { TripsRoutesOptionsProvider } from "@voyant-travel/trips"
import type { Hono } from "hono"

// biome-ignore lint/suspicious/noExplicitAny: lazy sub-apps keep route-specific Hono env generics -- owner: framework composition.
type AnyHono = Hono<any>

type FrameworkRelationshipsService = Pick<
  typeof relationshipsService,
  "getPersonById" | "getOrganizationById" | "loadPersonTravelSnapshot" | "upsertPersonFromContact"
>

export interface FrameworkProviders {
  relationshipsService: FrameworkRelationshipsService
  closePaymentSchedulesForBooking: NonNullable<
    BookingsHonoModuleOptions["closePaymentSchedulesForBooking"]
  >
  recordCancellationFinancialSettlement?: BookingsHonoModuleOptions["recordCancellationFinancialSettlement"]
  customFields?: BookingsHonoModuleOptions["customFields"]
  resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) => Promise<string | null>
  resolveNotificationProviders: NonNullable<StorefrontVerificationRoutesOptions["resolveProviders"]>
  createTripsRoutesOptions: TripsRoutesOptionsProvider
  resolveDb: NonNullable<CreateLegalHonoModuleOptions["resolveDb"]>
  createOperatorDocumentStorage: NonNullable<CreateLegalHonoModuleOptions["resolveDocumentStorage"]>
  resolveContractDocumentGenerator: NonNullable<
    CreateLegalHonoModuleOptions["resolveDocumentGenerator"]
  >
  createBookingPiiService: NonNullable<CreateLegalHonoModuleOptions["resolveBookingPiiService"]>
  autoGenerateContractOnConfirmed: NonNullable<
    CreateLegalHonoModuleOptions["autoGenerateContractOnConfirmed"]
  >
  resolvePublicCheckoutBaseUrl: NonNullable<
    CreateNotificationsHonoModuleOptions["resolvePublicCheckoutBaseUrl"]
  >
  readDocumentContentBase64: (bindings: unknown, storageKey: string) => Promise<string | null>
  resolveBookingRequirementsProductSnapshot: NonNullable<
    NonNullable<BookingRequirementsHonoModuleOptions["publicRoutes"]>["resolveProductSnapshot"]
  >
  resolveCatalogRuntime: CatalogSearchRoutesOptions["resolveRuntime"]
  storefrontIntakePersistence: StorefrontIntakePersistence
  createInvoiceExchangeRateResolver: NonNullable<
    import("@voyant-travel/finance").FinanceHonoModuleOptions["resolveInvoiceExchangeRateResolver"]
  >
  createInvoiceSettlementPollers: NonNullable<
    import("@voyant-travel/finance").FinanceHonoModuleOptions["resolveInvoiceSettlementPollers"]
  >
  resolveBankTransferDetails: NonNullable<
    import("@voyant-travel/finance").FinanceHonoModuleOptions["resolveBankTransferDetails"]
  >
  financeCheckoutPolicy?: import("@voyant-travel/finance").FinanceHonoModuleOptions["policy"]
  financePaymentScheduleLineDescriptionFormat?: import("@voyant-travel/finance").FinanceHonoModuleOptions["paymentScheduleLineDescriptionFormat"]
  resolvePaymentStarters?: import("@voyant-travel/finance").FinanceHonoModuleOptions["resolvePaymentStarters"]
  resolveCardPaymentStarter?: (
    bindings: unknown,
  ) => import("@voyant-travel/finance/card-payment").CardPaymentStarter | null
  notificationsAutoConfirmAndDispatch?: CreateNotificationsHonoModuleOptions["autoConfirmAndDispatch"]
  createChannelPushExtension: () => HonoExtension
  loadFlightAdminRoutes: LazyRoutesLoader
  loadMcpAdminRoutes: LazyRoutesLoader
  loadCatalogBookingRoutes: LazyRoutesLoader
  loadCatalogContentRoutes: LazyRoutesLoader
  loadMediaRoutes: LazyRoutesLoader
  loadPaymentLinkRoutes: LazyRoutesLoader
  loadContractDocumentRoutes: LazyRoutesLoader
  loadBookingScheduleAdminRoutes: LazyRoutesLoader
  loadPaymentPolicyPublicRoutes: LazyRoutesLoader
  loadQuoteVersionSnapshotRoutes: LazyRoutesLoader
  loadBookingMaintenanceRoutes: LazyRoutesLoader
  loadActionLedgerHealthRoutes: LazyRoutesLoader
  loadProposalAdminRoutes: LazyRoutesLoader
  loadProposalPublicRoutes: LazyRoutesLoader
  loadCatalogOffersRoutes: LazyRoutesLoader
  loadCatalogCheckoutRoutes: LazyRoutesLoader
}

type LazyUnit<T> = {
  load: () => Promise<T[]>
  route: (select: (unit: T) => AnyHono | undefined) => LazyRoutesLoader
  bootstrap: BootstrapHandler
}

function unitBootstrap<
  T extends {
    module?: { bootstrap?: BootstrapHandler }
    extension?: { bootstrap?: BootstrapHandler }
  },
>(unit: T) {
  return unit.module?.bootstrap ?? unit.extension?.bootstrap
}

function createLazyUnit<
  T extends {
    module?: { name?: string; bootstrap?: BootstrapHandler }
    extension?: { name?: string; module?: string; bootstrap?: BootstrapHandler }
  },
>(load: () => Promise<T | T[]>): LazyUnit<T> {
  let unitsPromise: Promise<T[]> | undefined
  let bootstrapPromise: Promise<void> | undefined

  const loadUnits = async () => {
    unitsPromise ??= load().then((unit) => (Array.isArray(unit) ? unit : [unit]))
    return unitsPromise
  }

  const bootstrap = async (ctx: Parameters<BootstrapHandler>[0]) => {
    if (!bootstrapPromise) {
      bootstrapPromise = loadUnits()
        .then(async (units) => {
          for (const unit of units) {
            await unitBootstrap(unit)?.(ctx)
          }
        })
        .catch((error) => {
          bootstrapPromise = undefined
          throw error
        })
    }
    await bootstrapPromise
  }

  return {
    load: loadUnits,
    bootstrap,
    route: (select) => async (): Promise<AnyHono> => {
      const units = await loadUnits()
      const routes = units.map(select).filter((route): route is AnyHono => Boolean(route))
      if (routes.length === 0) return new OpenAPIHono()
      if (routes.length === 1) return routes[0]!

      const wrapped = new OpenAPIHono()
      for (const route of routes) wrapped.route("/", route)
      return wrapped
    },
  }
}

function withAnonymous(module: HonoModule, anonymous: HonoModule["anonymous"]): HonoModule {
  return { ...module, anonymous }
}

const CATALOG_BOOKING_ROUTE_PATHS = [
  "/v1/admin/catalog/quote",
  "/v1/admin/catalog/quotes/batch",
  "/v1/admin/catalog/book",
  "/v1/admin/catalog/drafts/:id",
  "/v1/admin/catalog/holds/place",
  "/v1/admin/catalog/holds/release",
  "/v1/admin/catalog/slots",
  "/v1/admin/catalog/orders",
  "/v1/admin/catalog/orders/:id",
  "/v1/admin/catalog/orders/:id/cancel",
  "/v1/admin/bookings/:id/catalog-snapshot",
  "/v1/public/catalog/quote",
  "/v1/public/catalog/quotes/batch",
  "/v1/public/catalog/book",
  "/v1/public/catalog/drafts/:id",
  "/v1/public/catalog/holds/place",
  "/v1/public/catalog/holds/release",
  "/v1/public/catalog/slots",
] as const

const CATALOG_BOOKING_TRANSACTIONAL_PATHS = [
  "/v1/admin/catalog/quote",
  "/v1/admin/catalog/quotes/batch",
  "/v1/admin/catalog/book",
  "/v1/admin/catalog/holds",
  "/v1/admin/catalog/orders",
  "/v1/public/catalog/quote",
  "/v1/public/catalog/quotes/batch",
  "/v1/public/catalog/book",
  "/v1/public/catalog/holds",
] as const

const CATALOG_CONTENT_ROUTE_PATHS = [
  "/v1/admin/products/:id/content",
  "/v1/public/products/:id/content",
  "/v1/admin/cruises/:id/content",
  "/v1/public/cruises/:id/content",
  "/v1/admin/cruises/:id/sailings/:sailingExternalId/pricing",
  "/v1/public/cruises/:id/sailings/:sailingExternalId/pricing",
  "/v1/admin/accommodations/:id/content",
  "/v1/public/accommodations/:id/content",
] as const

const MEDIA_ROUTE_PATHS = [
  "/v1/admin/products/:id/brochure/generate",
  "/v1/admin/uploads",
  "/v1/admin/uploads/video",
  "/v1/admin/media/*",
] as const

const PAYMENT_LINK_ROUTE_PATHS = [
  "/v1/public/payment-link-config",
  "/v1/public/payment-link/:sessionId/retry",
  "/v1/public/payment-link/resolve",
  "/v1/public/payment-link/:sessionId/start-card",
  "/v1/public/payment-link/:sessionId/trip-summary",
  "/v1/public/payment-link/:sessionId/booking-summary",
  "/v1/public/bookings/:bookingId/checkout-status",
] as const

type NotificationDeliveryLike = {
  id: string
  templateSlug: string | null
  channel: "email" | "sms"
  provider: string
  status: "pending" | "sent" | "failed" | "cancelled"
  toAddress: string
  subject: string | null
  sentAt: Date | string | null
  failedAt: Date | string | null
  errorMessage: string | null
}

function optionalDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function toCheckoutNotificationDelivery(
  delivery: NotificationDeliveryLike | null,
): CheckoutNotificationDelivery | null {
  if (!delivery) return null
  return {
    id: delivery.id,
    templateSlug: delivery.templateSlug,
    channel: delivery.channel,
    provider: delivery.provider,
    status: delivery.status,
    toAddress: delivery.toAddress,
    subject: delivery.subject,
    sentAt: optionalDateTime(delivery.sentAt),
    failedAt: optionalDateTime(delivery.failedAt),
    errorMessage: delivery.errorMessage,
  }
}

function toCheckoutReminderRun(run: {
  id: string
  reminderRuleId: string
  reminderRule: { slug: string; name: string; channel: "email" | "sms"; provider: string | null }
  targetType: CheckoutReminderRunRecord["targetType"]
  targetId: string
  links: {
    bookingId: string | null
    paymentSessionId: string | null
    notificationDeliveryId: string | null
  }
  status: CheckoutReminderRunRecord["status"]
  delivery?: {
    status: CheckoutReminderRunRecord["deliveryStatus"]
    channel: "email" | "sms"
    provider: string | null
  } | null
  recipient: string | null
  scheduledFor: Date | string
  processedAt: Date | string | null
  errorMessage: string | null
  createdAt: Date | string
}): CheckoutReminderRunRecord {
  return {
    id: run.id,
    reminderRuleId: run.reminderRuleId,
    reminderRuleSlug: run.reminderRule.slug,
    reminderRuleName: run.reminderRule.name,
    targetType: run.targetType,
    targetId: run.targetId,
    bookingId: run.links.bookingId,
    paymentSessionId: run.links.paymentSessionId,
    notificationDeliveryId: run.links.notificationDeliveryId,
    status: run.status,
    deliveryStatus: run.delivery?.status ?? null,
    channel: run.delivery?.channel ?? run.reminderRule.channel,
    provider: run.delivery?.provider ?? run.reminderRule.provider ?? null,
    recipient: run.recipient,
    scheduledFor: optionalDateTime(run.scheduledFor) ?? "",
    processedAt: optionalDateTime(run.processedAt) ?? "",
    errorMessage: run.errorMessage,
    relativeDaysFromDueDate: null,
    createdAt: optionalDateTime(run.createdAt) ?? "",
  }
}

export const frameworkComposition: CompositionRegistry<FrameworkProviders> = {
  modules: {
    "@voyant-travel/action-ledger": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/action-ledger").then((m) => m.actionLedgerHonoModule),
      )
      return {
        module: { name: "action-ledger" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/relationships": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/relationships").then((m) =>
          m.createRelationshipsHonoModule({ customFields: capabilities.customFields }),
        ),
      )
      return {
        module: { name: "relationships", requiresTransactionalDb: true },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/quotes": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/quotes").then((m) =>
          m.createQuotesHonoModule({
            resolveParticipantPersonById: async (db, personId) =>
              (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
          }),
        ),
      )
      return {
        module: { name: "quotes", requiresTransactionalDb: true },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/accommodations": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/accommodations").then((m) => m.accommodationsHonoModule),
      )
      return {
        module: { name: "accommodations", requiresTransactionalDb: true },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/operations": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/operations").then((m) => m.operationsHonoModule),
      )
      return {
        module: { name: "operations", requiresTransactionalDb: true },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/identity": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/identity").then((m) => m.identityHonoModule),
      )
      return { module: { name: "identity" }, lazyAdminRoutes: unit.route((m) => m.adminRoutes) }
    },
    "@voyant-travel/distribution": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/distribution").then((m) => [
          m.externalRefsHonoModule,
          m.distributionHonoModule,
          m.suppliersHonoModule,
        ]),
      )
      return ["external-refs", "distribution", "suppliers"].map((name) => ({
        module: { name },
        lazyAdminRoutes: unit.route((modules) =>
          modules.module.name === name ? modules.adminRoutes : undefined,
        ),
      }))
    },
    "@voyant-travel/commerce": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/commerce").then((m) => m.createCommerceHonoModules()),
      )
      const moduleMetadata = {
        pricing: { name: "pricing" },
        markets: { name: "markets" },
        sellability: { name: "sellability" },
        promotions: {
          name: "promotions",
          workflows: [bulkReindexProductsWorkflowManifest],
          eventFilters: [promotionAffectedAllFilter],
        },
      } satisfies Record<string, HonoModule["module"]>

      return (Object.keys(moduleMetadata) as Array<keyof typeof moduleMetadata>).map((name) => {
        const anonymous = name === "markets" ? true : undefined
        return withAnonymous(
          {
            module: moduleMetadata[name],
            lazyAdminRoutes: unit.route((modules) =>
              modules.module.name === name ? modules.adminRoutes : undefined,
            ),
            lazyPublicRoutes: unit.route((modules) =>
              modules.module.name === name ? modules.publicRoutes : undefined,
            ),
          },
          anonymous,
        )
      })
    },
    "@voyant-travel/inventory": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/inventory").then((m) => m.inventoryHonoModule),
      )
      return {
        module: { name: "products" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
        lazyPublicRoutes: unit.route((m) => m.publicRoutes),
      }
    },
    "@voyant-travel/inventory/extras": () => {
      const unit = createLazyUnit(async () => {
        const [{ OpenAPIHono }, { openApiValidationHook }, inventory, bookings] = await Promise.all(
          [
            import("@hono/zod-openapi"),
            import("@voyant-travel/hono"),
            import("@voyant-travel/inventory/extras"),
            import("@voyant-travel/bookings/extras"),
          ],
        )
        const adminRoutes = new OpenAPIHono({ defaultHook: openApiValidationHook })
          .route("/", inventory.inventoryExtrasRoutes)
          .route("/", bookings.bookingsExtrasRoutes)
        return { module: { name: "extras" }, adminRoutes } satisfies HonoModule
      })
      return { module: { name: "extras" }, lazyAdminRoutes: unit.route((m) => m.adminRoutes) }
    },
    "@voyant-travel/bookings/requirements": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/bookings/requirements").then((m) =>
          m.createBookingRequirementsHonoModule({
            publicRoutes: {
              resolveProductSnapshot: capabilities.resolveBookingRequirementsProductSnapshot,
            },
          }),
        ),
      )
      return {
        module: { name: "booking-requirements" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
        lazyPublicRoutes: unit.route((m) => m.publicRoutes),
      }
    },
    "@voyant-travel/catalog": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/catalog").then((m) =>
          m.createCatalogSearchHonoModule({
            resolveRuntime: capabilities.resolveCatalogRuntime,
            executeSearch: ({ adapter, embeddings, slice, request }) =>
              m.executeSemanticSearch({
                adapter,
                embeddings: embeddings as Parameters<
                  typeof m.executeSemanticSearch
                >[0]["embeddings"],
                slice,
                request,
              }),
          }),
        ),
      )
      return withAnonymous(
        {
          module: { name: "catalog" },
          lazyAdminRoutes: unit.route((m) => m.adminRoutes),
          lazyPublicRoutes: unit.route((m) => m.publicRoutes),
        },
        true,
      )
    },
    "@voyant-travel/storefront": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/storefront").then(async (m) => {
          const commerce = await import("@voyant-travel/commerce")
          return m.createStorefrontHonoModule({
            offers: commerce.createCommerceStorefrontOfferResolvers(),
            bookingIntents: { resolveDb: capabilities.resolveDb },
            intake: { persistence: capabilities.storefrontIntakePersistence },
          })
        }),
      )
      return {
        module: { name: "storefront", bootstrap: unit.bootstrap },
        publicPath: "/",
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
        lazyPublicRoutes: unit.route((m) => m.publicRoutes),
        anonymous: ["/leads", "/newsletter", "/offers"],
      }
    },
    "@voyant-travel/finance": ({ capabilities }) => {
      const unit = createLazyUnit(async () => {
        const [finance, notifications, settings] = await Promise.all([
          import("@voyant-travel/finance"),
          import("@voyant-travel/notifications"),
          import("@voyant-travel/operator-settings"),
        ])
        return finance.createFinanceHonoModule({
          resolveDocumentDownloadUrl: (bindings: unknown, storageKey: string) =>
            capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
          resolveInvoiceExchangeRateResolver: capabilities.createInvoiceExchangeRateResolver,
          resolveInvoiceSettlementPollers: capabilities.createInvoiceSettlementPollers,
          invoiceDueDateResolver: ({ issueDate, dueDate, bookingPaymentSchedule }) =>
            bookingPaymentSchedule && dueDate < issueDate ? issueDate : dueDate,
          resolveNotificationDispatcher: (bindings) => {
            const providers = capabilities.resolveNotificationProviders(bindings)
            if (providers.length === 0) return null
            const dispatcher = notifications.createNotificationService(providers)
            return {
              sendInvoiceNotification: async (db, invoiceId, input) =>
                toCheckoutNotificationDelivery(
                  await notifications.notificationsService.sendInvoiceNotification(
                    db,
                    dispatcher,
                    invoiceId,
                    input,
                  ),
                ),
              sendPaymentSessionNotification: async (db, paymentSessionId, input) =>
                toCheckoutNotificationDelivery(
                  await notifications.notificationsService.sendPaymentSessionNotification(
                    db,
                    dispatcher,
                    paymentSessionId,
                    input,
                  ),
                ),
            }
          },
          resolvePaymentStarters: capabilities.resolvePaymentStarters,
          policy: capabilities.financeCheckoutPolicy,
          paymentScheduleLineDescriptionFormat:
            capabilities.financePaymentScheduleLineDescriptionFormat,
          resolveBookingTaxSettings: settings.resolveBookingTaxSettings,
          updateBookingTaxSettings: settings.updateBookingTaxSettings,
          resolveBankTransferDetails: capabilities.resolveBankTransferDetails,
          resolvePublicCheckoutBaseUrl: capabilities.resolvePublicCheckoutBaseUrl,
          listBookingReminderRuns: async (db, bookingId, query) => {
            const result = await notifications.notificationsService.listReminderRuns(db, {
              bookingId,
              status: query.status,
              limit: query.limit,
              offset: query.offset,
            })
            return {
              data: result.data.map(toCheckoutReminderRun),
              total: result.total,
              limit: result.limit,
              offset: result.offset,
            }
          },
        })
      })
      return withAnonymous(
        {
          module: { name: "finance", requiresTransactionalDb: true },
          lazyAdminRoutes: unit.route((m) => m.adminRoutes),
          lazyPublicRoutes: unit.route((m) => m.publicRoutes),
        },
        ["/bookings", "/collections", "/payment-sessions", "/accountant", "/vouchers"],
      )
    },
    "@voyant-travel/bookings": ({ capabilities }) => {
      const unit = createLazyUnit(async () => {
        const [bookings, accommodationsOverview] = await Promise.all([
          import("@voyant-travel/bookings"),
          import("@voyant-travel/accommodations/booking-overview-enricher"),
        ])
        return bookings.createBookingsHonoModule({
          resolveTravelSnapshot: (db, personId, { kms }) =>
            capabilities.relationshipsService.loadPersonTravelSnapshot(db, personId, { kms }),
          resolveBillingPerson: async (db, contact, ctx) =>
            (
              await capabilities.relationshipsService.upsertPersonFromContact(db, contact, {
                source: ctx.source,
                sourceRef: ctx.sourceRef,
              })
            )?.id ?? null,
          resolveTravelerPerson: async (db, contact, ctx) =>
            (
              await capabilities.relationshipsService.upsertPersonFromContact(db, contact, {
                source: ctx.source,
                sourceRef: ctx.sourceRef,
                requireContactPoint: true,
              })
            )?.id ?? null,
          resolveBillingPersonById: async (db, personId) =>
            (await capabilities.relationshipsService.getPersonById(db, personId)) != null,
          resolveBillingOrganizationById: async (db, organizationId) =>
            (await capabilities.relationshipsService.getOrganizationById(db, organizationId)) !=
            null,
          closePaymentSchedulesForBooking: capabilities.closePaymentSchedulesForBooking,
          recordCancellationFinancialSettlement: capabilities.recordCancellationFinancialSettlement,
          customFields: capabilities.customFields,
          // Vertical enrichment seam (issue #2969): keep lazy composition in
          // sync with the eager registry used by non-lazy deployments.
          overviewItemEnrichers: {
            accommodation: accommodationsOverview.enrichStayBookingOverviewItems,
          },
        })
      })
      return withAnonymous(
        {
          module: { name: "bookings", requiresTransactionalDb: true },
          lazyAdminRoutes: unit.route((m) => m.adminRoutes),
          lazyPublicRoutes: unit.route((m) => m.publicRoutes),
        },
        true,
      )
    },
    "@voyant-travel/public-document-delivery": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/hono").then((m) =>
          m.createPublicDocumentDeliveryHonoModule({
            resolveStorage: capabilities.createOperatorDocumentStorage,
          }),
        ),
      )
      return withAnonymous(
        {
          module: { name: "documents" },
          lazyPublicRoutes: unit.route((m) => m.publicRoutes),
        },
        true,
      )
    },
    "@voyant-travel/notifications": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/notifications").then((m) =>
          m.createNotificationsHonoModule({
            resolveProviders: capabilities.resolveNotificationProviders,
            resolvePublicCheckoutBaseUrl: capabilities.resolvePublicCheckoutBaseUrl,
            resolveDocumentAttachmentResolver: (bindings) => async (document) => {
              if (document.storageKey) {
                const contentBase64 = await capabilities.readDocumentContentBase64(
                  bindings,
                  document.storageKey,
                )
                if (contentBase64) {
                  return {
                    filename: document.name,
                    contentBase64,
                    contentType: document.mimeType ?? undefined,
                  }
                }
                const path = await capabilities.resolveDocumentDownloadUrl(
                  bindings,
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
              return m.createDefaultBookingDocumentAttachment(document)
            },
            resolveDb: capabilities.resolveDb,
            autoConfirmAndDispatch: {
              enabled: true,
              templateSlug: "booking-confirmation",
              ...capabilities.notificationsAutoConfirmAndDispatch,
            },
          }),
        ),
      )
      return {
        module: { name: "notifications", bootstrap: unit.bootstrap },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/legal": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/legal").then((m) =>
          m.createLegalHonoModule({
            resolveDb: capabilities.resolveDb,
            resolveDocumentDownloadUrl: (bindings, storageKey) =>
              capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
            resolveDocumentStorage: capabilities.createOperatorDocumentStorage,
            resolveDocumentGenerator: capabilities.resolveContractDocumentGenerator,
            resolveBookingPiiService: capabilities.createBookingPiiService,
            autoGenerateContractOnConfirmed: capabilities.autoGenerateContractOnConfirmed,
          }),
        ),
      )
      return withAnonymous(
        {
          module: { name: "legal", requiresTransactionalDb: true, bootstrap: unit.bootstrap },
          lazyAdminRoutes: unit.route((m) => m.adminRoutes),
          lazyPublicRoutes: unit.route((m) => m.publicRoutes),
        },
        true,
      )
    },
    "@voyant-travel/storefront/customer-portal": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/storefront/customer-portal").then((m) =>
          m.createCustomerPortalHonoModule({
            resolveDocumentDownloadUrl: (bindings, storageKey) =>
              capabilities.resolveDocumentDownloadUrl(bindings, storageKey),
          }),
        ),
      )
      return withAnonymous(
        {
          module: { name: "customer-portal" },
          lazyPublicRoutes: unit.route((m) => m.publicRoutes),
        },
        ["/contact-exists"],
      )
    },
    "@voyant-travel/storefront/verification": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/storefront/verification").then((m) =>
          m.createStorefrontVerificationHonoModule({
            resolveProviders: capabilities.resolveNotificationProviders,
            email: { subject: "Your verification code" },
          }),
        ),
      )
      return withAnonymous(
        {
          module: { name: "storefront-verification" },
          lazyPublicRoutes: unit.route((m) => m.publicRoutes),
        },
        true,
      )
    },
    "@voyant-travel/trips": ({ capabilities }) => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/trips").then((m) => {
          const trips = m.createTripsHonoModule({
            routesOptions: capabilities.createTripsRoutesOptions,
            publicRoutes: true,
          })
          return { ...trips, module: { ...trips.module, requiresTransactionalDb: true } }
        }),
      )
      return {
        module: { name: "trips", requiresTransactionalDb: true },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
        lazyPublicRoutes: unit.route((m) => m.publicRoutes),
      }
    },
    "@voyant-travel/operator-settings": () => {
      return {
        module: { name: "operator-settings" },
        lazyRoutes: {
          paths: [
            "/v1/admin/settings/*",
            "/v1/public/operator-profile",
            "/v1/public/settings/operator",
          ],
          load: async () => {
            const module = await import("@voyant-travel/operator-settings/hono-module").then((m) =>
              m.createOperatorSettingsHonoModule(),
            )
            if (!module.lazyRoutes) {
              throw new Error("operator-settings module did not provide lazyRoutes")
            }
            return module.lazyRoutes.load()
          },
        },
      }
    },
    "@voyant-travel/flights": ({ capabilities }) => ({
      module: { name: "flights" },
      lazyAdminRoutes: capabilities.loadFlightAdminRoutes,
    }),
    "operator/mcp": ({ capabilities }) => ({
      module: { name: "mcp" },
      lazyAdminRoutes: capabilities.loadMcpAdminRoutes,
    }),
    "operator/catalog-booking": ({ capabilities }) => ({
      module: { name: "catalog-booking" },
      lazyRoutes: {
        paths: CATALOG_BOOKING_ROUTE_PATHS,
        load: capabilities.loadCatalogBookingRoutes,
      },
      transactionalPaths: CATALOG_BOOKING_TRANSACTIONAL_PATHS,
    }),
    "operator/catalog-content": ({ capabilities }) => ({
      module: { name: "catalog-content" },
      lazyRoutes: {
        paths: CATALOG_CONTENT_ROUTE_PATHS,
        load: capabilities.loadCatalogContentRoutes,
      },
    }),
    "operator/media": ({ capabilities }) => ({
      module: { name: "media" },
      lazyRoutes: { paths: MEDIA_ROUTE_PATHS, load: capabilities.loadMediaRoutes },
    }),
    "operator/payment-link": ({ capabilities }) => ({
      module: { name: "payment-link" },
      publicPath: "/",
      lazyRoutes: { paths: PAYMENT_LINK_ROUTE_PATHS, load: capabilities.loadPaymentLinkRoutes },
      anonymous: ["payment-link-config", "payment-link"],
    }),
    "operator/contract-document": ({ capabilities }) => ({
      module: { name: "contract-document" },
      lazyRoutes: {
        paths: ["/v1/admin/bookings/:bookingId/generate-contract", "/v1/admin/documents/files/*"],
        load: capabilities.loadContractDocumentRoutes,
      },
    }),
  },
  extensions: {
    "@voyant-travel/bookings/booking-supplier-extension": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/bookings").then((m) => m.bookingsSupplierExtension),
      )
      return {
        extension: { name: "booking-supplier", module: "bookings" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/finance/bookings-create-extension": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/finance").then((m) => m.bookingsCreateExtension),
      )
      return {
        extension: { name: "finance-bookings-create", module: "bookings" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/inventory/booking-extension": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/inventory").then((m) => m.inventoryBookingExtension),
      )
      return {
        extension: { name: "products", module: "bookings" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/inventory/authoring/extension": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/inventory/authoring/extension").then(
          (m) => m.inventoryAuthoringExtension,
        ),
      )
      return {
        extension: {
          name: "inventory-authoring",
          module: "products",
          requiresTransactionalDb: true,
        },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/quotes/booking-extension": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/quotes").then((m) => m.quotesBookingExtension),
      )
      return {
        extension: { name: "quotes", module: "bookings" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/distribution": () => {
      const unit = createLazyUnit(() =>
        import("@voyant-travel/distribution").then((m) => m.distributionBookingExtension),
      )
      return {
        extension: { name: "distribution", module: "bookings" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "@voyant-travel/distribution/channel-push-extension": ({ capabilities }) =>
      capabilities.createChannelPushExtension(),
    "@voyant-travel/finance/booking-tax-extension": () => {
      const unit = createLazyUnit(async () => {
        const [finance, settings] = await Promise.all([
          import("@voyant-travel/finance"),
          import("@voyant-travel/operator-settings"),
        ])
        return finance.createBookingTaxHonoExtension({
          resolveBookingTaxSettings: settings.resolveBookingTaxSettings,
          updateBookingTaxSettings: settings.updateBookingTaxSettings,
        })
      })
      return {
        extension: { name: "booking-tax", module: "bookings" },
        lazyAdminRoutes: unit.route((m) => m.adminRoutes),
      }
    },
    "operator/booking-schedule-extension": ({ capabilities }) => ({
      extension: { name: "booking-schedule", module: "bookings" },
      publicPath: "payment-policy",
      lazyAdminRoutes: capabilities.loadBookingScheduleAdminRoutes,
      lazyPublicRoutes: capabilities.loadPaymentPolicyPublicRoutes,
    }),
    "operator/quote-version-snapshot-extension": ({ capabilities }) => ({
      extension: { name: "quote-version-snapshot", module: "trips" },
      lazyAdminRoutes: capabilities.loadQuoteVersionSnapshotRoutes,
    }),
    "operator/booking-maintenance-extension": ({ capabilities }) => ({
      extension: { name: "booking-maintenance", module: "bookings" },
      lazyAdminRoutes: capabilities.loadBookingMaintenanceRoutes,
    }),
    "operator/action-ledger-health-extension": ({ capabilities }) => ({
      extension: { name: "action-ledger-health", module: "action-ledger" },
      lazyAdminRoutes: capabilities.loadActionLedgerHealthRoutes,
    }),
    "operator/proposal-extension": ({ capabilities }) => ({
      extension: { name: "proposal", module: "quote-versions" },
      publicPath: "proposals",
      lazyAdminRoutes: capabilities.loadProposalAdminRoutes,
      lazyPublicRoutes: capabilities.loadProposalPublicRoutes,
      anonymous: true,
    }),
    "operator/catalog-offers-extension": ({ capabilities }) => ({
      extension: { name: "catalog-offers", module: "catalog" },
      lazyAdminRoutes: capabilities.loadCatalogOffersRoutes,
    }),
    "operator/catalog-checkout-extension": ({ capabilities }) => ({
      extension: { name: "catalog-checkout", module: "catalog" },
      lazyPublicRoutes: capabilities.loadCatalogCheckoutRoutes,
    }),
  },
}
