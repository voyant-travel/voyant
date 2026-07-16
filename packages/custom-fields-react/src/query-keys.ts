export interface CustomFieldDefinitionListFilters {
  entityType?: string
  limit?: number
  offset?: number
}
export const customFieldsQueryKeys = {
  all: ["voyant", "custom-fields"] as const,
  targets: () => [...customFieldsQueryKeys.all, "targets"] as const,
  definitions: () => [...customFieldsQueryKeys.all, "definitions"] as const,
  definitionsList: (filters: CustomFieldDefinitionListFilters = {}) =>
    [...customFieldsQueryKeys.definitions(), "list", filters] as const,
  definition: (id: string) => [...customFieldsQueryKeys.definitions(), "detail", id] as const,
} as const
