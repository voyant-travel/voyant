export interface QuotesListFilters {
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

export interface QuoteVersionsListFilters {
  quoteId?: string | undefined
  status?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const quotesQueryKeys = {
  all: ["voyant", "quotes"] as const,

  quotes: () => [...quotesQueryKeys.all, "quotes"] as const,
  quotesList: (filters: QuotesListFilters) =>
    [...quotesQueryKeys.quotes(), "list", filters] as const,
  quote: (id: string) => [...quotesQueryKeys.quotes(), "detail", id] as const,

  pipelines: () => [...quotesQueryKeys.all, "pipelines"] as const,
  pipelinesList: (filters: PipelinesListFilters) =>
    [...quotesQueryKeys.pipelines(), "list", filters] as const,
  pipeline: (id: string) => [...quotesQueryKeys.pipelines(), "detail", id] as const,

  stages: () => [...quotesQueryKeys.all, "stages"] as const,
  stagesList: (filters: StagesListFilters) =>
    [...quotesQueryKeys.stages(), "list", filters] as const,
  stage: (id: string) => [...quotesQueryKeys.stages(), "detail", id] as const,

  quoteVersions: () => [...quotesQueryKeys.all, "quote-versions"] as const,
  quoteVersionsList: (filters: QuoteVersionsListFilters) =>
    [...quotesQueryKeys.quoteVersions(), "list", filters] as const,
  quoteVersion: (id: string) => [...quotesQueryKeys.quoteVersions(), "detail", id] as const,
  quoteVersionLines: (quoteVersionId: string) =>
    [...quotesQueryKeys.quoteVersion(quoteVersionId), "lines"] as const,

  quoteParticipants: (quoteId: string) =>
    [...quotesQueryKeys.quote(quoteId), "participants"] as const,
  quoteProducts: (quoteId: string) => [...quotesQueryKeys.quote(quoteId), "products"] as const,
} as const
