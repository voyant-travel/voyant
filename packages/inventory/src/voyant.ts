import { defineModule, definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declarations owned by the inventory package. */
export const inventoryVoyantModule = defineModule({
  id: "@voyant-travel/inventory",
  packageName: "@voyant-travel/inventory",
  localId: "inventory",
  api: [
    {
      id: "@voyant-travel/inventory#api.admin",
      surface: "admin",
      mount: "products",
      runtime: {
        entry: "@voyant-travel/inventory",
        export: "inventoryHonoModule",
      },
    },
    {
      id: "@voyant-travel/inventory#api.public",
      surface: "public",
      mount: "products",
      runtime: {
        entry: "@voyant-travel/inventory",
        export: "inventoryHonoModule",
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
  workflows: [
    {
      id: "products.generate-pdf",
      config: {
        defaultRuntime: "node",
      },
      source: "@voyant-travel/inventory/workflows",
    },
  ],
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

export const inventoryAuthoringVoyantPlugin = definePlugin({
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

export const inventoryBookingVoyantPlugin = definePlugin({
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

export const inventoryContentVoyantPlugin = definePlugin({
  id: "@voyant-travel/inventory#content-extension",
  packageName: "@voyant-travel/inventory",
  localId: "inventory.content-extension",
  api: [
    {
      id: "@voyant-travel/inventory#content-extension.api.admin",
      surface: "admin",
      mount: "products",
      runtime: {
        entry: "@voyant-travel/inventory/routes-content",
        export: "createProductContentHonoExtension",
      },
    },
    {
      id: "@voyant-travel/inventory#content-extension.api.public",
      surface: "public",
      mount: "products",
      runtime: {
        entry: "@voyant-travel/inventory/routes-content",
        export: "createProductContentHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const inventoryBrochureVoyantPlugin = definePlugin({
  id: "@voyant-travel/inventory#brochure-extension",
  packageName: "@voyant-travel/inventory",
  localId: "inventory.brochure-extension",
  api: [
    {
      id: "@voyant-travel/inventory#brochure-extension.api.admin",
      surface: "admin",
      mount: "products",
      runtime: {
        entry: "@voyant-travel/inventory/routes-brochure",
        export: "createProductBrochureHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default inventoryVoyantModule
