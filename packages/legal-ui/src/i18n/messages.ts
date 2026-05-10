import type { LegalContractRecord } from "@voyantjs/legal-react"

export const legalRuleTypes = [
  "window",
  "percentage",
  "flat_amount",
  "date_range",
  "custom",
] as const

export const legalRefundTypes = ["cash", "credit", "cash_or_credit", "none"] as const

export const legalSignatureMethods = ["manual", "electronic", "docusign", "other"] as const

export type LegalContractStatus = LegalContractRecord["status"]
export type LegalRuleType = (typeof legalRuleTypes)[number]
export type LegalRefundType = (typeof legalRefundTypes)[number]
export type LegalSignatureMethod = (typeof legalSignatureMethods)[number]

export type LegalUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    create: string
    edit: string
    add: string
    loading: string
    none: string
    selectPlaceholder: string
    optionalPlaceholder: string
    kilobytes: string
  }
  bookingContractCard: {
    heading: string
    empty: string
    generate: string
    regenerate: string
    download: string
    noAttachments: string
    issuedAt: string
    contractNumber: string
    unsaved: string
    contractStatusLabels: Record<LegalContractStatus, string>
  }
  numberSeriesPage: {
    title: string
    description: string
    actions: {
      create: string
    }
    columns: {
      name: string
      prefix: string
      separator: string
      pad: string
      current: string
      reset: string
      scope: string
      status: string
    }
    active: string
    inactive: string
    empty: string
    deleteConfirm: string
  }
  attachmentDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      name: string
      kind: string
      mimeType: string
      fileSize: string
      checksum: string
      storageKey: string
    }
    placeholders: {
      name: string
      kind: string
      mimeType: string
      fileSize: string
      checksum: string
      storageKey: string
    }
    actions: {
      create: string
    }
    validation: {
      nameRequired: string
    }
  }
  policyRuleDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      ruleType: string
      sortOrder: string
      label: string
      daysBeforeDeparture: string
      refundPercent: string
      refundType: string
      currency: string
      flatAmountCents: string
    }
    placeholders: {
      label: string
      daysBeforeDeparture: string
      refundPercent: string
      flatAmountCents: string
    }
    actions: {
      create: string
    }
    ruleTypeLabels: Record<LegalRuleType, string>
    refundTypeLabels: Record<LegalRefundType, string>
    validation: {
      refundPercentMin: string
      refundPercentMax: string
    }
  }
  signatureDialog: {
    title: string
    fields: {
      signerName: string
      signerEmail: string
      signerRole: string
      method: string
      provider: string
      externalReference: string
    }
    placeholders: {
      signerName: string
      signerEmail: string
      signerRole: string
      provider: string
      externalReference: string
    }
    actions: {
      submit: string
    }
    methodLabels: Record<LegalSignatureMethod, string>
    validation: {
      signerNameRequired: string
      signerEmailInvalid: string
    }
  }
  policyVersionDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      title: string
      body: string
    }
    placeholders: {
      title: string
      body: string
    }
    actions: {
      create: string
    }
    validation: {
      titleRequired: string
    }
  }
}
