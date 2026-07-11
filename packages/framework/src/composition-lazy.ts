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
import type { BootstrapHandler } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { BookingScheduleRoutesOptions } from "@voyant-travel/finance"
import type { LazyRoutesLoader } from "@voyant-travel/hono"
import type { CompositionRegistry } from "@voyant-travel/hono/composition"
import type { HonoModule } from "@voyant-travel/hono/module"
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
  /** Runs out-of-request work with a deployment-owned database lifecycle. */
  withDb?: <T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>) => Promise<T>
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
  /**
   * OPTIONAL: the `@voyant-travel/flights` family has no first-party real
   * connector yet (only the demo adapter), so a deployment that doesn't run
   * flights should not have to wire or install one. When this loader is omitted,
   * `createVoyantApp` auto-excludes the flights module (see
   * `OPTIONAL_FAMILY_LOADERS`) rather than forcing a stub.
   */
  loadFlightAdminRoutes?: LazyRoutesLoader
  loadMcpAdminRoutes: LazyRoutesLoader
  loadCatalogBookingRoutes?: LazyRoutesLoader
  loadInventoryContentRoutes?: LazyRoutesLoader
  loadCruisesContentRoutes?: LazyRoutesLoader
  loadAccommodationsContentRoutes?: LazyRoutesLoader
  loadStorageRoutes?: LazyRoutesLoader
  loadInventoryBrochureRoutes?: LazyRoutesLoader
  loadPaymentLinkRoutes?: LazyRoutesLoader
  loadContractDocumentRoutes?: LazyRoutesLoader
  createBookingScheduleRoutesOptions?: () =>
    | BookingScheduleRoutesOptions
    | Promise<BookingScheduleRoutesOptions>
  loadBookingScheduleAdminRoutes?: LazyRoutesLoader
  loadPaymentPolicyPublicRoutes?: LazyRoutesLoader
  loadQuoteVersionSnapshotRoutes?: LazyRoutesLoader
  loadBookingMaintenanceRoutes?: LazyRoutesLoader
  loadActionLedgerHealthRoutes?: LazyRoutesLoader
  loadProposalAdminRoutes?: LazyRoutesLoader
  loadProposalPublicRoutes?: LazyRoutesLoader
  loadCatalogOffersRoutes?: LazyRoutesLoader
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

const STORAGE_ROUTE_PATHS = [
  "/v1/admin/uploads",
  "/v1/admin/uploads/video",
  "/v1/admin/media/*",
] as const

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
        promotions: { name: "promotions" },
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
        module: {
          name: "trips",
          requiresTransactionalDb: true,
          bootstrap: async ({ container, bindings }) => {
            const { TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY } = await import(
              "@voyant-travel/trips/payment-subscribers"
            )
            container.register(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY, {
              withDb: <T>(operation: (db: AnyDrizzleDb) => Promise<T>) =>
                runWithFrameworkDb(capabilities, bindings, operation),
            })
          },
        },
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
    "@voyant-travel/flights": ({ capabilities }) => {
      // `loadFlightAdminRoutes` is optional so `createVoyantApp` can auto-exclude
      // flights when it's unwired. If flights IS in the manifest (e.g. a direct
      // `frameworkComposition` mount) the loader must be present — fail fast here
      // rather than mounting a flights module in admin metadata with no routes.
      if (!capabilities.loadFlightAdminRoutes) {
        throw new Error(
          "frameworkComposition: @voyant-travel/flights is in the manifest but " +
            "loadFlightAdminRoutes was not provided. Provide the loader, or drop the " +
            "specifier (createVoyantApp auto-excludes it when the loader is absent).",
        )
      }
      return {
        module: { name: "flights" },
        lazyAdminRoutes: capabilities.loadFlightAdminRoutes,
      }
    },
    "@voyant-travel/storage": ({ capabilities }) => {
      if (!capabilities.loadStorageRoutes) {
        throw new Error(
          "frameworkComposition: @voyant-travel/storage requires loadStorageRoutes on the legacy composition path.",
        )
      }
      return {
        module: { name: "media" },
        lazyRoutes: { paths: STORAGE_ROUTE_PATHS, load: capabilities.loadStorageRoutes },
      }
    },
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
    // The selected graph loads the package-owned channel-push runtime. Keep only
    // its extension identity on the legacy manifest path until this catalog is deleted.
    "@voyant-travel/distribution/channel-push-extension": () => ({
      extension: { name: "channel-push", module: "distribution" },
    }),
    "@voyant-travel/commerce/catalog-checkout-extension": ({ capabilities }) => ({
      extension: { name: "catalog-checkout", module: "catalog" },
      lazyPublicRoutes: capabilities.loadCatalogCheckoutRoutes,
    }),
  },
}

function runWithFrameworkDb<T>(
  capabilities: FrameworkProviders,
  bindings: unknown,
  operation: (db: AnyDrizzleDb) => Promise<T>,
): Promise<T> {
  return capabilities.withDb
    ? capabilities.withDb(bindings, operation)
    : operation(capabilities.resolveDb(bindings as Record<string, unknown>))
}
