/**
 * TanStack Query keys for Voyant CRM resources. Exported so consumers can
 * manually invalidate or prefetch using the exact same keys the hooks use.
 */

export type PeopleListSortField = "name" | "relation" | "status" | "createdAt" | "updatedAt"
export type PeopleListSortDir = "asc" | "desc"

export interface PeopleListFilters {
  search?: string | undefined
  organizationId?: string | undefined
  ownerId?: string | undefined
  relation?: string | undefined
  status?: string | undefined
  sortBy?: PeopleListSortField | undefined
  sortDir?: PeopleListSortDir | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export type OrganizationsListSortField =
  | "name"
  | "industry"
  | "relation"
  | "status"
  | "createdAt"
  | "updatedAt"
export type OrganizationsListSortDir = "asc" | "desc"

export interface OrganizationsListFilters {
  search?: string | undefined
  ownerId?: string | undefined
  relation?: string | undefined
  status?: string | undefined
  sortBy?: OrganizationsListSortField | undefined
  sortDir?: OrganizationsListSortDir | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface OpportunitiesListFilters {
  search?: string | undefined
  personId?: string | undefined
  organizationId?: string | undefined
  pipelineId?: string | undefined
  stageId?: string | undefined
  ownerId?: string | undefined
  status?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PipelinesListFilters {
  entityType?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface StagesListFilters {
  pipelineId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface ActivitiesListFilters {
  search?: string | undefined
  ownerId?: string | undefined
  status?: string | undefined
  type?: string | undefined
  entityType?: string | undefined
  entityId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface QuotesListFilters {
  opportunityId?: string | undefined
  status?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface CustomerSignalsListFilters {
  personId?: string | undefined
  assignedToUserId?: string | undefined
  status?: string | undefined
  kind?: string | undefined
  productId?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PersonRelationshipsListFilters {
  kind?: string | undefined
  direction?: "from" | "to" | "both" | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export interface PersonDocumentsListFilters {
  type?: string | undefined
  expiringBefore?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const crmQueryKeys = {
  all: ["voyant", "crm"] as const,

  people: () => [...crmQueryKeys.all, "people"] as const,
  peopleList: (filters: PeopleListFilters) => [...crmQueryKeys.people(), "list", filters] as const,
  person: (id: string) => [...crmQueryKeys.people(), "detail", id] as const,
  personDocuments: (personId: string, filters: PersonDocumentsListFilters = {}) =>
    [...crmQueryKeys.person(personId), "documents", filters] as const,
  personDocument: (id: string) => [...crmQueryKeys.all, "person-documents", "detail", id] as const,
  personDocumentReveal: (id: string) =>
    [...crmQueryKeys.all, "person-documents", "reveal", id] as const,
  personTravelSnapshot: (personId: string) =>
    [...crmQueryKeys.person(personId), "travel-snapshot"] as const,
  personRelationships: (personId: string, filters: PersonRelationshipsListFilters = {}) =>
    [...crmQueryKeys.person(personId), "relationships", filters] as const,
  customerSignals: () => [...crmQueryKeys.all, "customer-signals"] as const,
  customerSignalsList: (filters: CustomerSignalsListFilters) =>
    [...crmQueryKeys.customerSignals(), "list", filters] as const,
  customerSignal: (id: string) => [...crmQueryKeys.customerSignals(), "detail", id] as const,
  customerSignalsByPerson: (personId: string) =>
    [...crmQueryKeys.person(personId), "signals"] as const,

  organizations: () => [...crmQueryKeys.all, "organizations"] as const,
  organizationsList: (filters: OrganizationsListFilters) =>
    [...crmQueryKeys.organizations(), "list", filters] as const,
  organization: (id: string) => [...crmQueryKeys.organizations(), "detail", id] as const,

  opportunities: () => [...crmQueryKeys.all, "opportunities"] as const,
  opportunitiesList: (filters: OpportunitiesListFilters) =>
    [...crmQueryKeys.opportunities(), "list", filters] as const,
  opportunity: (id: string) => [...crmQueryKeys.opportunities(), "detail", id] as const,

  pipelines: () => [...crmQueryKeys.all, "pipelines"] as const,
  pipelinesList: (filters: PipelinesListFilters) =>
    [...crmQueryKeys.pipelines(), "list", filters] as const,
  pipeline: (id: string) => [...crmQueryKeys.pipelines(), "detail", id] as const,

  stages: () => [...crmQueryKeys.all, "stages"] as const,
  stagesList: (filters: StagesListFilters) => [...crmQueryKeys.stages(), "list", filters] as const,
  stage: (id: string) => [...crmQueryKeys.stages(), "detail", id] as const,

  activities: () => [...crmQueryKeys.all, "activities"] as const,
  activitiesList: (filters: ActivitiesListFilters) =>
    [...crmQueryKeys.activities(), "list", filters] as const,
  activity: (id: string) => [...crmQueryKeys.activities(), "detail", id] as const,
  activityLinks: (activityId: string) => [...crmQueryKeys.activity(activityId), "links"] as const,

  quotes: () => [...crmQueryKeys.all, "quotes"] as const,
  quotesList: (filters: QuotesListFilters) => [...crmQueryKeys.quotes(), "list", filters] as const,
  quote: (id: string) => [...crmQueryKeys.quotes(), "detail", id] as const,
  quoteLines: (quoteId: string) => [...crmQueryKeys.quote(quoteId), "lines"] as const,
} as const
