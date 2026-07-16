import { accountsService } from "./accounts.js"
import { activitiesService } from "./activities.js"
import { customerSignalsService } from "./customer-signals.js"
import { personDocumentsService } from "./person-documents.js"
import { personRelationshipsService } from "./person-relationships.js"

export const relationshipsService = {
  ...accountsService,
  ...activitiesService,
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
