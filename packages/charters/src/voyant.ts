import { defineExtension, defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the charters package. */
export const chartersVoyantModule = defineModule({
  id: "@voyant-travel/charters",
  packageName: "@voyant-travel/charters",
  localId: "charters",
  api: [
    {
      id: "@voyant-travel/charters#api.admin",
      surface: "admin",
      mount: "charters",
      transactional: true,
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
      source: "@voyant-travel/charters",
    },
    {
      id: "@voyant-travel/charters#linkable.charter_voyage",
      source: "@voyant-travel/charters",
    },
    {
      id: "@voyant-travel/charters#linkable.charter_yacht",
      source: "@voyant-travel/charters",
    },
  ],
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
