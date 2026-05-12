export type AuthUiMessages = {
  serviceApiKeysPage: {
    title: string
    description: string
    createdToken: {
      title: string
      description: string
      copy: string
    }
    create: {
      title: string
      name: string
      namePlaceholder: string
      expiration: string
      submit: string
      errors: {
        nameRequired: string
        permissionRequired: string
        createFailed: string
      }
      expirationOptions: {
        never: string
        sevenDays: string
        thirtyDays: string
        ninetyDays: string
        oneYear: string
      }
    }
    list: {
      title: string
      refresh: string
      loading: string
      empty: string
      untitled: string
      enabled: string
      disabled: string
      noPermissions: string
      metadata: string
      disable: string
      enable: string
      delete: string
    }
    permissions: {
      fullAccess: string
    }
    date: {
      never: string
    }
  }
}
