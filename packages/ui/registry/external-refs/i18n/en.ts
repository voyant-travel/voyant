import type { RegistryExternalRefsMessages } from "./messages"

export const registryExternalRefsEn = {
  externalRefsPage: {
    title: "External References",
    description:
      "IDs from third-party systems linked to Voyant entities. Enter the entity type and ID below to manage its external references.",
    fields: {
      entityType: "Entity type",
      entity: "Entity",
      customEntityType: "Other entity type",
    },
    placeholders: {
      entityType: "person, booking, product...",
      entity: "Paste a reference for custom entity types",
    },
    entityTypeLabels: {
      person: "Person",
      organization: "Organization",
      supplier: "Supplier",
      booking: "Booking",
      product: "Product",
    },
    emptyScope: "Choose an entity above to browse its external references.",
  },
  externalRefsTab: {
    description: "Links between this entity and IDs in external systems.",
    add: "Add External Ref",
    empty: "No external references yet.",
    loading: "Loading external references...",
    columns: {
      sourceSystem: "Source System",
      objectType: "Object Type",
      externalId: "External ID",
      namespace: "Namespace",
      status: "Status",
      primary: "Primary",
    },
    actions: {
      deleteConfirm: "Delete external reference?",
    },
  },
} satisfies RegistryExternalRefsMessages
