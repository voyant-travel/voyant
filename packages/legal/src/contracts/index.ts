import type { LinkableDefinition } from "@voyantjs/core"

export type {
  ContractDocumentGenerator,
  ContractsAdminRoutes,
  ContractsPublicRoutes,
  ContractsRouteOptions,
} from "./routes.js"
export { createContractsAdminRoutes, createContractsPublicRoutes } from "./routes.js"

export const contractLinkable: LinkableDefinition = {
  module: "legal",
  entity: "contract",
  table: "contracts",
  idPrefix: "cont",
}

export const contractTemplateLinkable: LinkableDefinition = {
  module: "legal",
  entity: "contractTemplate",
  table: "contract_templates",
  idPrefix: "ctpl",
}

export const contractsLinkable = {
  contract: contractLinkable,
  contractTemplate: contractTemplateLinkable,
}

export type {
  Contract,
  ContractAttachment,
  ContractNumberSeries,
  ContractSignature,
  ContractTemplate,
  ContractTemplateVersion,
  NewContract,
  NewContractAttachment,
  NewContractNumberSeries,
  NewContractSignature,
  NewContractTemplate,
  NewContractTemplateVersion,
} from "./schema.js"
export {
  contractAttachments,
  contractNumberSeries,
  contractSignatures,
  contracts,
  contractTemplates,
  contractTemplateVersions,
} from "./schema.js"
export {
  allocateContractNumber,
  contractsService,
  renderTemplate,
  validateTemplateVariables,
} from "./service.js"
export type {
  ContractDocumentGeneratedEvent,
  ContractDocumentGeneratorContext,
  ContractDocumentRuntimeOptions,
  GeneratedContractDocumentArtifact,
  GeneratedContractDocumentRecord,
  StorageBackedContractDocumentGeneratorOptions,
  StorageBackedContractDocumentSerializer,
  StorageBackedContractDocumentUpload,
} from "./service-documents.js"
export {
  createPdfContractDocumentGenerator,
  createStorageBackedContractDocumentGenerator,
  defaultPdfContractDocumentSerializer,
  defaultStorageBackedContractDocumentSerializer,
} from "./service-documents.js"
export type {
  CloudBrowserGoToOptions,
  CloudBrowserPdfInput,
  CloudBrowserPdfOptions,
  CloudBrowserRenderClient,
  CloudBrowserWaitUntil,
  CreateBrowserRenderedPdfContractDocumentSerializerOptions,
} from "./service-documents-browser.js"
export {
  createBrowserRenderedPdfContractDocumentSerializer,
  defaultContractHtmlWrapper,
} from "./service-documents-browser.js"
export type {
  ContractTemplateLiquidSnippet,
  ContractTemplateVariableCategory,
  ContractTemplateVariableDefinition,
  ContractTemplateVariableType,
} from "./template-authoring.js"
export {
  contractTemplateLiquidSnippets,
  contractTemplateVariableCatalog,
} from "./template-authoring.js"
export {
  contractBodyFormatSchema,
  contractListQuerySchema,
  contractNumberResetStrategySchema,
  contractScopeSchema,
  contractSignatureMethodSchema,
  contractStatusSchema,
  contractTemplateListQuerySchema,
  generateContractDocumentInputSchema,
  generatedContractDocumentAttachmentSchema,
  generatedContractDocumentResultSchema,
  insertContractAttachmentSchema,
  insertContractNumberSeriesSchema,
  insertContractSchema,
  insertContractSignatureSchema,
  insertContractTemplateSchema,
  insertContractTemplateVersionSchema,
  renderTemplateInputSchema,
  updateContractAttachmentSchema,
  updateContractNumberSeriesSchema,
  updateContractSchema,
  updateContractTemplateSchema,
} from "./validation.js"
