import { defineModule, definePlugin } from "@voyant-travel/core/project"

/** Import-cheap deployment declarations owned by the MICE package. */
export const miceVoyantModule = defineModule({
  id: "@voyant-travel/mice",
  packageName: "@voyant-travel/mice",
  localId: "mice",
  api: [
    {
      id: "@voyant-travel/mice#api.admin",
      surface: "admin",
      mount: "mice",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/mice",
        export: "createMiceHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/mice#schema",
      source: "@voyant-travel/mice/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/mice#migrations",
      source: "./migrations",
    },
  ],
  links: [
    { id: "@voyant-travel/mice#linkable.program", source: "@voyant-travel/mice/linkables" },
    { id: "@voyant-travel/mice#linkable.session", source: "@voyant-travel/mice/linkables" },
    { id: "@voyant-travel/mice#linkable.delegate", source: "@voyant-travel/mice/linkables" },
    {
      id: "@voyant-travel/mice#linkable.roomingAssignment",
      source: "@voyant-travel/mice/linkables",
    },
    { id: "@voyant-travel/mice#linkable.rfp", source: "@voyant-travel/mice/linkables" },
    { id: "@voyant-travel/mice#linkable.bid", source: "@voyant-travel/mice/linkables" },
  ],
  events: [
    {
      id: "@voyant-travel/mice#event.rfp-awarded",
      eventType: "mice.rfp.awarded",
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const miceBookingVoyantPlugin = definePlugin({
  id: "@voyant-travel/mice#booking-extension",
  packageName: "@voyant-travel/mice",
  localId: "mice.booking-extension",
  api: [
    {
      id: "@voyant-travel/mice#booking-extension.api.admin",
      surface: "admin",
      mount: "bookings",
      runtime: {
        entry: "@voyant-travel/mice/booking-extension",
        export: "miceBookingExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default miceVoyantModule
