import { catalogContentRuntimePort } from "@voyant-travel/catalog/runtime-port"
import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the accommodations package. */
export const accommodationsVoyantModule = defineModule({
  id: "@voyant-travel/accommodations",
  packageName: "@voyant-travel/accommodations",
  localId: "accommodations",
  api: [
    {
      id: "@voyant-travel/accommodations#api",
      surface: "admin",
      mount: "accommodations",
      transactional: true,
      openapi: { document: "accommodations" },
      runtime: {
        entry: "@voyant-travel/accommodations",
        export: "accommodationsHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/accommodations#schema",
      source: "@voyant-travel/accommodations/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/accommodations#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/accommodations#linkable.roomBlock",
      source: "@voyant-travel/accommodations/linkables",
    },
    {
      id: "@voyant-travel/accommodations#link.program-room-block",
      source: "@voyant-travel/accommodations/standard-links",
      export: "programRoomBlockLink",
    },
    {
      id: "@voyant-travel/accommodations#link.room-block-property",
      source: "@voyant-travel/accommodations/standard-links",
      export: "roomBlockPropertyLink",
    },
    {
      id: "@voyant-travel/accommodations#link.room-block-supplier",
      source: "@voyant-travel/accommodations/standard-links",
      export: "roomBlockSupplierLink",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/accommodations#access.accommodations",
        resource: "accommodations",
        actions: ["read", "write"],
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

export const accommodationsContentVoyantPlugin = defineExtension({
  id: "@voyant-travel/accommodations#content-extension",
  packageName: "@voyant-travel/accommodations",
  localId: "accommodations.content-extension",
  runtimePorts: [requirePort(catalogContentRuntimePort)],
  api: [
    {
      id: "@voyant-travel/accommodations#content-extension.api.admin",
      surface: "admin",
      mount: "accommodations",
      openapi: { document: "accommodations" },
      runtime: {
        entry: "@voyant-travel/accommodations/graph-runtime",
        export: "createAccommodationsContentVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/accommodations#content-extension.api.public",
      surface: "public",
      mount: "accommodations",
      anonymous: true,
      openapi: { document: "accommodations-content-public" },
      runtime: {
        entry: "@voyant-travel/accommodations/graph-runtime",
        export: "createAccommodationsContentVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default accommodationsVoyantModule
