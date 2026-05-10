import type { ExternalRefRecord } from "@voyantjs/external-refs-react"

export type ExternalRefStatus = ExternalRefRecord["status"]

export type ExternalRefsUiMessages = {
  common: {
    refStatusLabels: Record<ExternalRefStatus, string>
  }
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
    empty: {
      none: string
      loading: string
    }
    columns: {
      sourceSystem: string
      objectType: string
      externalId: string
      namespace: string
      status: string
      primary: string
    }
    actions: {
      edit: string
      delete: string
      deleteConfirm: string
    }
    pagination: {
      previous: string
      next: string
      page: string
      of: string
    }
  }
  externalRefDialog: {
    titles: {
      edit: string
      add: string
    }
    labels: {
      sourceSystem: string
      objectType: string
      namespace: string
      externalId: string
      externalParentId: string
      status: string
      primary: string
      metadataJson: string
    }
    placeholders: {
      sourceSystem: string
      objectType: string
      namespace: string
      externalId: string
      externalParentId: string
      metadataJson: string
    }
    actions: {
      cancel: string
      saveChanges: string
      addExternalRef: string
    }
    validation: {
      sourceSystemRequired: string
      objectTypeRequired: string
      externalIdRequired: string
      metadataMustBeObject: string
    }
  }
}
