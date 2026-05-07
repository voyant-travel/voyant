export {
  defaultFetcher,
  fetchWithValidation,
  VoyantApiError,
  type VoyantFetcher,
} from "./client.js"
export {
  type UseActivitiesOptions,
  useActivities,
} from "./hooks/use-activities.js"
export {
  type UseActivityOptions,
  useActivity,
  useActivityLinks,
} from "./hooks/use-activity.js"
export {
  type CreateActivityInput,
  type CreateActivityLinkInput,
  type UpdateActivityInput,
  useActivityMutation,
} from "./hooks/use-activity-mutation.js"
export {
  type UseOpportunitiesOptions,
  useOpportunities,
} from "./hooks/use-opportunities.js"
export {
  type UseOpportunityOptions,
  useOpportunity,
} from "./hooks/use-opportunity.js"
export {
  type CreateOpportunityInput,
  type UpdateOpportunityInput,
  useOpportunityMutation,
} from "./hooks/use-opportunity-mutation.js"
export {
  type UseOrganizationOptions,
  useOrganization,
} from "./hooks/use-organization.js"
export {
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
  useOrganizationMutation,
} from "./hooks/use-organization-mutation.js"
export {
  type UseOrganizationsOptions,
  useOrganizations,
} from "./hooks/use-organizations.js"
export { type UsePeopleOptions, usePeople } from "./hooks/use-people.js"
export { type UsePersonOptions, usePerson } from "./hooks/use-person.js"
export {
  type CreatePersonDocumentFromPlaintextInput,
  type CreatePersonDocumentInput,
  type UpdatePersonDocumentFromPlaintextInput,
  type UpdatePersonDocumentInput,
  usePersonDocumentMutation,
} from "./hooks/use-person-document-mutation.js"
export {
  type UsePersonDocumentsOptions,
  usePersonDocuments,
} from "./hooks/use-person-documents.js"
export {
  type CreatePersonInput,
  type UpdatePersonInput,
  type UpdatePersonProfilePiiInput,
  usePersonMutation,
} from "./hooks/use-person-mutation.js"
export {
  type UsePersonTravelSnapshotOptions,
  usePersonTravelSnapshot,
} from "./hooks/use-person-travel-snapshot.js"
export {
  type CreatePipelineInput,
  type CreateStageInput,
  type UpdatePipelineInput,
  type UpdateStageInput,
  usePipelineMutation,
} from "./hooks/use-pipeline-mutation.js"
export {
  type UsePipelineOptions,
  type UsePipelinesOptions,
  usePipeline,
  usePipelines,
} from "./hooks/use-pipelines.js"
export {
  type UseQuoteOptions,
  useQuote,
  useQuoteLines,
} from "./hooks/use-quote.js"
export {
  type CreateQuoteInput,
  type CreateQuoteLineInput,
  type UpdateQuoteInput,
  type UpdateQuoteLineInput,
  useQuoteMutation,
} from "./hooks/use-quote-mutation.js"
export {
  type UseQuotesOptions,
  useQuotes,
} from "./hooks/use-quotes.js"
export {
  type UseStageOptions,
  type UseStagesOptions,
  useStage,
  useStages,
} from "./hooks/use-stages.js"
export {
  useVoyantContext,
  type VoyantContextValue,
  VoyantProvider,
  type VoyantProviderProps,
} from "./provider.js"
export {
  type ActivitiesListFilters,
  crmQueryKeys,
  type OpportunitiesListFilters,
  type OrganizationsListFilters,
  type PeopleListFilters,
  type PersonDocumentsListFilters,
  type PipelinesListFilters,
  type QuotesListFilters,
  type StagesListFilters,
} from "./query-keys.js"
export {
  getActivitiesQueryOptions,
  getOpportunitiesQueryOptions,
  getOpportunityQueryOptions,
  getOrganizationQueryOptions,
  getOrganizationsQueryOptions,
  getPeopleQueryOptions,
  getPersonActivitiesQueryOptions,
  getPersonNotesQueryOptions,
  getPersonOpportunitiesQueryOptions,
  getPersonQueryOptions,
  getPipelineQueryOptions,
  getPipelinesQueryOptions,
  getQuoteLinesQueryOptions,
  getQuoteQueryOptions,
  getQuotesQueryOptions,
  getStageQueryOptions,
  getStagesQueryOptions,
} from "./query-options.js"
export {
  type ActivityLinkRecord,
  type ActivityRecord,
  activityLinkRecordSchema,
  activityRecordSchema,
  type KmsEnvelopeRecord,
  kmsEnvelopeRecordSchema,
  type OpportunityRecord,
  type OrganizationRecord,
  opportunityRecordSchema,
  organizationRecordSchema,
  type PersonDocumentRecord,
  type PersonDocumentType,
  type PersonNoteRecord,
  type PersonRecord,
  type PersonTravelSnapshotRecord,
  type PipelineRecord,
  personDocumentRecordSchema,
  personDocumentTypeSchema,
  personNoteRecordSchema,
  personRecordSchema,
  personTravelSnapshotSchema,
  pipelineRecordSchema,
  type QuoteLineRecord,
  type QuoteRecord,
  quoteLineRecordSchema,
  quoteRecordSchema,
  type StageRecord,
  stageRecordSchema,
} from "./schemas.js"
