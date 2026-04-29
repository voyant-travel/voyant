export type RegistrySellabilityMessages = {
  page: {
    title: string
    description: string
    addPolicy: string
    filters: {
      scopePlaceholder: string
      typePlaceholder: string
      statusPlaceholder: string
      scopeAll: string
      typeAll: string
      statusAll: string
      active: string
      inactive: string
    }
    empty: {
      loading: string
      noPolicies: string
    }
    columns: {
      name: string
      scope: string
      type: string
      priority: string
      status: string
    }
    actions: {
      deleteConfirm: string
    }
  }
}
