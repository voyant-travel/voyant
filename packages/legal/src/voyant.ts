import { defineModule } from "@voyant-travel/core/project"

const linkableSource = "@voyant-travel/legal/linkables"

/** Import-cheap deployment declaration owned by the legal package. */
export const legalVoyantModule = defineModule({
  id: "@voyant-travel/legal",
  packageName: "@voyant-travel/legal",
  localId: "legal",
  api: [
    {
      id: "@voyant-travel/legal#api.admin",
      surface: "admin",
      mount: "legal",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/legal",
        export: "createLegalHonoModule",
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
        export: "createLegalHonoModule",
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

export default legalVoyantModule
