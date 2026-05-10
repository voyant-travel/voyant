import type { ExternalRefsUiMessages } from "./messages.js"

export const externalRefsUiEn: ExternalRefsUiMessages = {
  common: {
    refStatusLabels: {
      active: "Active",
      inactive: "Inactive",
      archived: "Archived",
    },
  },
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
    empty: {
      none: "No external references yet.",
      loading: "Loading external references...",
    },
    columns: {
      sourceSystem: "Source System",
      objectType: "Object Type",
      externalId: "External ID",
      namespace: "Namespace",
      status: "Status",
      primary: "Primary",
    },
    actions: {
      edit: "Edit external reference",
      delete: "Delete external reference",
      deleteConfirm: "Delete external reference?",
    },
    pagination: {
      previous: "Previous page",
      next: "Next page",
      page: "Page",
      of: "of",
    },
  },
  externalRefDialog: {
    titles: {
      edit: "Edit External Ref",
      add: "Add External Ref",
    },
    labels: {
      sourceSystem: "Source system",
      objectType: "Object type",
      namespace: "Namespace",
      externalId: "External ID",
      externalParentId: "External parent ID",
      status: "Status",
      primary: "Primary",
      metadataJson: "Metadata (JSON)",
    },
    placeholders: {
      sourceSystem: "bokun, pipedrive, stripe...",
      objectType: "booking, person, product...",
      namespace: "default",
      externalId: "abc-123",
      externalParentId: "parent-id...",
      metadataJson: '{ "key": "value" }',
    },
    actions: {
      cancel: "Cancel",
      saveChanges: "Save Changes",
      addExternalRef: "Add External Ref",
    },
    validation: {
      sourceSystemRequired: "Source system is required",
      objectTypeRequired: "Object type is required",
      externalIdRequired: "External ID is required",
      metadataMustBeObject: "Must be a JSON object",
    },
  },
}
