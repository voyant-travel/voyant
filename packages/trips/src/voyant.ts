import { commerceCardPaymentRuntimePort } from "@voyant-travel/commerce/runtime-port"
import { defineModule, providePort, requirePort } from "@voyant-travel/core/project"
import { storefrontPaymentLinkRuntimePort } from "@voyant-travel/storefront/runtime-port"
import { tripsDatabaseRuntimePort, tripsRoutesRuntimePort } from "./runtime-port.js"

const catalogRuntimeServicesPortReference = { id: "catalog.runtime-services" } as const
const catalogCheckoutApiRuntimePortReference = { id: "commerce.checkout-api-options" } as const
const flightsRuntimePortReference = { id: "flights.runtime" } as const

export {
  type TripsDatabaseRuntime,
  tripsDatabaseRuntimePort,
  tripsRoutesRuntimePort,
} from "./runtime-port.js"

/** Import-cheap deployment declaration owned by the trips package. */
export const tripsVoyantModule = defineModule({
  id: "@voyant-travel/trips",
  packageName: "@voyant-travel/trips",
  localId: "trips",
  provides: {
    ports: [
      providePort(commerceCardPaymentRuntimePort),
      providePort(storefrontPaymentLinkRuntimePort),
      providePort(tripsRoutesRuntimePort),
      providePort(tripsDatabaseRuntimePort),
    ],
  },
  runtimePorts: [
    requirePort(tripsRoutesRuntimePort),
    requirePort(tripsDatabaseRuntimePort),
    catalogRuntimeServicesPortReference,
    catalogCheckoutApiRuntimePortReference,
    flightsRuntimePortReference,
  ],
  api: [
    {
      id: "@voyant-travel/trips#api.admin",
      surface: "admin",
      mount: "trips",
      openapi: { document: "trips" },
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
      openapi: { document: "trips" },
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
        label: "Trips",
        description: "Customer trips, components, pricing, reservations, and requirements.",
        actions: [
          {
            action: "read",
            label: "View trips",
            description: "View trips, components, prices, and reservation status.",
          },
          {
            action: "write",
            label: "Manage trips",
            description: "Create, revise, price, and reserve trips and their components.",
          },
          {
            action: "delete",
            label: "Delete trip components",
            description: "Remove components from a trip.",
            sensitive: true,
          },
        ],
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
    {
      id: "@voyant-travel/trips#action.reserve-trip",
      version: "v1",
      kind: "execute",
      targetType: "trip",
      requiredScopes: ["trips:write"],
      risk: "critical",
      ledger: "required",
      approval: "required",
      reversible: false,
      from: { tools: ["@voyant-travel/trips#tool.reserve-trip"] },
    },
  ],
  subscribers: [
    {
      id: "@voyant-travel/trips#subscriber.payment-completed",
      eventType: "payment.completed",
      source: "@voyant-travel/trips",
      runtime: {
        entry: "@voyant-travel/trips/payment-subscribers",
        export: "tripsPaymentCompletedSubscriber",
      },
    },
  ],
  admin: {
    compositionOrder: 90,
    runtime: {
      entry: "@voyant-travel/trips-react/admin",
      export: "createSelectedTripsAdminExtension",
    },
    routes: [
      {
        id: "@voyant-travel/trips#admin.route.trips-index",
        path: "/trips",
        requiredScopes: ["trips:read"],
        runtime: {
          entry: "@voyant-travel/trips-react/admin",
          export: "createTripsAdminExtension",
        },
      },
      {
        id: "@voyant-travel/trips#admin.route.trips-detail",
        path: "/trips/$id",
        requiredScopes: ["trips:read"],
        runtime: {
          entry: "@voyant-travel/trips-react/admin",
          export: "createTripsAdminExtension",
        },
      },
    ],
    contributions: [
      {
        id: "@voyant-travel/trips#admin.contribution.compose-booking",
        slotId: "bookings.list.header-actions",
        requiredScopes: ["trips:write"],
        runtime: {
          entry: "@voyant-travel/trips-react/admin",
          export: "createTripsAdminExtension",
        },
      },
    ],
    nav: [
      {
        id: "@voyant-travel/trips#admin.nav.trips",
        routeId: "@voyant-travel/trips#admin.route.trips-index",
        label: { namespace: "operator.admin.navigation", key: "nav.trips" },
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
