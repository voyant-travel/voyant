export type RegistryExternalRefsMessages = {
  externalRefsPage: {
    title: string
    description: string
    fields: {
      entityType: string
      entity: string
      customEntityType: string
    }
    placeholders: {
      entityType: string
      entity: string
    }
    entityTypeLabels: Record<"person" | "organization" | "supplier" | "booking" | "product", string>
    emptyScope: string
  }
  externalRefsTab: {
    description: string
    add: string
    empty: string
    loading: string
    columns: {
      sourceSystem: string
      objectType: string
      externalId: string
      namespace: string
      status: string
      primary: string
    }
    actions: {
      deleteConfirm: string
    }
  }
}
