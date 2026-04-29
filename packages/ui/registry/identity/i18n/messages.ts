export type RegistryIdentityMessages = {
  page: {
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
    tabs: {
      contactPoints: string
      addresses: string
      namedContacts: string
    }
  }
  contactPointsTab: {
    description: string
    add: string
    empty: {
      loading: string
      none: string
    }
    columns: {
      kind: string
      value: string
      label: string
      primary: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  addressesTab: {
    description: string
    add: string
    empty: {
      loading: string
      none: string
    }
    columns: {
      label: string
      street: string
      city: string
      country: string
      primary: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  namedContactsTab: {
    description: string
    add: string
    empty: {
      loading: string
      none: string
    }
    columns: {
      role: string
      name: string
      title: string
      email: string
      phone: string
      primary: string
    }
    actions: {
      deleteConfirm: string
    }
  }
}
