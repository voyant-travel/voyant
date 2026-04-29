import type { ExternalRefRecord } from "@voyantjs/external-refs-react"

export type ExternalRefStatus = ExternalRefRecord["status"]

export type ExternalRefsUiMessages = {
  common: {
    refStatusLabels: Record<ExternalRefStatus, string>
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
