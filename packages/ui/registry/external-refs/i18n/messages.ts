export type RegistryExternalRefsMessages = {
  externalRefsPage: {
    title: string
    description: string
    fields: {
      entityType: string
      entityId: string
    }
    placeholders: {
      entityType: string
      entityId: string
    }
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
