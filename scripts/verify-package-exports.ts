import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

interface ExportCheck {
  packageName: string
  entry: string
  requiredExports: string[]
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const checks: ExportCheck[] = [
  {
    packageName: "@voyantjs/storage",
    entry: "packages/storage/dist/index.js",
    requiredExports: [
      "createStorageService",
      "StorageError",
      "createLocalStorageProvider",
      "createR2Provider",
      "createS3Provider",
      "presignUrl",
      "signRequest",
    ],
  },
  {
    packageName: "@voyantjs/finance",
    entry: "packages/finance/dist/index.js",
    requiredExports: [
      "createFinanceHonoModule",
      "createFinanceAdminDocumentRoutes",
      "createFinanceAdminSettlementRoutes",
      "createPdfInvoiceDocumentGenerator",
      "createStorageBackedInvoiceDocumentGenerator",
      "defaultPdfInvoiceDocumentSerializer",
      "publicFinanceRoutes",
      "publicFinanceService",
      "defaultStorageBackedInvoiceDocumentSerializer",
      "financeDocumentsService",
      "financeSettlementService",
      "generateInvoiceDocumentInputSchema",
      "generatedInvoiceDocumentResultSchema",
      "pollInvoiceSettlementInputSchema",
      "polledInvoiceSettlementProviderResultSchema",
      "polledInvoiceSettlementResultSchema",
      "publicBookingFinanceDocumentsSchema",
      "publicBookingFinancePaymentsSchema",
      "publicFinanceBookingDocumentSchema",
      "publicFinanceDocumentLookupQuerySchema",
      "publicFinanceDocumentLookupSchema",
      "publicFinanceBookingPaymentSchema",
      "publicFinanceDocumentAvailabilitySchema",
      "publicBookingPaymentOptionsSchema",
      "publicPaymentOptionsQuerySchema",
      "publicPaymentSessionSchema",
      "publicStartPaymentSessionSchema",
      "publicValidateVoucherSchema",
      "publicVoucherValidationSchema",
    ],
  },
  {
    packageName: "@voyantjs/finance-react",
    entry: "packages/finance-react/dist/index.js",
    requiredExports: [
      "getPublicBookingDocuments",
      "getPublicBookingDocumentsQueryOptions",
      "usePublicBookingDocuments",
      "getPublicFinanceDocumentByReference",
      "getPublicFinanceDocumentByReferenceQueryOptions",
      "usePublicFinanceDocumentByReference",
      "getPublicBookingPayments",
      "getPublicBookingPaymentsQueryOptions",
      "usePublicBookingPayments",
      "publicBookingFinanceDocumentsSchema",
      "publicBookingFinancePaymentsSchema",
      "publicFinanceDocumentLookupQuerySchema",
      "publicFinanceDocumentLookupSchema",
      "publicFinanceBookingDocumentSchema",
      "publicFinanceBookingPaymentSchema",
      "getPublicBookingPaymentOptions",
      "getPublicBookingPaymentOptionsQueryOptions",
      "getPublicPaymentSession",
      "getPublicPaymentSessionQueryOptions",
      "startPublicBookingGuaranteePaymentSession",
      "startPublicBookingSchedulePaymentSession",
      "validatePublicVoucher",
      "publicBookingPaymentOptionsSchema",
      "publicPaymentOptionsQuerySchema",
      "publicPaymentSessionSchema",
      "publicStartPaymentSessionSchema",
      "publicValidateVoucherSchema",
      "publicVoucherValidationSchema",
    ],
  },
  {
    packageName: "@voyantjs/products",
    entry: "packages/products/dist/index.js",
    requiredExports: [
      "publicProductRoutes",
      "publicProductsService",
      "catalogProductsService",
      "createBasicPdfProductBrochurePrinter",
      "createCloudflareBrowserProductBrochurePrinter",
      "createCloudflareBrowserProductBrochurePrinterFromEnv",
      "createDefaultProductBrochureTemplate",
      "generateAndStoreProductBrochure",
      "catalogSearchDocumentSchema",
      "catalogSearchDocumentListQuerySchema",
      "catalogSearchDocumentListResponseSchema",
      "localizedCatalogProductSummarySchema",
      "publicCatalogDestinationListQuerySchema",
      "publicCatalogDestinationListResponseSchema",
      "publicCatalogDestinationSchema",
      "loadProductBrochureTemplateContext",
      "renderProductBrochureTemplate",
      "localizedCatalogProductDetailSchema",
      "upsertProductBrochureSchema",
    ],
  },
  {
    packageName: "@voyantjs/bookings",
    entry: "packages/bookings/dist/index.js",
    requiredExports: [
      "publicBookingRoutes",
      "publicBookingsService",
      "publicBookingOverviewLookupQuerySchema",
      "publicBookingSessionRepriceResultSchema",
      "publicBookingSessionStateSchema",
      "publicBookingSessionMutationSchema",
      "publicCreateBookingSessionSchema",
      "publicRepriceBookingSessionSchema",
      "publicUpsertBookingSessionStateSchema",
      "publicUpdateBookingSessionSchema",
      "bookingSessionStates",
    ],
  },
  {
    packageName: "@voyantjs/bookings-react",
    entry: "packages/bookings-react/dist/index.js",
    requiredExports: [
      "usePublicBookingSession",
      "usePublicBookingSessionState",
      "usePublicBookingSessionFlowMutation",
      "getPublicBookingSessionQueryOptions",
      "getPublicBookingSessionStateQueryOptions",
      "publicBookingSessionResponse",
      "publicBookingSessionStateResponse",
      "publicBookingSessionRepriceResponse",
    ],
  },
  {
    packageName: "@voyantjs/products-react",
    entry: "packages/products-react/dist/index.js",
    requiredExports: [
      "useProductDayMutation",
      "useProductDays",
      "useProductMedia",
      "useProductMediaMutation",
      "useProductVersionMutation",
      "useProductVersions",
      "getProductDayServicesQueryOptions",
      "getProductDaysQueryOptions",
      "getProductMediaQueryOptions",
      "getProductVersionsQueryOptions",
      "productDayRecordSchema",
      "productMediaRecordSchema",
      "productVersionRecordSchema",
    ],
  },
  {
    packageName: "@voyantjs/customer-portal",
    entry: "packages/customer-portal/dist/index.js",
    requiredExports: [
      "publicCustomerPortalRoutes",
      "publicCustomerPortalService",
      "customerPortalBookingBillingContactSchema",
      "customerPortalBookingDetailSchema",
      "customerPortalBookingSummarySchema",
      "customerPortalCompanionSchema",
      "customerPortalProfileSchema",
      "importCustomerPortalBookingParticipantsSchema",
      "importCustomerPortalBookingParticipantsResultSchema",
    ],
  },
  {
    packageName: "@voyantjs/customer-portal-react",
    entry: "packages/customer-portal-react/dist/index.js",
    requiredExports: [
      "getCustomerPortalBooking",
      "getCustomerPortalBookingBillingContact",
      "getCustomerPortalBookingBillingContactQueryOptions",
      "useCustomerPortalBooking",
      "useCustomerPortalBookingBillingContact",
      "useCustomerPortalMutation",
      "customerPortalBookingBillingContactResponseSchema",
      "customerPortalBookingsResponseSchema",
      "customerPortalProfileResponseSchema",
    ],
  },
  {
    packageName: "@voyantjs/storefront",
    entry: "packages/storefront/dist/index.js",
    requiredExports: [
      "createStorefrontHonoModule",
      "createStorefrontPublicRoutes",
      "createStorefrontService",
      "resolveStorefrontSettings",
      "storefrontDepartureListQuerySchema",
      "storefrontDepartureListResponseSchema",
      "storefrontDepartureItinerarySchema",
      "storefrontDeparturePricePreviewInputSchema",
      "storefrontDeparturePricePreviewSchema",
      "storefrontDepartureSchema",
      "storefrontProductExtensionsQuerySchema",
      "storefrontProductExtensionsResponseSchema",
      "storefrontPromotionalOfferListQuerySchema",
      "storefrontPromotionalOfferListResponseSchema",
      "storefrontPromotionalOfferResponseSchema",
      "storefrontPromotionalOfferSchema",
      "storefrontSettingsInputSchema",
      "storefrontSettingsSchema",
    ],
  },
  {
    packageName: "@voyantjs/storefront-react",
    entry: "packages/storefront-react/dist/index.js",
    requiredExports: [
      "getStorefrontSettings",
      "getStorefrontSettingsQueryOptions",
      "getStorefrontDeparture",
      "getStorefrontDepartureQueryOptions",
      "getStorefrontProductDeparturesQueryOptions",
      "getStorefrontProductExtensionsQueryOptions",
      "getStorefrontDepartureItineraryQueryOptions",
      "getStorefrontProductOffersQueryOptions",
      "getStorefrontOfferQueryOptions",
      "useStorefrontSettings",
      "useStorefrontDeparture",
      "useStorefrontProductDepartures",
      "useStorefrontProductExtensions",
      "useStorefrontDepartureItinerary",
      "useStorefrontProductOffers",
      "useStorefrontOffer",
      "useStorefrontDeparturePricePreviewMutation",
      "storefrontSettingsResponseSchema",
      "storefrontDepartureResponseSchema",
      "storefrontDepartureListResponseSchema",
      "storefrontDeparturePricePreviewResponseSchema",
      "storefrontDepartureItineraryResponseSchema",
      "storefrontPromotionalOfferListResponseSchema",
      "storefrontPromotionalOfferResponseSchema",
    ],
  },
  {
    packageName: "@voyantjs/transactions",
    entry: "packages/transactions/dist/index.js",
    requiredExports: [
      "transactionsService",
      "createStorefrontPromotionalOffersResolver",
      "getStorefrontPromotionalOfferBySlug",
      "listStorefrontPromotionalOffers",
      "offerMetadataSchema",
      "storefrontOfferEnvelopeSchema",
      "storefrontOfferDiscountTypeSchema",
      "storefrontOfferMetadataSchema",
      "storefrontPromotionalOfferSchema",
    ],
  },
  {
    packageName: "@voyantjs/utils/template-renderer",
    entry: "packages/utils/dist/template-renderer.js",
    requiredExports: ["renderMustacheTemplate", "renderStringTemplate", "renderStructuredTemplate"],
  },
  {
    packageName: "@voyantjs/utils/pdf-renderer",
    entry: "packages/utils/dist/pdf-renderer.js",
    requiredExports: ["renderPdfDocument"],
  },
  {
    packageName: "@voyantjs/notifications",
    entry: "packages/notifications/dist/index.js",
    requiredExports: [
      "bookingDocumentBundleItemSchema",
      "bookingDocumentBundleSchema",
      "bookingDocumentNotificationsService",
      "createDefaultBookingDocumentAttachment",
      "createLocalProvider",
      "createVoyantCloudEmailProvider",
      "createVoyantCloudSmsProvider",
      "notificationAttachmentSchema",
      "notificationReminderRunRecordSchema",
      "notificationReminderRunListResponseSchema",
      "notificationReminderRunRuleSummarySchema",
      "notificationReminderRunDeliverySummarySchema",
      "notificationReminderRunLinksSchema",
      "sendBookingDocumentsNotificationSchema",
      "sendBookingDocumentsNotificationResultSchema",
    ],
  },
  {
    packageName: "@voyantjs/legal",
    entry: "packages/legal/dist/index.js",
    requiredExports: [
      "createLegalHonoModule",
      "legalHonoModule",
      "createContractsAdminRoutes",
      "createContractsPublicRoutes",
      "createPdfContractDocumentGenerator",
      "createStorageBackedContractDocumentGenerator",
      "contractsService",
      "defaultPdfContractDocumentSerializer",
      "defaultStorageBackedContractDocumentSerializer",
      "generateContractDocumentInputSchema",
      "generatedContractDocumentAttachmentSchema",
      "generatedContractDocumentResultSchema",
    ],
  },
  {
    packageName: "@voyantjs/storefront-verification",
    entry: "packages/storefront-verification/dist/index.js",
    requiredExports: [
      "createStorefrontVerificationHonoModule",
      "createStorefrontVerificationPublicRoutes",
      "createStorefrontVerificationService",
      "createStorefrontVerificationSendersFromProviders",
      "storefrontVerificationChallenges",
      "startEmailVerificationChallengeSchema",
      "confirmSmsVerificationChallengeSchema",
    ],
  },
  {
    packageName: "@voyantjs/checkout",
    entry: "packages/checkout/dist/index.js",
    requiredExports: [
      "createCheckoutRoutes",
      "createCheckoutAdminRoutes",
      "createCheckoutHonoModule",
      "checkoutModule",
      "checkoutBankTransferInstructionsSchema",
      "checkoutCollectionIntentSchema",
      "checkoutCollectionPlanSchema",
      "bootstrapCheckoutCollectionSchema",
      "bootstrappedCheckoutCollectionSchema",
      "checkoutProviderStartInputSchema",
      "checkoutProviderStartResultSchema",
      "bootstrapCheckoutCollection",
      "initiatedCheckoutCollectionSchema",
      "checkoutReminderRunListResponseSchema",
      "listBookingReminderRuns",
    ],
  },
  {
    packageName: "@voyantjs/plugin-netopia",
    entry: "packages/plugins/netopia/dist/index.js",
    requiredExports: [
      "createNetopiaCheckoutStarter",
      "createNetopiaFinanceExtension",
      "createNetopiaFinanceRoutes",
      "netopiaService",
      "netopiaStartPaymentSessionSchema",
    ],
  },
  {
    packageName: "@voyantjs/plugin-smartbill",
    entry: "packages/plugins/smartbill/dist/index.js",
    requiredExports: [
      "createSmartbillClient",
      "createSmartbillInvoiceSettlementPoller",
      "mapVoyantInvoiceToSmartbill",
      "smartbillPlugin",
    ],
  },
  {
    packageName: "@voyantjs/booking-requirements",
    entry: "packages/booking-requirements/dist/index.js",
    requiredExports: [
      "publicBookingRequirementsRoutes",
      "bookingRequirementsService",
      "publicTransportRequirementsQuerySchema",
      "publicTransportRequirementsSchema",
      "transportRequirementFieldSchema",
    ],
  },
  {
    packageName: "@voyantjs/booking-requirements-react",
    entry: "packages/booking-requirements-react/dist/index.js",
    requiredExports: [
      "useTransportRequirements",
      "getTransportRequirementsQueryOptions",
      "bookingRequirementsQueryKeys",
      "publicTransportRequirementsSchema",
      "transportRequirementFieldSchema",
    ],
  },
]

async function main() {
  const failures: string[] = []

  for (const check of checks) {
    const entryPath = path.join(repoRoot, check.entry)
    if (!existsSync(entryPath)) {
      failures.push(
        `${check.packageName}: missing build output at ${check.entry}; run the package build before verifying exports.`,
      )
      continue
    }

    try {
      const mod = await import(pathToFileURL(entryPath).href)
      const missingExports = check.requiredExports.filter((name) => !(name in mod))

      if (missingExports.length > 0) {
        failures.push(`${check.packageName}: missing exports ${missingExports.join(", ")}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${check.packageName}: failed to import built entrypoint (${message})`)
    }
  }

  if (failures.length > 0) {
    console.error("Package export verification failed:\n")
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log(`Verified runtime package exports for ${checks.length} package entrypoints.`)
}

void main()
