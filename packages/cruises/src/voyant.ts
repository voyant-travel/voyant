import { defineModule, definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the cruises package. */
export const cruisesVoyantModule = defineModule({
  id: "@voyant-travel/cruises",
  packageName: "@voyant-travel/cruises",
  localId: "cruises",
  api: [
    {
      id: "@voyant-travel/cruises#api.admin",
      surface: "admin",
      mount: "cruises",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/cruises",
        export: "createCruisesHonoModule",
      },
    },
    {
      id: "@voyant-travel/cruises#api.public",
      surface: "public",
      mount: "cruises",
      anonymous: true,
      transactional: true,
      runtime: {
        entry: "@voyant-travel/cruises",
        export: "createCruisesHonoModule",
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
  meta: {
    ownership: "package",
  },
})

export const cruisesContentVoyantPlugin = definePlugin({
  id: "@voyant-travel/cruises#content-extension",
  packageName: "@voyant-travel/cruises",
  localId: "cruises.content-extension",
  api: [
    {
      id: "@voyant-travel/cruises#content-extension.api.admin",
      surface: "admin",
      mount: "cruises",
      runtime: {
        entry: "@voyant-travel/cruises/routes-content",
        export: "createCruiseContentHonoExtension",
      },
    },
    {
      id: "@voyant-travel/cruises#content-extension.api.public",
      surface: "public",
      mount: "cruises",
      runtime: {
        entry: "@voyant-travel/cruises/routes-content",
        export: "createCruiseContentHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const cruisesBookingVoyantPlugin = definePlugin({
  id: "@voyant-travel/cruises#booking-extension",
  packageName: "@voyant-travel/cruises",
  localId: "cruises.booking-extension",
  api: [
    {
      id: "@voyant-travel/cruises#booking-extension.api.admin",
      surface: "admin",
      mount: "bookings",
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
