import { defineModule, requirePort } from "@voyant-travel/core/project"
import { tripsDatabaseRuntimePort, tripsRoutesRuntimePort } from "./runtime-port.js"

export { tripsDatabaseRuntimePort, tripsRoutesRuntimePort } from "./runtime-port.js"

/** Import-cheap deployment declaration owned by the trips package. */
export const tripsVoyantModule = defineModule({
  id: "@voyant-travel/trips",
  packageName: "@voyant-travel/trips",
  localId: "trips",
  runtimePorts: [requirePort(tripsRoutesRuntimePort), requirePort(tripsDatabaseRuntimePort)],
  api: [
    {
      id: "@voyant-travel/trips#api.admin",
      surface: "admin",
      mount: "trips",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/trips",
        export: "createTripsVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/trips#api.public",
      surface: "public",
      mount: "trips",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/trips",
        export: "createTripsVoyantRuntime",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/trips#schema",
      source: "@voyant-travel/trips/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/trips#migrations",
      source: "./migrations",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/trips#access.trips",
        resource: "trips",
        actions: ["read", "write"],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/trips#tool.create-trip",
      name: "create_trip",
      runtime: { entry: "@voyant-travel/trips/tools", export: "createTripTool" },
      requiredScopes: ["trips:write"],
      context: ["trips"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/trips#tool.revise-trip",
      name: "revise_trip",
      runtime: { entry: "@voyant-travel/trips/tools", export: "reviseTripTool" },
      requiredScopes: ["trips:write"],
      context: ["trips"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/trips#tool.price-trip",
      name: "price_trip",
      runtime: { entry: "@voyant-travel/trips/tools", export: "priceTripTool" },
      requiredScopes: ["trips:read"],
      context: ["trips"],
      risk: "low",
    },
    {
      id: "@voyant-travel/trips#tool.reserve-trip",
      name: "reserve_trip",
      runtime: { entry: "@voyant-travel/trips/tools", export: "reserveTripTool" },
      requiredScopes: ["trips:write"],
      context: ["trips"],
      risk: "critical",
    },
  ],
  actions: [
    {
      id: "@voyant-travel/trips#action.create-trip",
      version: "v1",
      kind: "execute",
      targetType: "trip",
      requiredScopes: ["trips:write"],
      risk: "medium",
      ledger: "optional",
      reversible: true,
      from: { tools: ["@voyant-travel/trips#tool.create-trip"] },
    },
    {
      id: "@voyant-travel/trips#action.revise-trip",
      version: "v1",
      kind: "execute",
      targetType: "trip",
      requiredScopes: ["trips:write"],
      risk: "medium",
      ledger: "optional",
      reversible: true,
      from: { tools: ["@voyant-travel/trips#tool.revise-trip"] },
    },
    {
      id: "@voyant-travel/trips#action.price-trip",
      version: "v1",
      kind: "read",
      targetType: "trip",
      requiredScopes: ["trips:read"],
      risk: "low",
      ledger: "optional",
      from: { tools: ["@voyant-travel/trips#tool.price-trip"] },
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/trips#subscriber.payment-completed",
      eventType: "payment.completed",
      source: "@voyant-travel/trips",
      runtime: {
        entry: "./payment-subscribers",
        export: "tripsPaymentCompletedSubscriber",
      },
    },
  ],
  admin: {
    routes: [
      {
        id: "@voyant-travel/trips#admin.route.trips-index",
        path: "/trips",
        runtime: {
          entry: "@voyant-travel/trips-react/admin",
          export: "createTripsAdminExtension",
        },
      },
      {
        id: "@voyant-travel/trips#admin.route.trips-detail",
        path: "/trips/$id",
        runtime: {
          entry: "@voyant-travel/trips-react/admin",
          export: "createTripsAdminExtension",
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

export default tripsVoyantModule
