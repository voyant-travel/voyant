import { contractRecordsService } from "./service-contracts.js"
import { contractDocumentsService } from "./service-documents.js"
import { contractSeriesService } from "./service-series.js"
import {
  allocateContractNumber,
  ContractTemplateSyntaxError,
  isContractTemplateSyntaxError,
  mergeContractNumberIntoVariables,
  renderTemplate,
  validateContractTemplateBody,
  validateTemplateVariables,
} from "./service-shared.js"
import { contractTemplatesService } from "./service-templates.js"

export {
  allocateContractNumber,
  ContractTemplateSyntaxError,
  isContractTemplateSyntaxError,
  mergeContractNumberIntoVariables,
  renderTemplate,
  validateContractTemplateBody,
  validateTemplateVariables,
}

export const contractsService = {
  ...contractTemplatesService,
  ...contractSeriesService,
  ...contractRecordsService,
  ...contractDocumentsService,
}
