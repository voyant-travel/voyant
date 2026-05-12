import type { AuthUiMessages } from "./messages.js"

export const authUiEn: AuthUiMessages = {
  serviceApiKeysPage: {
    title: "API tokens",
    description:
      "Create permissioned API tokens for automation, integrations, and third-party systems.",
    createdToken: {
      title: "New token",
      description: "This token is shown once. Store it before leaving.",
      copy: "Copy",
    },
    create: {
      title: "Create token",
      name: "Name",
      namePlaceholder: "CMS sync, webhook relay, nightly automation",
      expiration: "Expiration",
      submit: "Create token",
      errors: {
        nameRequired: "Token name is required.",
        permissionRequired: "Select at least one permission.",
        createFailed: "Could not create API token.",
      },
      expirationOptions: {
        never: "No expiration",
        sevenDays: "7 days",
        thirtyDays: "30 days",
        ninetyDays: "90 days",
        oneYear: "1 year",
      },
    },
    list: {
      title: "Existing tokens",
      refresh: "Refresh",
      loading: "Loading tokens",
      empty: "No API tokens have been created yet.",
      untitled: "Untitled token",
      enabled: "Enabled",
      disabled: "Disabled",
      noPermissions: "No permissions",
      metadata: "Created {created} · Expires {expires} · Last used {lastUsed}",
      disable: "Disable",
      enable: "Enable",
      delete: "Delete",
    },
    permissions: {
      fullAccess: "Full access",
    },
    date: {
      never: "Never",
    },
  },
}
