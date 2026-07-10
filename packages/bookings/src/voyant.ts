import { defineModule, definePlugin } from "@voyant-travel/core/project"

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
  api: [
    {
      id: "@voyant-travel/bookings#api.admin",
      surface: "admin",
      mount: "bookings",
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
        actions: ["read", "write", "delete", "cancel"],
      },
      {
        id: "@voyant-travel/bookings#access.bookings-pii",
        resource: "bookings-pii",
        actions: ["read"],
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
  actions: [
    {
      id: "booking.status.confirm",
      version: "v1",
      kind: "execute",
      targetType: "booking",
      requiredScopes: ["bookings:write"],
      risk: "medium",
      ledger: "required",
      approval: "never",
      reversible: false,
      from: { routes: ["@voyant-travel/bookings#api.admin"] },
    },
    {
      id: "booking.status.expire",
      version: "v1",
      kind: "execute",
      targetType: "booking",
      requiredScopes: ["bookings:write"],
      risk: "medium",
      ledger: "required",
      approval: "never",
      reversible: false,
      from: { routes: ["@voyant-travel/bookings#api.admin"] },
    },
    {
      id: "booking.status.cancel",
      version: "v1",
      kind: "execute",
      targetType: "booking",
      requiredScopes: ["bookings:write"],
      risk: "high",
      ledger: "required",
      approval: "conditional",
      reversible: false,
      from: { routes: ["@voyant-travel/bookings#api.admin"] },
    },
    {
      id: "booking.status.start",
      version: "v1",
      kind: "execute",
      targetType: "booking",
      requiredScopes: ["bookings:write"],
      risk: "medium",
      ledger: "required",
      approval: "never",
      reversible: false,
      from: { routes: ["@voyant-travel/bookings#api.admin"] },
    },
    {
      id: "booking.status.complete",
      version: "v1",
      kind: "execute",
      targetType: "booking",
      requiredScopes: ["bookings:write"],
      risk: "medium",
      ledger: "required",
      approval: "never",
      reversible: false,
      from: { routes: ["@voyant-travel/bookings#api.admin"] },
    },
    {
      id: "booking.status.override",
      version: "v1",
      kind: "execute",
      targetType: "booking",
      requiredScopes: ["bookings:write"],
      risk: "high",
      ledger: "required",
      approval: "conditional",
      reversible: false,
      from: { routes: ["@voyant-travel/bookings#api.admin"] },
    },
    {
      id: "booking.pii.read",
      version: "v1",
      kind: "sensitive-read",
      targetType: "booking_traveler",
      requiredScopes: ["bookings-pii:read"],
      risk: "high",
      ledger: "required",
      approval: "never",
      policy: "bookings-pii-scope-or-staff-v1",
      reversible: false,
      from: { routes: ["@voyant-travel/bookings#api.admin"] },
    },
  ],
  admin: {
    routes: [
      {
        id: "@voyant-travel/bookings#admin.route.index",
        path: "/bookings",
        runtime: bookingsAdminRuntime,
      },
      {
        id: "@voyant-travel/bookings#admin.route.detail",
        path: "/bookings/$id",
        runtime: bookingsAdminRuntime,
      },
      {
        id: "@voyant-travel/bookings#admin.route.new",
        path: "/bookings/new",
        runtime: bookingsAdminRuntime,
      },
      {
        id: "@voyant-travel/bookings#admin.route.compose",
        path: "/bookings/compose",
        runtime: bookingsAdminRuntime,
      },
      {
        id: "@voyant-travel/bookings#admin.route.journey",
        path: "/catalog/journey/$entityModule/$entityId",
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

export const bookingsSupplierVoyantPlugin = definePlugin({
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
