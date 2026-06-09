import { accountsService } from "./accounts.js"
import { activitiesService } from "./activities.js"
import { customFieldsService } from "./custom-fields.js"
import { customerSignalsService } from "./customer-signals.js"
import { personDocumentsService } from "./person-documents.js"
import { personRelationshipsService } from "./person-relationships.js"
import { pipelinesService } from "./pipelines.js"
import { quoteVersionsService } from "./quote-versions.js"
import { quotesService } from "./quotes.js"

export const crmService = {
  ...accountsService,
  ...pipelinesService,
  ...quotesService,
  ...quoteVersionsService,
  ...activitiesService,
  ...customFieldsService,
  ...personDocumentsService,
  ...personRelationshipsService,
  ...customerSignalsService,
}

export type {
  CreateCustomerSignalInput,
  CustomerSignalListQuery,
  UpdateCustomerSignalInput,
} from "./customer-signals.js"
export { customerSignalsService } from "./customer-signals.js"
export type {
  CreatePersonDocumentInput,
  PersonDocumentListQuery,
  PersonDocumentType,
  PersonTravelSnapshot,
  UpdatePersonDocumentInput,
} from "./person-documents.js"
export {
  personDocumentNumberPlaintextSchema,
  personDocumentsService,
  personPiiBlobPlaintextSchema,
} from "./person-documents.js"
export type {
  CreatePersonRelationshipInput,
  PersonRelationshipKind,
  PersonRelationshipListQuery,
  UpdatePersonRelationshipInput,
} from "./person-relationships.js"
export { personRelationshipsService } from "./person-relationships.js"
