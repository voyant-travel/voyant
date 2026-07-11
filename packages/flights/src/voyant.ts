import { defineModule, requirePort } from "@voyant-travel/core/project"
import { flightsRuntimePort } from "./runtime-port.js"

/** Import-cheap deployment declaration owned by the flights package. */
export const flightsVoyantModule = defineModule({
  id: "@voyant-travel/flights",
  packageName: "@voyant-travel/flights",
  localId: "flights",
  runtimePorts: [requirePort(flightsRuntimePort)],
  requires: { capabilities: ["finance.payment-sessions"] },
  api: [
    {
      id: "@voyant-travel/flights#api",
      surface: "admin",
      mount: "flights",
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
  admin: {
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
        runtime: {
          entry: "@voyant-travel/flights-react/admin",
          export: "createFlightsAdminExtension",
        },
      },
      {
        id: "@voyant-travel/flights#admin.route.flights-book",
        path: "/flights/book/$offerId",
        runtime: {
          entry: "@voyant-travel/flights-react/admin",
          export: "createFlightsAdminExtension",
        },
      },
      {
        id: "@voyant-travel/flights#admin.route.flights-orders",
        path: "/flights/orders",
        runtime: {
          entry: "@voyant-travel/flights-react/admin",
          export: "createFlightsAdminExtension",
        },
      },
      {
        id: "@voyant-travel/flights#admin.route.flights-order-detail",
        path: "/flights/orders/$orderId",
        runtime: {
          entry: "@voyant-travel/flights-react/admin",
          export: "createFlightsAdminExtension",
        },
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
