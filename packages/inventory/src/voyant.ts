import { catalogContentRuntimePort } from "@voyant-travel/catalog/graph-runtime"
import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import { inventoryBrochureRuntimePort, inventoryRuntimePort } from "./runtime-ports.js"

/** Import-cheap deployment declarations owned by the inventory package. */
export const inventoryVoyantModule = defineModule({
  id: "@voyant-travel/inventory",
  packageName: "@voyant-travel/inventory",
  localId: "inventory",
  runtimePorts: [requirePort(inventoryRuntimePort)],
  api: [
    {
      id: "@voyant-travel/inventory#api.admin",
      surface: "admin",
      mount: "products",
      runtime: {
        entry: "@voyant-travel/inventory/graph-runtime",
        export: "createInventoryVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/inventory#api.public",
      surface: "public",
      mount: "products",
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/inventory/graph-runtime",
        export: "createInventoryVoyantRuntime",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/inventory#schema",
      source: "@voyant-travel/inventory/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/inventory#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/inventory#linkable.product",
      source: "@voyant-travel/inventory/linkables",
    },
  ],
  events: [
    {
      id: "@voyant-travel/inventory#event.product-created",
      eventType: "product.created",
    },
    {
      id: "@voyant-travel/inventory#event.product-updated",
      eventType: "product.updated",
    },
    {
      id: "@voyant-travel/inventory#event.product-deleted",
      eventType: "product.deleted",
    },
    {
      id: "@voyant-travel/inventory#event.product-content-changed",
      eventType: "product.content.changed",
    },
  ],
  workflows: [
    {
      id: "products.generate-pdf",
      config: {
        defaultRuntime: "node",
      },
      source: "@voyant-travel/inventory/workflows",
      runtime: {
        entry: "@voyant-travel/inventory/workflows",
        export: "productsGeneratePdfWorkflow",
      },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/inventory#access.products",
        resource: "products",
        actions: ["read"],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/inventory#tool.list-products",
      name: "list_products",
      runtime: {
        entry: "@voyant-travel/inventory/tools",
        export: "listProductsTool",
      },
      requiredScopes: ["products:read"],
      context: ["inventory"],
      risk: "low",
    },
    {
      id: "@voyant-travel/inventory#tool.get-product",
      name: "get_product",
      runtime: {
        entry: "@voyant-travel/inventory/tools",
        export: "getProductTool",
      },
      requiredScopes: ["products:read"],
      context: ["inventory"],
      risk: "low",
    },
  ],
  actions: [
    {
      id: "@voyant-travel/inventory#action.list-products",
      version: "v1",
      kind: "read",
      targetType: "product",
      requiredScopes: ["products:read"],
      risk: "low",
      ledger: "optional",
      from: { tools: ["@voyant-travel/inventory#tool.list-products"] },
    },
    {
      id: "@voyant-travel/inventory#action.get-product",
      version: "v1",
      kind: "read",
      targetType: "product",
      requiredScopes: ["products:read"],
      risk: "low",
      ledger: "optional",
      from: { tools: ["@voyant-travel/inventory#tool.get-product"] },
    },
  ],
  admin: {
    compositionOrder: 3,
    runtime: {
      entry: "@voyant-travel/inventory-react/admin",
      export: "createSelectedInventoryAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/inventory#admin.copy",
        namespace: "inventory.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/inventory-react/i18n",
          export: "productsUiMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/inventory#admin.route.products-index",
        path: "/products",
        runtime: {
          entry: "@voyant-travel/inventory-react/admin",
          export: "createInventoryAdminExtension",
        },
      },
      {
        id: "@voyant-travel/inventory#admin.route.products-categories",
        path: "/products/categories",
        runtime: {
          entry: "@voyant-travel/inventory-react/admin",
          export: "createInventoryAdminExtension",
        },
      },
      {
        id: "@voyant-travel/inventory#admin.route.products-detail",
        path: "/products/$id",
        runtime: {
          entry: "@voyant-travel/inventory-react/admin",
          export: "createInventoryAdminExtension",
        },
      },
    ],
    slots: [
      {
        id: "product.details.option-extras",
        routeId: "@voyant-travel/inventory#admin.route.products-detail",
        contract: { productId: "string", optionId: "string" },
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

export const inventoryExtrasVoyantModule = defineModule({
  id: "@voyant-travel/inventory#extras",
  packageName: "@voyant-travel/inventory",
  localId: "inventory.extras",
  api: [
    {
      id: "@voyant-travel/inventory#extras.api",
      surface: "admin",
      mount: "extras",
      runtime: {
        entry: "@voyant-travel/inventory/extras",
        export: "inventoryExtrasHonoModule",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const inventoryAuthoringVoyantPlugin = defineExtension({
  id: "@voyant-travel/inventory#authoring.extension",
  packageName: "@voyant-travel/inventory",
  localId: "inventory.authoring.extension",
  api: [
    {
      id: "@voyant-travel/inventory#authoring.extension.api",
      surface: "admin",
      mount: "products",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/inventory/authoring/extension",
        export: "inventoryAuthoringExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const inventoryBookingVoyantPlugin = defineExtension({
  id: "@voyant-travel/inventory#booking-extension",
  packageName: "@voyant-travel/inventory",
  localId: "inventory.booking-extension",
  api: [
    {
      id: "@voyant-travel/inventory#booking-extension.api",
      surface: "admin",
      mount: "bookings",
      runtime: {
        entry: "@voyant-travel/inventory/booking-extension",
        export: "productsBookingExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const inventoryContentVoyantPlugin = defineExtension({
  id: "@voyant-travel/inventory#content-extension",
  packageName: "@voyant-travel/inventory",
  localId: "inventory.content-extension",
  runtimePorts: [requirePort(catalogContentRuntimePort)],
  api: [
    {
      id: "@voyant-travel/inventory#content-extension.api.admin",
      surface: "admin",
      mount: "products",
      runtime: {
        entry: "@voyant-travel/inventory/graph-runtime",
        export: "createInventoryContentVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/inventory#content-extension.api.public",
      surface: "public",
      mount: "products",
      anonymous: true,
      runtime: {
        entry: "@voyant-travel/inventory/graph-runtime",
        export: "createInventoryContentVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const inventoryBrochureVoyantPlugin = defineExtension({
  id: "@voyant-travel/inventory#brochure-extension",
  packageName: "@voyant-travel/inventory",
  localId: "inventory.brochure-extension",
  runtimePorts: [requirePort(inventoryBrochureRuntimePort)],
  api: [
    {
      id: "@voyant-travel/inventory#brochure-extension.api.admin",
      surface: "admin",
      mount: "products",
      runtime: {
        entry: "@voyant-travel/inventory/graph-runtime",
        export: "createInventoryBrochureVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default inventoryVoyantModule
