import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"

import { BOOKING_VOYANT_ACTIONS } from "./action-declarations.js"
import { bookingRequirementsRuntimePort, bookingsRuntimePort } from "./runtime-port.js"

const bookingsAdminRuntime = {
  entry: "@voyant-travel/bookings-react/admin",
  export: "createBookingsAdminExtension",
} as const

/**
 * Import-cheap deployment declaration owned by the bookings package.
 * Executable package surfaces stay behind symbolic package export references.
 */
export const bookingsVoyantModule = defineModule({
  id: "@voyant-travel/bookings",
  packageName: "@voyant-travel/bookings",
  localId: "bookings",
  runtime: { entry: "@voyant-travel/bookings", export: "createBookingsVoyantRuntime" },
  runtimePorts: [requirePort(bookingsRuntimePort)],
  api: [
    {
      id: "@voyant-travel/bookings#api.admin",
      surface: "admin",
      mount: "bookings",
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
    },
    { id: "@voyant-travel/bookings#event.booking.confirmed", eventType: "booking.confirmed" },
    { id: "@voyant-travel/bookings#event.booking.expired", eventType: "booking.expired" },
    { id: "@voyant-travel/bookings#event.booking.cancelled", eventType: "booking.cancelled" },
    { id: "@voyant-travel/bookings#event.booking.started", eventType: "booking.started" },
    { id: "@voyant-travel/bookings#event.booking.completed", eventType: "booking.completed" },
    {
      id: "@voyant-travel/bookings#event.booking.status-overridden",
      eventType: "booking.status_overridden",
    },
    { id: "@voyant-travel/bookings#event.booking.refunded", eventType: "booking.refunded" },
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
    },
    {
      id: "@voyant-travel/bookings#tool.get-booking",
      name: "get_booking",
      runtime: { entry: "@voyant-travel/bookings/tools", export: "getBookingTool" },
      requiredScopes: ["bookings:read"],
    },
  ],
  actions: BOOKING_VOYANT_ACTIONS,
  admin: {
    routes: [
      {
        id: "@voyant-travel/bookings#admin.route.index",
        path: "/bookings",
        requiredScopes: ["bookings:read"],
        runtime: bookingsAdminRuntime,
      },
      {
        id: "@voyant-travel/bookings#admin.route.detail",
        path: "/bookings/$id",
        requiredScopes: ["bookings:read"],
        runtime: bookingsAdminRuntime,
      },
      {
        id: "@voyant-travel/bookings#admin.route.new",
        path: "/bookings/new",
        requiredScopes: ["bookings:write"],
        runtime: bookingsAdminRuntime,
      },
      {
        id: "@voyant-travel/bookings#admin.route.compose",
        path: "/bookings/compose",
        requiredScopes: ["bookings:write"],
        runtime: bookingsAdminRuntime,
      },
      {
        id: "@voyant-travel/bookings#admin.route.journey",
        path: "/catalog/journey/$entityModule/$entityId",
        requiredScopes: ["bookings:read"],
        runtime: bookingsAdminRuntime,
      },
    ],
    slots: [
      {
        id: "booking.details.invoices-tab",
        routeId: "@voyant-travel/bookings#admin.route.detail",
      },
      {
        id: "booking.details.finance-start",
        routeId: "@voyant-travel/bookings#admin.route.detail",
      },
      {
        id: "booking.details.finance-end",
        routeId: "@voyant-travel/bookings#admin.route.detail",
      },
    ],
    contributions: [
      {
        id: "@voyant-travel/bookings#admin.contribution.person-bookings",
        slotId: "person.details.bookings-tab",
        requiredScopes: ["bookings:read"],
        runtime: bookingsAdminRuntime,
      },
    ],
  },
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
  runtimePorts: [requirePort(bookingRequirementsRuntimePort)],
  api: [
    {
      id: "@voyant-travel/bookings#requirements.api",
      surface: "admin",
      mount: "booking-requirements",
      runtime: {
        entry: "@voyant-travel/bookings/requirements",
        export: "createBookingRequirementsHonoModule",
      },
    },
    {
      id: "@voyant-travel/bookings#requirements.api.public",
      surface: "public",
      mount: "booking-requirements",
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

export const bookingsSupplierVoyantPlugin = defineExtension({
  id: "@voyant-travel/bookings#booking-supplier-extension",
  packageName: "@voyant-travel/bookings",
  localId: "bookings.booking-supplier-extension",
  api: [
    {
      id: "@voyant-travel/bookings#booking-supplier-extension.api",
      surface: "admin",
      mount: "bookings",
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
