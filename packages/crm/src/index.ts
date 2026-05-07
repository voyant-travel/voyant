import type { LinkableDefinition, Module } from "@voyantjs/core"
import type { HonoModule } from "@voyantjs/hono/module"

import {
  buildCrmRouteRuntime,
  CRM_ROUTE_RUNTIME_CONTAINER_KEY,
  type CrmRouteRuntimeOptions,
} from "./route-runtime.js"
import { crmRoutes } from "./routes/index.js"
import { crmService } from "./service/index.js"

export type { CrmRoutes } from "./routes/index.js"

export const personLinkable: LinkableDefinition = {
  module: "crm",
  entity: "person",
  table: "people",
  idPrefix: "pers",
}

export const organizationLinkable: LinkableDefinition = {
  module: "crm",
  entity: "organization",
  table: "organizations",
  idPrefix: "org",
}

export const crmModule: Module = {
  name: "crm",
  linkable: {
    person: personLinkable,
    organization: organizationLinkable,
  },
}

export interface CrmHonoModuleOptions extends CrmRouteRuntimeOptions {}

/**
 * Configurable factory for the CRM Hono module. Use this when the
 * deployment needs a non-default KMS resolver (e.g. Voyant Cloud
 * Vault) — the runtime is registered in the request-scoped container
 * so admin PII routes can decrypt person documents on demand. The
 * default `crmHonoModule` export covers env-driven setups.
 */
export function createCrmHonoModule(options: CrmHonoModuleOptions = {}): HonoModule {
  const module: Module = {
    ...crmModule,
    bootstrap: ({ bindings, container }) => {
      container.register(
        CRM_ROUTE_RUNTIME_CONTAINER_KEY,
        buildCrmRouteRuntime(bindings as Record<string, unknown>, options),
      )
    },
  }
  return {
    module,
    routes: crmRoutes,
  }
}

export const crmHonoModule: HonoModule = createCrmHonoModule()

export { crmBookingExtension } from "./booking-extension.js"
export type {
  CrmRouteRuntime,
  CrmRouteRuntimeOptions,
  ResolveCrmKmsProvider,
} from "./route-runtime.js"
export {
  buildCrmRouteRuntime,
  CRM_ROUTE_RUNTIME_CONTAINER_KEY,
} from "./route-runtime.js"
export type {
  Activity,
  ActivityLink,
  ActivityParticipant,
  CommunicationLogEntry,
  CustomFieldDefinition,
  CustomFieldValue,
  NewActivity,
  NewActivityLink,
  NewActivityParticipant,
  NewCommunicationLogEntry,
  NewCustomFieldDefinition,
  NewCustomFieldValue,
  NewOpportunity,
  NewOpportunityParticipant,
  NewOpportunityProduct,
  NewOrganization,
  NewOrganizationNote,
  NewPerson,
  NewPersonDocument,
  NewPersonNote,
  NewPersonRelationship,
  NewPipeline,
  NewQuote,
  NewQuoteLine,
  NewSegment,
  NewSegmentMember,
  NewStage,
  Opportunity,
  OpportunityParticipant,
  OpportunityProduct,
  Organization,
  OrganizationNote,
  Person,
  PersonDocument,
  PersonNote,
  PersonRelationship,
  Pipeline,
  Quote,
  QuoteLine,
  Segment,
  SegmentMember,
  Stage,
} from "./schema.js"
export {
  activities,
  activityLinks,
  activityParticipants,
  communicationLog,
  customFieldDefinitions,
  customFieldValues,
  opportunities,
  opportunityParticipants,
  opportunityProducts,
  organizationNotes,
  organizations,
  people,
  personDocuments,
  personDocumentTypeEnum,
  personNotes,
  personRelationshipKindEnum,
  personRelationships,
  pipelines,
  quoteLines,
  quotes,
  segmentMembers,
  segments,
  stages,
} from "./schema.js"
export type {
  CreatePersonDocumentInput,
  PersonDocumentListQuery,
  PersonDocumentType,
  PersonTravelSnapshot,
  UpdatePersonDocumentInput,
} from "./service/person-documents.js"
export {
  personDocumentNumberPlaintextSchema,
  personDocumentsService,
  personPiiBlobPlaintextSchema,
} from "./service/person-documents.js"
export type {
  CreatePersonRelationshipInput,
  PersonRelationshipKind,
  PersonRelationshipListQuery,
  UpdatePersonRelationshipInput,
} from "./service/person-relationships.js"
export { personRelationshipsService } from "./service/person-relationships.js"
export {
  activityListQuerySchema,
  communicationChannelSchema,
  communicationDirectionSchema,
  communicationListQuerySchema,
  customFieldDefinitionListQuerySchema,
  customFieldValueListQuerySchema,
  insertActivityLinkSchema,
  insertActivityParticipantSchema,
  insertActivitySchema,
  insertCommunicationLogSchema,
  insertCustomFieldDefinitionSchema,
  insertOpportunityParticipantSchema,
  insertOpportunityProductSchema,
  insertOpportunitySchema,
  insertOrganizationNoteSchema,
  insertOrganizationSchema,
  insertPersonDocumentFromPlaintextSchema,
  insertPersonDocumentSchema,
  insertPersonNoteSchema,
  insertPersonRelationshipSchema,
  insertPersonSchema,
  insertPipelineSchema,
  insertQuoteLineSchema,
  insertQuoteSchema,
  insertSegmentSchema,
  insertStageSchema,
  opportunityListQuerySchema,
  organizationListQuerySchema,
  personDocumentListQuerySchema,
  personDocumentTypeSchema,
  personListQuerySchema,
  personRelationshipKindSchema,
  personRelationshipListQuerySchema,
  pipelineListQuerySchema,
  quoteListQuerySchema,
  relationTypeSchema,
  stageListQuerySchema,
  updateActivitySchema,
  updateCustomFieldDefinitionSchema,
  updateOpportunityProductSchema,
  updateOpportunitySchema,
  updateOrganizationSchema,
  updatePersonDocumentFromPlaintextSchema,
  updatePersonDocumentSchema,
  updatePersonProfilePiiSchema,
  updatePersonRelationshipSchema,
  updatePersonSchema,
  updatePipelineSchema,
  updateQuoteLineSchema,
  updateQuoteSchema,
  updateStageSchema,
  upsertCustomFieldValueSchema,
} from "./validation.js"
export { crmService }
