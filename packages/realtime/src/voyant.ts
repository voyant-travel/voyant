import { defineModule, requirePort } from "@voyant-travel/core/project"
import { realtimeRuntimePort } from "./runtime-port.js"

/** Import-cheap deployment declaration owned by the realtime package. */
export const realtimeVoyantModule = defineModule({
  id: "@voyant-travel/realtime",
  packageName: "@voyant-travel/realtime",
  localId: "realtime",
  provides: {
    ports: [{ id: "realtime.transport" }, { id: "realtime.admin-invalidation-publication" }],
  },
  runtimePorts: [requirePort(realtimeRuntimePort)],
  api: [
    {
      id: "@voyant-travel/realtime#api.admin",
      surface: "admin",
      mount: "realtime",
      openapi: { document: "realtime-admin" },
      runtime: {
        entry: "@voyant-travel/realtime",
        export: "createRealtimeVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/realtime#api.public",
      surface: "public",
      mount: "realtime",
      openapi: { document: "realtime-public" },
      runtime: {
        entry: "@voyant-travel/realtime",
        export: "createRealtimeVoyantRuntime",
      },
    },
  ],
  admin: {
    compositionOrder: 110,
    runtime: {
      entry: "@voyant-travel/realtime-react/admin",
      export: "createSelectedRealtimeAdminExtension",
    },
  },
  providers: [
    {
      id: "@voyant-travel/realtime#provider.local",
      port: "realtime.transport",
      runtime: {
        entry: "@voyant-travel/realtime/providers/local",
        export: "createLocalRealtimeProvider",
      },
    },
    {
      id: "@voyant-travel/realtime#provider.voyant-cloud",
      port: "realtime.transport",
      runtime: {
        entry: "@voyant-travel/realtime/providers/voyant-cloud",
        export: "createVoyantCloudRealtimeProvider",
      },
    },
  ],
  subscribers: [
    ["product.created", "realtimeProductCreatedInvalidationSubscriber"],
    ["product.updated", "realtimeProductUpdatedInvalidationSubscriber"],
    ["product.deleted", "realtimeProductDeletedInvalidationSubscriber"],
    ["product.content.changed", "realtimeProductContentChangedInvalidationSubscriber"],
    ["person.changed", "realtimePersonChangedInvalidationSubscriber"],
    ["organization.changed", "realtimeOrganizationChangedInvalidationSubscriber"],
    ["customer.signal.created", "realtimeCustomerSignalCreatedInvalidationSubscriber"],
    ["supplier.created", "realtimeSupplierCreatedInvalidationSubscriber"],
    ["supplier.updated", "realtimeSupplierUpdatedInvalidationSubscriber"],
    ["supplier.deleted", "realtimeSupplierDeletedInvalidationSubscriber"],
    ["quote.created", "realtimeQuoteCreatedInvalidationSubscriber"],
    ["quote.updated", "realtimeQuoteUpdatedInvalidationSubscriber"],
    ["quote.deleted", "realtimeQuoteDeletedInvalidationSubscriber"],
    ["invoice.issued", "realtimeInvoiceIssuedInvalidationSubscriber"],
    ["invoice.voided", "realtimeInvoiceVoidedInvalidationSubscriber"],
    ["invoice.settled", "realtimeInvoiceSettledInvalidationSubscriber"],
    ["invoice.proforma.issued", "realtimeInvoiceProformaIssuedInvalidationSubscriber"],
    ["invoice.proforma.converted", "realtimeInvoiceProformaConvertedInvalidationSubscriber"],
    ["contract.issued", "realtimeContractIssuedInvalidationSubscriber"],
    ["contract.sent", "realtimeContractSentInvalidationSubscriber"],
    ["contract.signed", "realtimeContractSignedInvalidationSubscriber"],
    ["contract.executed", "realtimeContractExecutedInvalidationSubscriber"],
    ["contract.voided", "realtimeContractVoidedInvalidationSubscriber"],
    ["cruise.created", "realtimeCruiseCreatedInvalidationSubscriber"],
    ["cruise.updated", "realtimeCruiseUpdatedInvalidationSubscriber"],
    ["cruise.deleted", "realtimeCruiseDeletedInvalidationSubscriber"],
    ["pricing.rule.changed", "realtimePricingRuleChangedInvalidationSubscriber"],
    ["promotion.changed", "realtimePromotionChangedInvalidationSubscriber"],
    ["booking.confirmed", "realtimeBookingConfirmedInvalidationSubscriber"],
    ["booking.cancelled", "realtimeBookingCancelledInvalidationSubscriber"],
    ["booking.fully-paid", "realtimeBookingFullyPaidInvalidationSubscriber"],
    ["booking.refunded", "realtimeBookingRefundedInvalidationSubscriber"],
    ["payment.completed", "realtimePaymentCompletedInvalidationSubscriber"],
    ["availability.slot.changed", "realtimeAvailabilitySlotChangedInvalidationSubscriber"],
  ].map(([eventType, exportName]) => ({
    id: `@voyant-travel/realtime#subscriber.admin-invalidation.${eventType}`,
    eventType,
    source: "@voyant-travel/realtime/runtime",
    runtime: {
      entry: "@voyant-travel/realtime/runtime",
      export: exportName,
    },
  })),
  meta: {
    ownership: "package",
  },
})

export default realtimeVoyantModule
