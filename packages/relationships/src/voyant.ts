import { bookingsRelationshipsRuntimePort } from "@voyant-travel/bookings/runtime-port"
import { defineModule, providePort, requirePort } from "@voyant-travel/core/project"
import { relationshipsMiceRuntimePort, relationshipsRouteRuntimePort } from "./runtime-port.js"

export {
  type RelationshipsMiceRuntime,
  relationshipsMiceRuntimePort,
  relationshipsRouteRuntimePort,
} from "./runtime-port.js"

const relationshipsAdminRuntime = {
  entry: "@voyant-travel/relationships-react/admin",
  export: "createRelationshipsAdminExtension",
} as const

const storefrontIntakeRuntimePortReference = { id: "storefront.intake.runtime" } as const

const customerSignalCreatedPayloadSchema = {
  type: "object",
  required: ["id", "personId", "kind", "source", "status"],
  properties: {
    id: { type: "string" },
    personId: { type: "string" },
    kind: { enum: ["wishlist", "notify", "inquiry", "request_offer", "referral"] },
    source: { enum: ["form", "phone", "admin", "abandoned_cart", "website", "booking"] },
    status: { enum: ["new", "contacted", "qualified", "converted", "lost", "expired"] },
    productId: { type: ["string", "null"] },
    optionUnitId: { type: ["string", "null"] },
    sourceSubmissionId: { type: ["string", "null"] },
    intake: {
      oneOf: [
        {
          type: "object",
          required: ["surface", "type"],
          properties: {
            surface: { const: "storefront" },
            type: { const: "lead" },
          },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["surface", "type", "doubleOptIn"],
          properties: {
            surface: { const: "storefront" },
            type: { const: "newsletter" },
            doubleOptIn: { enum: ["not_configured", "requested"] },
          },
          additionalProperties: false,
        },
      ],
    },
  },
  additionalProperties: false,
} as const

const relationshipChangedPayloadSchema = {
  type: "object",
  required: ["id", "action"],
  properties: {
    id: { type: "string" },
    action: { enum: ["created", "updated", "deleted"] },
  },
  additionalProperties: false,
} as const

/** Import-cheap deployment declaration owned by the relationships package. */
export const relationshipsVoyantModule = defineModule({
  id: "@voyant-travel/relationships",
  packageName: "@voyant-travel/relationships",
  localId: "relationships",
  provides: {
    ports: [
      providePort(storefrontIntakeRuntimePortReference),
      providePort(relationshipsMiceRuntimePort),
      providePort(bookingsRelationshipsRuntimePort),
      providePort(relationshipsRouteRuntimePort),
    ],
  },
  runtimePorts: [requirePort(relationshipsRouteRuntimePort)],
  api: [
    {
      id: "@voyant-travel/relationships#api.admin",
      surface: "admin",
      mount: "relationships",
      openapi: { document: "relationships" },
      resource: "crm",
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
      payloadSchema: customerSignalCreatedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "relationships", category: "domain" },
    },
    {
      id: "@voyant-travel/relationships#event.person.changed",
      eventType: "person.changed",
      version: "1.0.0",
      payloadSchema: relationshipChangedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "relationships", category: "domain" },
    },
    {
      id: "@voyant-travel/relationships#event.organization.changed",
      eventType: "organization.changed",
      version: "1.0.0",
      payloadSchema: relationshipChangedPayloadSchema,
      visibility: "internal",
      audit: { sourceModule: "relationships", category: "domain" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/relationships#access.crm",
        resource: "crm",
        label: "Customer relationships",
        description: "Read and manage people, organizations, and customer relationship records.",
        actions: [
          {
            action: "read",
            label: "Read customer relationships",
            description: "Read people, organizations, and relationship records.",
          },
          {
            action: "write",
            label: "Manage customer relationships",
            description: "Create and update people, organizations, and relationship records.",
            sensitive: true,
          },
          {
            action: "delete",
            label: "Delete customer relationships",
            description: "Delete people, organizations, and relationship records.",
            sensitive: true,
          },
        ],
      },
      {
        id: "@voyant-travel/relationships#access.relationships-pii",
        resource: "relationships-pii",
        label: "Relationship PII",
        description: "Personally-identifiable documents held on relationship records.",
        actions: [
          {
            action: "read",
            label: "Read relationship PII",
            description: "Reveal personally-identifiable documents held on relationship records.",
            sensitive: true,
          },
        ],
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
      risk: "low",
    },
    {
      id: "@voyant-travel/relationships#tool.get-person",
      name: "get_person",
      runtime: { entry: "@voyant-travel/relationships/tools", export: "getPersonTool" },
      requiredScopes: ["crm:read"],
      context: ["relationships"],
      risk: "low",
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
      risk: "low",
    },
    {
      id: "@voyant-travel/relationships#tool.get-organization",
      name: "get_organization",
      runtime: { entry: "@voyant-travel/relationships/tools", export: "getOrganizationTool" },
      requiredScopes: ["crm:read"],
      context: ["relationships"],
      risk: "low",
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
        requiredScopes: ["crm:read"],
        runtime: relationshipsAdminRuntime,
      },
      {
        id: "@voyant-travel/relationships#admin.route.people-detail",
        path: "/people/$id",
        requiredScopes: ["crm:read"],
        runtime: relationshipsAdminRuntime,
      },
      {
        id: "@voyant-travel/relationships#admin.route.organizations-index",
        path: "/organizations",
        requiredScopes: ["crm:read"],
        runtime: relationshipsAdminRuntime,
      },
      {
        id: "@voyant-travel/relationships#admin.route.organizations-detail",
        path: "/organizations/$id",
        requiredScopes: ["crm:read"],
        runtime: relationshipsAdminRuntime,
      },
      {
        id: "@voyant-travel/relationships#admin.route.custom-fields",
        path: "/settings/custom-fields",
        requiredScopes: ["crm:read"],
        runtime: relationshipsAdminRuntime,
      },
    ],
    nav: [
      {
        id: "@voyant-travel/relationships#admin.nav.people",
        routeId: "@voyant-travel/relationships#admin.route.people-index",
        label: {
          namespace: "relationships.admin",
          key: "peoplePage.title",
        },
      },
      {
        id: "@voyant-travel/relationships#admin.nav.organizations",
        routeId: "@voyant-travel/relationships#admin.route.organizations-index",
        label: {
          namespace: "relationships.admin",
          key: "organizationsPage.title",
        },
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
