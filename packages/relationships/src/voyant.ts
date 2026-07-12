import { defineModule, requirePort } from "@voyant-travel/core/project"
import { relationshipsRouteRuntimePort } from "./runtime-port.js"

export { relationshipsRouteRuntimePort } from "./runtime-port.js"

const relationshipsAdminRuntime = {
  entry: "@voyant-travel/relationships-react/admin",
  export: "createRelationshipsAdminExtension",
} as const

/** Import-cheap deployment declaration owned by the relationships package. */
export const relationshipsVoyantModule = defineModule({
  id: "@voyant-travel/relationships",
  packageName: "@voyant-travel/relationships",
  localId: "relationships",
  runtimePorts: [requirePort(relationshipsRouteRuntimePort)],
  api: [
    {
      id: "@voyant-travel/relationships#api.admin",
      surface: "admin",
      mount: "relationships",
      openapi: { document: "relationships" },
      transactional: true,
      runtime: {
        entry: "@voyant-travel/relationships",
        export: "createRelationshipsVoyantRuntime",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/relationships#schema",
      source: "@voyant-travel/relationships/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/relationships#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/relationships#linkable.organization",
      source: "@voyant-travel/relationships/linkables",
    },
    {
      id: "@voyant-travel/relationships#linkable.person",
      source: "@voyant-travel/relationships/linkables",
    },
  ],
  events: [
    {
      id: "@voyant-travel/relationships#event.customer.signal.created",
      eventType: "customer.signal.created",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "relationships", category: "domain" },
    },
    {
      id: "@voyant-travel/relationships#event.person.changed",
      eventType: "person.changed",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "relationships", category: "domain" },
    },
    {
      id: "@voyant-travel/relationships#event.organization.changed",
      eventType: "organization.changed",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "relationships", category: "domain" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/relationships#access.crm",
        resource: "crm",
        actions: ["read", "write", "delete"],
      },
      {
        id: "@voyant-travel/relationships#access.relationships-pii",
        resource: "relationships-pii",
        actions: ["read"],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/relationships#tool.list-people",
      name: "list_people",
      runtime: { entry: "@voyant-travel/relationships/tools", export: "listPeopleTool" },
      requiredScopes: ["crm:read"],
      context: ["relationships"],
    },
    {
      id: "@voyant-travel/relationships#tool.get-person",
      name: "get_person",
      runtime: { entry: "@voyant-travel/relationships/tools", export: "getPersonTool" },
      requiredScopes: ["crm:read"],
      context: ["relationships"],
    },
    {
      id: "@voyant-travel/relationships#tool.list-organizations",
      name: "list_organizations",
      runtime: {
        entry: "@voyant-travel/relationships/tools",
        export: "listOrganizationsTool",
      },
      requiredScopes: ["crm:read"],
      context: ["relationships"],
    },
    {
      id: "@voyant-travel/relationships#tool.get-organization",
      name: "get_organization",
      runtime: { entry: "@voyant-travel/relationships/tools", export: "getOrganizationTool" },
      requiredScopes: ["crm:read"],
      context: ["relationships"],
    },
  ],
  actions: [
    {
      id: "relationships.person_document.reveal",
      version: "v1",
      kind: "sensitive-read",
      targetType: "person_document",
      requiredScopes: ["relationships-pii:read"],
      risk: "high",
      ledger: "required",
      approval: "never",
      policy: "scope_grant",
      reversible: false,
      from: { routes: ["@voyant-travel/relationships#api.admin"] },
    },
  ],
  admin: {
    compositionOrder: 20,
    runtime: {
      entry: "@voyant-travel/relationships-react/admin",
      export: "createSelectedRelationshipsAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/relationships#admin.copy",
        namespace: "relationships.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/relationships-react/i18n",
          export: "crmUiMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/relationships#admin.route.people-index",
        path: "/people",
        runtime: relationshipsAdminRuntime,
      },
      {
        id: "@voyant-travel/relationships#admin.route.people-detail",
        path: "/people/$id",
        runtime: relationshipsAdminRuntime,
      },
      {
        id: "@voyant-travel/relationships#admin.route.organizations-index",
        path: "/organizations",
        runtime: relationshipsAdminRuntime,
      },
      {
        id: "@voyant-travel/relationships#admin.route.organizations-detail",
        path: "/organizations/$id",
        runtime: relationshipsAdminRuntime,
      },
      {
        id: "@voyant-travel/relationships#admin.route.custom-fields",
        path: "/settings/custom-fields",
        runtime: relationshipsAdminRuntime,
      },
    ],
    slots: [
      {
        id: "person.details.bookings-tab",
        routeId: "@voyant-travel/relationships#admin.route.people-detail",
        contract: { personId: "string" },
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

export default relationshipsVoyantModule
