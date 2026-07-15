import { catalogChartersRuntimeExtensionPort } from "@voyant-travel/catalog/ports"
import { defineExtension, defineModule, providePort } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the charters package. */
export const chartersVoyantModule = defineModule({
  id: "@voyant-travel/charters",
  packageName: "@voyant-travel/charters",
  localId: "charters",
  provides: { ports: [providePort(catalogChartersRuntimeExtensionPort)] },
  api: [
    {
      id: "@voyant-travel/charters#api.admin",
      surface: "admin",
      mount: "charters",
      transactional: true,
      openapi: { document: "charters" },
      runtime: {
        entry: "@voyant-travel/charters",
        export: "createChartersVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/charters#api.public",
      surface: "public",
      mount: "charters",
      anonymous: true,
      transactional: true,
      openapi: { document: "charters" },
      runtime: {
        entry: "@voyant-travel/charters",
        export: "createChartersVoyantRuntime",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/charters#schema",
      source: "@voyant-travel/charters/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/charters#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/charters#linkable.charter_product",
      kind: "linkable",
      source: "@voyant-travel/charters",
    },
    {
      id: "@voyant-travel/charters#linkable.charter_voyage",
      kind: "linkable",
      source: "@voyant-travel/charters",
    },
    {
      id: "@voyant-travel/charters#linkable.charter_yacht",
      kind: "linkable",
      source: "@voyant-travel/charters",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/charters#access.charters",
        resource: "charters",
        label: "Charters",
        description: "Charter products, yachts, voyages, availability, and pricing.",
        actions: [
          {
            action: "read",
            label: "View charters",
            description: "View charter products and related operational data.",
          },
          {
            action: "write",
            label: "Manage charters",
            description: "Create and update charter products and related operational data.",
          },
          {
            action: "delete",
            label: "Delete charters",
            description: "Delete or archive charter products and related records.",
            sensitive: true,
          },
        ],
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

export const chartersBookingVoyantPlugin = defineExtension({
  id: "@voyant-travel/charters#booking-extension",
  packageName: "@voyant-travel/charters",
  localId: "charters.booking-extension",
  api: [
    {
      id: "@voyant-travel/charters#booking-extension.api.admin",
      surface: "admin",
      mount: "bookings",
      openapi: { document: "bookings" },
      runtime: {
        entry: "@voyant-travel/charters/booking-extension",
        export: "chartersBookingExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default chartersVoyantModule
