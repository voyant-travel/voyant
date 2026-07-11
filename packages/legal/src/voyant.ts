import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
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
    { id: "@voyant-travel/legal#linkable.contract", source: linkableSource },
    { id: "@voyant-travel/legal#linkable.contractTemplate", source: linkableSource },
    { id: "@voyant-travel/legal#linkable.policy", source: linkableSource },
    { id: "@voyant-travel/legal#linkable.policyVersion", source: linkableSource },
    { id: "@voyant-travel/legal#linkable.policyAcceptance", source: linkableSource },
    { id: "@voyant-travel/legal#linkable.term", source: linkableSource },
  ],
  events: [
    { id: "@voyant-travel/legal#event.contract.issued", eventType: "contract.issued" },
    { id: "@voyant-travel/legal#event.contract.sent", eventType: "contract.sent" },
    { id: "@voyant-travel/legal#event.contract.signed", eventType: "contract.signed" },
    { id: "@voyant-travel/legal#event.contract.executed", eventType: "contract.executed" },
    { id: "@voyant-travel/legal#event.contract.voided", eventType: "contract.voided" },
    {
      id: "@voyant-travel/legal#event.contract.document.generated",
      eventType: "contract.document.generated",
    },
    {
      id: "@voyant-travel/legal#event.booking.contract.generated",
      eventType: "booking.contract.generated",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/legal#access.legal",
        resource: "legal",
        actions: ["read", "write"],
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
  api: [
    {
      id: "@voyant-travel/legal#contract-document.api",
      surface: "admin",
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

export default legalVoyantModule
