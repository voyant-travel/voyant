import { catalogContentRuntimePort } from "@voyant-travel/catalog/runtime-port"
import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import { cruisesRoutesRuntimePort } from "./runtime-port.js"

/** Import-cheap deployment declaration owned by the cruises package. */
export const cruisesVoyantModule = defineModule({
  id: "@voyant-travel/cruises",
  packageName: "@voyant-travel/cruises",
  localId: "cruises",
  runtimePorts: [requirePort(cruisesRoutesRuntimePort)],
  api: [
    {
      id: "@voyant-travel/cruises#api.admin",
      surface: "admin",
      mount: "cruises",
      transactional: true,
      openapi: { document: "cruises" },
      runtime: {
        entry: "@voyant-travel/cruises",
        export: "createCruisesVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/cruises#api.public",
      surface: "public",
      mount: "cruises",
      anonymous: true,
      transactional: true,
      openapi: { document: "cruises" },
      runtime: {
        entry: "@voyant-travel/cruises",
        export: "createCruisesVoyantRuntime",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/cruises#schema",
      source: "@voyant-travel/cruises/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/cruises#migrations",
      source: "./migrations",
    },
  ],
  links: [
    { id: "@voyant-travel/cruises#linkable.cruise", source: "@voyant-travel/cruises" },
    {
      id: "@voyant-travel/cruises#linkable.cruise_voyage_group",
      source: "@voyant-travel/cruises",
    },
    {
      id: "@voyant-travel/cruises#linkable.cruise_sailing",
      source: "@voyant-travel/cruises",
    },
    { id: "@voyant-travel/cruises#linkable.cruise_ship", source: "@voyant-travel/cruises" },
  ],
  events: [
    {
      id: "@voyant-travel/cruises#event.cruise-created",
      eventType: "cruise.created",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "cruises", category: "domain" },
    },
    {
      id: "@voyant-travel/cruises#event.cruise-updated",
      eventType: "cruise.updated",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "cruises", category: "domain" },
    },
    {
      id: "@voyant-travel/cruises#event.cruise-deleted",
      eventType: "cruise.deleted",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "cruises", category: "domain" },
    },
  ],
  workflows: [
    {
      id: "cruises.external-catalog-refresh",
      config: { defaultRuntime: "node" },
      schedules: [
        {
          id: "external-cruise-catalog-refresh",
          workflowId: "cruises.external-catalog-refresh",
          cron: "30 3 * * *",
          name: "nightly",
        },
      ],
      runtime: {
        entry: "@voyant-travel/cruises/external-refresh-workflow",
        export: "cruisesExternalCatalogRefreshWorkflow",
      },
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const cruisesContentVoyantPlugin = defineExtension({
  id: "@voyant-travel/cruises#content-extension",
  packageName: "@voyant-travel/cruises",
  localId: "cruises.content-extension",
  runtimePorts: [requirePort(catalogContentRuntimePort)],
  api: [
    {
      id: "@voyant-travel/cruises#content-extension.api.admin",
      surface: "admin",
      mount: "cruises",
      openapi: { document: "cruises" },
      runtime: {
        entry: "@voyant-travel/cruises/graph-runtime",
        export: "createCruisesContentVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/cruises#content-extension.api.public",
      surface: "public",
      mount: "cruises",
      openapi: { document: "cruises" },
      runtime: {
        entry: "@voyant-travel/cruises/graph-runtime",
        export: "createCruisesContentVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const cruisesBookingVoyantPlugin = defineExtension({
  id: "@voyant-travel/cruises#booking-extension",
  packageName: "@voyant-travel/cruises",
  localId: "cruises.booking-extension",
  api: [
    {
      id: "@voyant-travel/cruises#booking-extension.api.admin",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "bookings" },
      runtime: {
        entry: "@voyant-travel/cruises/booking-extension",
        export: "cruisesBookingExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default cruisesVoyantModule
