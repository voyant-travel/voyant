import {
  defineExtension,
  defineModule,
  providePort,
  requirePort,
} from "@voyant-travel/core/project"
import { miceRuntimePort } from "./runtime-port.js"

const relationshipsMiceRuntimePortReference = { id: "relationships.mice.runtime" } as const

const miceRfpAwardedEventPayloadSchema = {
  type: "object",
  properties: {
    rfpId: { type: "string" },
    programId: { type: "string" },
    bidId: { type: "string" },
    supplierId: { type: "string" },
    actorId: { type: ["string", "null"] },
    awardedAt: { type: "string", format: "date-time" },
  },
  required: ["rfpId", "programId", "bidId", "supplierId", "actorId", "awardedAt"],
  additionalProperties: false,
} as const

/** Import-cheap deployment declarations owned by the MICE package. */
export const miceVoyantModule = defineModule({
  id: "@voyant-travel/mice",
  packageName: "@voyant-travel/mice",
  localId: "mice",
  provides: { ports: [providePort(miceRuntimePort)] },
  runtimePorts: [requirePort(miceRuntimePort), relationshipsMiceRuntimePortReference],
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
  access: {
    resources: [
      {
        id: "@voyant-travel/mice#access.mice",
        resource: "mice",
        label: "MICE programs",
        description: "Meetings and events programs, sessions, delegates, rooming, RFPs, and bids.",
        actions: [
          {
            action: "read",
            label: "View MICE programs",
            description: "View meetings and events programs and related records.",
          },
          {
            action: "write",
            label: "Manage MICE programs",
            description: "Create and update meetings and events programs and related records.",
          },
          {
            action: "delete",
            label: "Delete MICE records",
            description: "Delete sessions and other supported meetings and events records.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  events: [
    {
      id: "@voyant-travel/mice#event.rfp-awarded",
      eventType: "mice.rfp.awarded",
      version: "1.0.0",
      payloadSchema: miceRfpAwardedEventPayloadSchema,
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
        requiredScopes: ["mice:read"],
        runtime: {
          entry: "@voyant-travel/mice-react/admin",
          export: "createSelectedMiceAdminExtension",
        },
      },
      {
        id: "@voyant-travel/mice#admin.route.programs-detail",
        path: "/mice/$id",
        requiredScopes: ["mice:read"],
        runtime: {
          entry: "@voyant-travel/mice-react/admin",
          export: "createSelectedMiceAdminExtension",
        },
      },
    ],
    nav: [
      {
        id: "@voyant-travel/mice#admin.nav.programs",
        routeId: "@voyant-travel/mice#admin.route.programs-index",
        label: { namespace: "operator.admin.navigation", key: "nav.mice" },
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
      openapi: { document: "mice-booking" },
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
