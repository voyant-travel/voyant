export interface ExternalRefsListFilters {
  entityType?: string | undefined
  entityId?: string | undefined
  sourceSystem?: string | undefined
  objectType?: string | undefined
  namespace?: string | undefined
  status?: string | undefined
  search?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export const externalRefsQueryKeys = {
  all: ["external-refs"] as const,
  refs: () => [...externalRefsQueryKeys.all, "refs"] as const,
  refsList: (filters: ExternalRefsListFilters) =>
    [...externalRefsQueryKeys.refs(), filters] as const,
  ref: (id: string) => [...externalRefsQueryKeys.refs(), id] as const,
}
