import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import { relationshipsMiceRuntimePort } from "@voyant-travel/relationships/voyant"
import { miceRuntimePort } from "./runtime-port.js"

/** Import-cheap deployment declarations owned by the MICE package. */
export const miceVoyantModule = defineModule({
  id: "@voyant-travel/mice",
  packageName: "@voyant-travel/mice",
  localId: "mice",
  runtimePorts: [requirePort(miceRuntimePort), requirePort(relationshipsMiceRuntimePort)],
  api: [
    {
      id: "@voyant-travel/mice#api.admin",
      surface: "admin",
      mount: "mice",
      openapi: { document: "mice" },
      transactional: true,
      runtime: {
        entry: "@voyant-travel/mice",
        export: "createMiceVoyantRuntime",
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
    {
      id: "@voyant-travel/mice#link.bid-supplier",
      source: "@voyant-travel/mice/standard-links",
      export: "bidSupplierLink",
    },
    {
      id: "@voyant-travel/mice#link.delegate-booking",
      source: "@voyant-travel/mice/standard-links",
      export: "delegateBookingLink",
    },
    {
      id: "@voyant-travel/mice#link.delegate-person",
      source: "@voyant-travel/mice/standard-links",
      export: "delegatePersonLink",
    },
    {
      id: "@voyant-travel/mice#link.organization-program",
      source: "@voyant-travel/mice/standard-links",
      export: "organizationProgramLink",
    },
    {
      id: "@voyant-travel/mice#link.program-space-block",
      source: "@voyant-travel/mice/standard-links",
      export: "programSpaceBlockLink",
    },
    {
      id: "@voyant-travel/mice#link.rooming-room-block",
      source: "@voyant-travel/mice/standard-links",
      export: "roomingRoomBlockLink",
    },
    {
      id: "@voyant-travel/mice#link.session-function-space",
      source: "@voyant-travel/mice/standard-links",
      export: "sessionFunctionSpaceLink",
    },
  ],
  events: [
    {
      id: "@voyant-travel/mice#event.rfp-awarded",
      eventType: "mice.rfp.awarded",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "mice", category: "domain" },
    },
  ],
  admin: {
    compositionOrder: 110,
    runtime: {
      entry: "@voyant-travel/mice-react/admin",
      export: "createSelectedMiceAdminExtension",
    },
    routes: [
      {
        id: "@voyant-travel/mice#admin.route.programs-index",
        path: "/mice",
        runtime: {
          entry: "@voyant-travel/mice-react/admin",
          export: "createSelectedMiceAdminExtension",
        },
      },
      {
        id: "@voyant-travel/mice#admin.route.programs-detail",
        path: "/mice/$id",
        runtime: {
          entry: "@voyant-travel/mice-react/admin",
          export: "createSelectedMiceAdminExtension",
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

export const miceBookingVoyantPlugin = defineExtension({
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

/** Neutral association selected explicitly by the standard product BOM. */
export const miceStandardProductLinksVoyantExtension = defineExtension({
  id: "@voyant-travel/mice#standard-product-links",
  packageName: "@voyant-travel/mice",
  localId: "mice.standard-product-links",
  links: [
    {
      id: "@voyant-travel/mice#link.quote-program",
      source: "@voyant-travel/mice/standard-links",
      export: "quoteProgramLink",
    },
  ],
  meta: { ownership: "standard-product" },
})

export default miceVoyantModule
