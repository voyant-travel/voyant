import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import { legalContractDocumentRuntimePort } from "./contract-document-runtime-port.js"
import { legalBookingContractSubscriberRuntimePort } from "./contracts/booking-contract-subscriber-port.js"
import { legalRuntimePort } from "./runtime-port.js"

const legalAdminRuntime = {
  entry: "@voyant-travel/legal-react/admin",
  export: "createLegalAdminExtension",
} as const

const linkableSource = "@voyant-travel/legal/linkables"

/** Import-cheap deployment declaration owned by the legal package. */
export const legalVoyantModule = defineModule({
  id: "@voyant-travel/legal",
  packageName: "@voyant-travel/legal",
  localId: "legal",
  runtimePorts: [requirePort(legalRuntimePort)],
  api: [
    {
      id: "@voyant-travel/legal#api.admin",
      surface: "admin",
      mount: "legal",
      openapi: { document: "legal" },
      transactional: true,
      runtime: {
        entry: "@voyant-travel/legal",
        export: "createLegalVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/legal#api.public",
      surface: "public",
      mount: "legal",
      openapi: { document: "legal" },
      anonymous: true,
      transactional: true,
      runtime: {
        entry: "@voyant-travel/legal",
        export: "createLegalVoyantRuntime",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/legal#schema",
      source: "@voyant-travel/legal/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/legal#migrations",
      source: "./migrations",
    },
  ],
  links: [
    {
      id: "@voyant-travel/legal#linkable.contract",
      source: linkableSource,
      export: "contractLinkable",
    },
    {
      id: "@voyant-travel/legal#linkable.contractTemplate",
      source: linkableSource,
      export: "contractTemplateLinkable",
    },
    {
      id: "@voyant-travel/legal#linkable.policy",
      source: linkableSource,
      export: "policyLinkable",
    },
    {
      id: "@voyant-travel/legal#linkable.policyVersion",
      source: linkableSource,
      export: "policyVersionLinkable",
    },
    {
      id: "@voyant-travel/legal#linkable.policyAcceptance",
      source: linkableSource,
      export: "policyAcceptanceLinkable",
    },
    {
      id: "@voyant-travel/legal#linkable.term",
      source: linkableSource,
      export: "legalTermLinkable",
    },
    {
      id: "@voyant-travel/legal#link.contract-booking",
      source: "@voyant-travel/legal/standard-links",
      export: "contractBookingLink",
    },
    {
      id: "@voyant-travel/legal#link.contract-organization",
      source: "@voyant-travel/legal/standard-links",
      export: "contractOrganizationLink",
    },
    {
      id: "@voyant-travel/legal#link.contract-person",
      source: "@voyant-travel/legal/standard-links",
      export: "contractPersonLink",
    },
    {
      id: "@voyant-travel/legal#link.contract-supplier",
      source: "@voyant-travel/legal/standard-links",
      export: "contractSupplierLink",
    },
    {
      id: "@voyant-travel/legal#link.policy-acceptance-booking",
      source: "@voyant-travel/legal/standard-links",
      export: "policyAcceptanceBookingLink",
    },
    {
      id: "@voyant-travel/legal#link.policy-product",
      source: "@voyant-travel/legal/standard-links",
      export: "policyProductLink",
    },
  ],
  events: [
    {
      id: "@voyant-travel/legal#event.contract.issued",
      eventType: "contract.issued",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "legal", category: "domain" },
    },
    {
      id: "@voyant-travel/legal#event.contract.sent",
      eventType: "contract.sent",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "legal", category: "domain" },
    },
    {
      id: "@voyant-travel/legal#event.contract.signed",
      eventType: "contract.signed",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "legal", category: "domain" },
    },
    {
      id: "@voyant-travel/legal#event.contract.executed",
      eventType: "contract.executed",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "legal", category: "domain" },
    },
    {
      id: "@voyant-travel/legal#event.contract.voided",
      eventType: "contract.voided",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "legal", category: "domain" },
    },
    {
      id: "@voyant-travel/legal#event.contract.document.generated",
      eventType: "contract.document.generated",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "legal", category: "domain" },
    },
    {
      id: "@voyant-travel/legal#event.booking.contract.generated",
      eventType: "booking.contract.generated",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "legal", category: "domain" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/legal#access.legal",
        resource: "legal",
        label: "Legal",
        description: "Manage contracts, templates, policies, and legal terms.",
        actions: [
          {
            action: "read",
            label: "View legal records",
            description: "View contracts, templates, policies, and legal terms.",
          },
          {
            action: "write",
            label: "Manage legal records",
            description: "Create and update contracts, templates, policies, and legal terms.",
          },
        ],
      },
    ],
  },
  admin: {
    compositionOrder: 60,
    runtime: {
      entry: "@voyant-travel/legal-react/admin",
      export: "createSelectedLegalAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/legal#admin.copy",
        namespace: "legal.admin",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/legal-react/i18n",
          export: "legalUiMessageDefinitions",
        },
      },
    ],
    routes: (
      [
        ["index", "/legal"],
        ["contracts-index", "/legal/contracts"],
        ["contracts-detail", "/legal/contracts/$id"],
        ["templates-index", "/legal/templates"],
        ["templates-detail", "/legal/templates/$id"],
        ["policies-index", "/legal/policies"],
        ["policies-detail", "/legal/policies/$id"],
        ["number-series", "/legal/number-series"],
      ] as const
    ).map(([id, path]) => ({
      id: `@voyant-travel/legal#admin.route.${id}`,
      path,
      runtime: legalAdminRuntime,
    })),
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const legalContractDocumentVoyantModule = defineModule({
  id: "@voyant-travel/legal#contract-document",
  packageName: "@voyant-travel/legal",
  localId: "legal.contract-document",
  runtime: {
    entry: "@voyant-travel/legal/contract-document-routes",
    export: "createContractDocumentVoyantRuntime",
  },
  runtimePorts: [requirePort(legalContractDocumentRuntimePort)],
  api: [
    {
      id: "@voyant-travel/legal#contract-document.api",
      surface: "admin",
      resource: "legal",
      openapi: { document: "contract-document" },
      runtime: {
        entry: "@voyant-travel/legal/contract-document-routes",
        export: "createContractDocumentHonoModule",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export const legalBookingContractVoyantExtension = defineExtension({
  id: "@voyant-travel/legal#booking-contract-extension",
  packageName: "@voyant-travel/legal",
  localId: "legal.booking-contract-extension",
  runtime: {
    entry: "./booking-contract-subscriber",
    export: "createLegalBookingContractVoyantRuntime",
  },
  runtimePorts: [requirePort(legalBookingContractSubscriberRuntimePort)],
  subscribers: [
    {
      id: "@voyant-travel/legal#subscriber.booking-contract-confirmed",
      eventType: "booking.confirmed",
      source: "@voyant-travel/legal/booking-contract-subscriber",
      runtime: {
        entry: "./booking-contract-subscriber",
        export: "legalBookingContractConfirmedSubscriber",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

/** Neutral association selected explicitly by the standard product BOM. */
export const legalStandardProductLinksVoyantExtension = defineExtension({
  id: "@voyant-travel/legal#standard-product-links",
  packageName: "@voyant-travel/legal",
  localId: "legal.standard-product-links",
  links: [
    {
      id: "@voyant-travel/legal#link.contract-invoice",
      source: "@voyant-travel/legal/standard-links",
      export: "contractInvoiceLink",
    },
  ],
  meta: { ownership: "standard-product" },
})

export default legalVoyantModule
