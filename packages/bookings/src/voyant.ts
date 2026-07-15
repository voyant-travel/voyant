import { actionLedgerBookingDriftRuntimePort } from "@voyant-travel/action-ledger/runtime-port"
import {
  defineExtension,
  defineModule,
  providePort,
  requirePort,
} from "@voyant-travel/core/project"

import { BOOKING_VOYANT_ACTIONS } from "./action-declarations.js"
import {
  bookingsAccommodationRuntimePort,
  bookingsConfigurationRuntimePort,
  bookingsFinanceRuntimePort,
  bookingsInventoryRuntimePort,
  bookingsRelationshipsRuntimePort,
} from "./runtime-port.js"
import { bookingsVoyantAdmin } from "./voyant-admin.js"
import {
  availabilitySlotChangedPayloadSchema,
  bookingCancelledPayloadSchema,
  bookingConfirmedPayloadSchema,
  bookingExpiredPayloadSchema,
  bookingLifecyclePayloadSchema,
  bookingRefundedPayloadSchema,
  bookingStatusOverriddenPayloadSchema,
} from "./voyant-event-schemas.js"

/**
 * Import-cheap deployment declaration owned by the bookings package.
 * Executable package surfaces stay behind symbolic package export references.
 */
export const bookingsVoyantModule = defineModule({
  id: "@voyant-travel/bookings",
  packageName: "@voyant-travel/bookings",
  localId: "bookings",
  runtime: { entry: "@voyant-travel/bookings", export: "createBookingsVoyantRuntime" },
  runtimePorts: [
    requirePort(bookingsConfigurationRuntimePort),
    requirePort(bookingsAccommodationRuntimePort),
    requirePort(bookingsFinanceRuntimePort),
    requirePort(bookingsRelationshipsRuntimePort),
  ],
  provides: {
    capabilities: ["bookings.data-owner"],
    ports: [
      providePort(actionLedgerBookingDriftRuntimePort),
      providePort(bookingsConfigurationRuntimePort),
    ],
  },
  api: [
    {
      id: "@voyant-travel/bookings#api.admin",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "bookings" },
      resource: "bookings",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/bookings",
        export: "createBookingsHonoModule",
      },
    },
    {
      id: "@voyant-travel/bookings#api.public",
      surface: "public",
      mount: "bookings",
      openapi: { document: "bookings" },
      resource: "bookings",
      anonymous: true,
      transactional: true,
      runtime: {
        entry: "@voyant-travel/bookings",
        export: "createBookingsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/bookings#schema",
      source: "@voyant-travel/bookings/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/bookings#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/bookings#linkable.booking",
      source: "@voyant-travel/bookings/linkables",
    },
  ],
  workflows: [
    {
      id: "bookings.expire-stale-holds",
      config: {
        defaultRuntime: "node",
        schedule: {
          cron: "*/5 * * * *",
          name: "every-5-minutes",
        },
      },
      source: "@voyant-travel/bookings/workflows",
      runtime: {
        entry: "@voyant-travel/bookings/workflows",
        export: "bookingsExpireStaleHoldsWorkflow",
      },
    },
  ],
  events: [
    {
      id: "@voyant-travel/bookings#event.availability.slot.changed",
      eventType: "availability.slot.changed",
      version: "1.0.0",
      payloadSchema: availabilitySlotChangedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
    },
    {
      id: "@voyant-travel/bookings#event.booking.confirmed",
      eventType: "booking.confirmed",
      version: "1.0.0",
      payloadSchema: bookingConfirmedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
    },
    {
      id: "@voyant-travel/bookings#event.booking.expired",
      eventType: "booking.expired",
      version: "1.0.0",
      payloadSchema: bookingExpiredPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
    },
    {
      id: "@voyant-travel/bookings#event.booking.cancelled",
      eventType: "booking.cancelled",
      version: "1.0.0",
      payloadSchema: bookingCancelledPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
    },
    {
      id: "@voyant-travel/bookings#event.booking.started",
      eventType: "booking.started",
      version: "1.0.0",
      payloadSchema: bookingLifecyclePayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
    },
    {
      id: "@voyant-travel/bookings#event.booking.completed",
      eventType: "booking.completed",
      version: "1.0.0",
      payloadSchema: bookingLifecyclePayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
    },
    {
      id: "@voyant-travel/bookings#event.booking.status-overridden",
      eventType: "booking.status_overridden",
      version: "1.0.0",
      payloadSchema: bookingStatusOverriddenPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
    },
    {
      id: "@voyant-travel/bookings#event.booking.refunded",
      eventType: "booking.refunded",
      version: "1.0.0",
      payloadSchema: bookingRefundedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "bookings", category: "domain" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/bookings#access.bookings",
        resource: "bookings",
        label: "Bookings",
        description: "Read and manage booking records and booking workflows.",
        actions: [
          {
            action: "read",
            label: "Read bookings",
            description: "Read booking records and non-sensitive booking state.",
          },
          {
            action: "write",
            label: "Manage bookings",
            description: "Create, update, confirm, or cancel bookings.",
            sensitive: true,
          },
          {
            action: "delete",
            label: "Delete bookings",
            description: "Delete booking-owned records where supported.",
            sensitive: true,
          },
        ],
        legacyActions: ["cancel"],
      },
      {
        id: "@voyant-travel/bookings#access.bookings-pii",
        resource: "bookings-pii",
        label: "Booking PII",
        description: "Personally-identifiable traveller data on bookings. Grant explicitly.",
        wildcard: "explicit-resource",
        actions: [
          {
            action: "read",
            label: "Read booking PII",
            description:
              "Read personally-identifiable traveller fields on bookings. Never granted by a wildcard.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/bookings#tool.list-bookings",
      name: "list_bookings",
      runtime: { entry: "@voyant-travel/bookings/tools", export: "listBookingsTool" },
      requiredScopes: ["bookings:read"],
      context: ["bookings"],
      risk: "low",
    },
    {
      id: "@voyant-travel/bookings#tool.get-booking",
      name: "get_booking",
      runtime: { entry: "@voyant-travel/bookings/tools", export: "getBookingTool" },
      requiredScopes: ["bookings:read"],
      context: ["bookings"],
      risk: "low",
    },
  ],
  actions: BOOKING_VOYANT_ACTIONS,
  admin: bookingsVoyantAdmin,
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const bookingRequirementsVoyantModule = defineModule({
  id: "@voyant-travel/bookings#requirements",
  packageName: "@voyant-travel/bookings",
  localId: "bookings.requirements",
  runtime: {
    entry: "@voyant-travel/bookings/requirements",
    export: "createBookingRequirementsVoyantRuntime",
  },
  runtimePorts: [requirePort(bookingsInventoryRuntimePort)],
  requires: { capabilities: ["bookings.data-owner"] },
  api: [
    {
      id: "@voyant-travel/bookings#requirements.api",
      surface: "admin",
      mount: "booking-requirements",
      openapi: { document: "booking-requirements" },
      resource: "bookings",
      runtime: {
        entry: "@voyant-travel/bookings/requirements",
        export: "createBookingRequirementsHonoModule",
      },
    },
    {
      id: "@voyant-travel/bookings#requirements.api.public",
      surface: "public",
      mount: "booking-requirements",
      openapi: { document: "booking-requirements" },
      resource: "bookings",
      runtime: {
        entry: "@voyant-travel/bookings/requirements",
        export: "createBookingRequirementsHonoModule",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const bookingsExtrasVoyantModule = defineModule({
  id: "@voyant-travel/bookings#extras",
  packageName: "@voyant-travel/bookings",
  localId: "bookings.extras",
  requires: { capabilities: ["bookings.data-owner"] },
  api: [
    {
      id: "@voyant-travel/bookings#extras.api",
      surface: "admin",
      mount: "extras",
      openapi: { document: "booking-extras" },
      resource: "bookings",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/bookings/extras",
        export: "createBookingsExtrasVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const bookingsSupplierVoyantPlugin = defineExtension({
  id: "@voyant-travel/bookings#booking-supplier-extension",
  packageName: "@voyant-travel/bookings",
  localId: "bookings.booking-supplier-extension",
  api: [
    {
      id: "@voyant-travel/bookings#booking-supplier-extension.api",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "bookings" },
      runtime: {
        entry: "@voyant-travel/bookings/extensions/suppliers",
        export: "bookingsSupplierExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default bookingsVoyantModule
