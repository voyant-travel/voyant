import type { LegalUiMessages } from "./messages.js"

export const legalUiEn = {
  common: {
    cancel: "Cancel",
    saveChanges: "Save Changes",
    create: "Create",
    edit: "Edit",
    add: "Add",
    loading: "Loading...",
    none: "-",
    selectPlaceholder: "Select...",
    optionalPlaceholder: "Optional",
    kilobytes: "KB",
  },
  bookingContractCard: {
    heading: "Contract",
    empty: "No contract has been generated for this booking yet.",
    generate: "Generate",
    regenerate: "Regenerate",
    download: "Download",
    noAttachments: "No documents attached yet.",
    issuedAt: "Issued",
    contractNumber: "#",
    unsaved: "Pending",
    contractStatusLabels: {
      draft: "Draft",
      issued: "Issued",
      sent: "Sent",
      signed: "Signed",
      executed: "Executed",
      expired: "Expired",
      void: "Void",
    },
  },
  numberSeriesPage: {
    title: "Contract Number Series",
    description: "Configure numbering sequences for contracts.",
    actions: {
      create: "New Series",
    },
    columns: {
      name: "Name",
      prefix: "Prefix",
      separator: "Separator",
      pad: "Pad",
      current: "Current",
      reset: "Reset",
      scope: "Scope",
      status: "Status",
    },
    active: "Active",
    inactive: "Inactive",
    empty: "No number series yet. Create one to configure contract numbering.",
    deleteConfirm: 'Delete series "{name}"?',
  },
  attachmentDialog: {
    titles: {
      create: "Add Attachment",
      edit: "Edit Attachment",
    },
    fields: {
      name: "Name",
      kind: "Kind",
      mimeType: "MIME Type",
      fileSize: "File Size",
      checksum: "Checksum",
      storageKey: "Storage Key",
    },
    placeholders: {
      name: "Attachment name",
      kind: "appendix",
      mimeType: "application/pdf",
      fileSize: "Bytes",
      checksum: "Optional",
      storageKey: "Optional storage reference",
    },
    actions: {
      create: "Add Attachment",
    },
    validation: {
      nameRequired: "Name is required",
    },
  },
  policyRuleDialog: {
    titles: {
      create: "New Rule",
      edit: "Edit Rule",
    },
    fields: {
      ruleType: "Rule Type",
      sortOrder: "Sort Order",
      label: "Label",
      daysBeforeDeparture: "Days Before Departure",
      refundPercent: "Refund Percent (basis points)",
      refundType: "Refund Type",
      currency: "Currency",
      flatAmountCents: "Flat Amount (cents)",
    },
    placeholders: {
      label: "e.g. 30+ days before departure",
      daysBeforeDeparture: "e.g. 30",
      refundPercent: "e.g. 10000 = 100%",
      flatAmountCents: "e.g. 5000",
    },
    actions: {
      create: "Create Rule",
    },
    ruleTypeLabels: {
      window: "Window",
      percentage: "Percentage",
      flat_amount: "Flat Amount",
      date_range: "Date Range",
      custom: "Custom",
    },
    refundTypeLabels: {
      cash: "Cash",
      credit: "Credit",
      cash_or_credit: "Cash or Credit",
      none: "None",
    },
    validation: {
      refundPercentMin: "Refund percent must be at least 0",
      refundPercentMax: "Refund percent must be at most 10000",
    },
  },
  signatureDialog: {
    title: "Record Signature",
    fields: {
      signerName: "Signer Name",
      signerEmail: "Signer Email",
      signerRole: "Signer Role",
      method: "Method",
      provider: "Provider",
      externalReference: "External Reference",
    },
    placeholders: {
      signerName: "Full name",
      signerEmail: "email@example.com",
      signerRole: "e.g. CEO, Legal Rep",
      provider: "Optional",
      externalReference: "Optional",
    },
    actions: {
      submit: "Record Signature",
    },
    methodLabels: {
      manual: "Manual",
      electronic: "Electronic",
      docusign: "DocuSign",
      other: "Other",
    },
    validation: {
      signerNameRequired: "Signer name is required",
      signerEmailInvalid: "Enter a valid email address",
    },
  },
  policyVersionDialog: {
    titles: {
      create: "New Version",
      edit: "Edit Version",
    },
    fields: {
      title: "Title",
      body: "Body",
    },
    placeholders: {
      title: "Version title",
      body: "Policy content...",
    },
    actions: {
      create: "Create Version",
    },
    validation: {
      titleRequired: "Title is required",
    },
  },
} satisfies LegalUiMessages
