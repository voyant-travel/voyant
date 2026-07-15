import { defineModule, providePort, requirePort } from "@voyant-travel/core/project"
import { flightsRuntimePort } from "./runtime-port.js"

/** Import-cheap deployment declaration owned by the flights package. */
export const flightsVoyantModule = defineModule({
  id: "@voyant-travel/flights",
  packageName: "@voyant-travel/flights",
  localId: "flights",
  provides: { ports: [providePort(flightsRuntimePort)] },
  runtimePorts: [requirePort(flightsRuntimePort)],
  requires: { capabilities: ["finance.payment-sessions"] },
  api: [
    {
      id: "@voyant-travel/flights#api",
      surface: "admin",
      mount: "flights",
      openapi: { document: "flights" },
      runtime: {
        entry: "@voyant-travel/flights/hono",
        export: "createFlightsVoyantRuntime",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/flights#schema",
      source: "@voyant-travel/flights/reference/local-postgres",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/flights#migrations",
      source: "./migrations",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/flights#access.flights",
        resource: "flights",
        label: "Flights",
        description: "Flight search, pricing, booking, orders, ticketing, and reference data.",
        actions: [
          {
            action: "read",
            label: "View flights",
            description: "View flight orders and reference data.",
          },
          {
            action: "write",
            label: "Manage flights",
            description: "Search, price, book, ticket, and cancel flights.",
          },
        ],
      },
    ],
  },
  admin: {
    compositionOrder: 50,
    runtime: {
      entry: "@voyant-travel/flights-react/admin",
      export: "createSelectedFlightsAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/flights#admin.copy",
        namespace: "flights.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/flights-react/i18n",
          export: "flightsUiMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/flights#admin.route.flights-index",
        path: "/flights",
        requiredScopes: ["flights:write"],
        runtime: {
          entry: "@voyant-travel/flights-react/admin",
          export: "createFlightsAdminExtension",
        },
      },
      {
        id: "@voyant-travel/flights#admin.route.flights-book",
        path: "/flights/book/$offerId",
        requiredScopes: ["flights:write"],
        runtime: {
          entry: "@voyant-travel/flights-react/admin",
          export: "createFlightsAdminExtension",
        },
      },
      {
        id: "@voyant-travel/flights#admin.route.flights-orders",
        path: "/flights/orders",
        requiredScopes: ["flights:read"],
        runtime: {
          entry: "@voyant-travel/flights-react/admin",
          export: "createFlightsAdminExtension",
        },
      },
      {
        id: "@voyant-travel/flights#admin.route.flights-order-detail",
        path: "/flights/orders/$orderId",
        requiredScopes: ["flights:read"],
        runtime: {
          entry: "@voyant-travel/flights-react/admin",
          export: "createFlightsAdminExtension",
        },
      },
    ],
    nav: [
      {
        id: "@voyant-travel/flights#admin.nav.flights",
        routeId: "@voyant-travel/flights#admin.route.flights-index",
        label: { namespace: "operator.admin.navigation", key: "nav.flights" },
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

export default flightsVoyantModule
