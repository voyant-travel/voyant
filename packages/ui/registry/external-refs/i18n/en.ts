import type { RegistryExternalRefsMessages } from "./messages"

export const registryExternalRefsEn = {
  externalRefsPage: {
    title: "External References",
    description:
      "IDs from third-party systems linked to Voyant entities. Enter the entity type and ID below to manage its external references.",
    fields: {
      entityType: "Entity type",
      entityId: "Entity ID",
    },
    placeholders: {
      entityType: "person, booking, product...",
      entityId: "pers_... / book_... / prod_...",
    },
    emptyScope: "Enter an entity type and ID above to browse its external references.",
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
