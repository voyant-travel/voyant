import type { LinkableDefinition } from "@voyant-travel/core"

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
  ContractLifecycleEvent,
  ContractLifecycleHook,
  ContractLifecycleRuntimeOptions,
  ContractLifecycleStage,
  ContractLifecycleTransition,
} from "./lifecycle.js"
export {
  appendContractStageHistory,
  buildContractLifecycleEvent,
  CONTRACT_LIFECYCLE_EVENT_NAMES,
  CONTRACT_LIFECYCLE_STAGES,
  checkContractLifecycleTransition,
  createContractStageHistoryEntry,
  emitContractLifecycleEvent,
} from "./lifecycle.js"
export type {
  Contract,
  ContractAttachment,
  ContractNumberSeries,
  ContractSignature,
  ContractStageHistoryEntry,
  ContractStatus,
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
  contractStatusValues,
  contracts,
  contractTemplates,
  contractTemplateVersions,
} from "./schema.js"
export {
  allocateContractNumber,
  ContractTemplateSyntaxError,
  contractsService,
  isContractTemplateSyntaxError,
  renderTemplate,
  validateContractTemplateBody,
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
  contractNumberSeriesListQuerySchema,
  contractScopeSchema,
  contractSignatureMethodSchema,
  contractStageHistoryEntrySchema,
  contractStatusSchema,
  contractTemplateDefaultQuerySchema,
  contractTemplateListQuerySchema,
  generateContractDocumentInputSchema,
  generateContractForBookingInputSchema,
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
