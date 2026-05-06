import type { ExternalRefsUiMessages } from "./messages.js"

export const externalRefsUiEn: ExternalRefsUiMessages = {
  common: {
    refStatusLabels: {
      active: "Active",
      inactive: "Inactive",
      archived: "Archived",
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
