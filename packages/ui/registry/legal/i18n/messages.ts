import type { LegalUiMessages } from "../../../../legal-ui/src/i18n/messages"

export type RegistryLegalMessages = LegalUiMessages & {
  common: LegalUiMessages["common"] & {
    contractScopeLabels: {
      customer: string
      supplier: string
      partner: string
      channel: string
      other: string
    }
    contractStatusLabels: {
      draft: string
      issued: string
      sent: string
      signed: string
      executed: string
      expired: string
      void: string
    }
    active: string
    inactive: string
    back: string
    open: string
    delete: string
    issue: string
    send: string
    sign: string
    execute: string
    addSignature: string
    addAttachment: string
    addVersion: string
    createVersion: string
    renderedBody: string
    noResultsDash: string
    resetStrategyLabels: {
      never: string
      annual: string
      monthly: string
    }
    policyKindLabels: {
      cancellation: string
      payment: string
      terms_and_conditions: string
      privacy: string
      refund: string
      commission: string
      guarantee: string
      other: string
    }
  }
  authoringHelp: {
    title: string
    description: string
    tabs: {
      variables: string
      liquid: string
    }
    searchPlaceholder: string
    noVariables: string
    example: string
    insert: string
    liquidUsage: string
    noLiquidSnippets: string
  }
  contractsPage: {
    title: string
    description: string
    create: string
    searchPlaceholder: string
    filters: {
      scope: string
      status: string
      allScopes: string
      allStatuses: string
    }
    columns: {
      number: string
      title: string
      scope: string
      status: string
      person: string
      created: string
    }
    summary: string
  }
  contractDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      scope: string
      language: string
      title: string
      templateVersionId: string
      seriesId: string
      personId: string
      organizationId: string
      supplierId: string
      channelId: string
      expiresAt: string
      variables: string
      metadata: string
    }
    placeholders: {
      language: string
      title: string
      optional: string
      expiresAt: string
      variables: string
      metadata: string
    }
    actions: {
      create: string
    }
    validation: {
      titleRequired: string
    }
  }
  contractDetailPage: {
    notFound: string
    backToContracts: string
    sections: {
      details: string
      parties: string
      signatures: string
      attachments: string
    }
    fields: {
      language: string
      templateVersion: string
      series: string
      expires: string
      created: string
      updated: string
      person: string
      organization: string
      supplier: string
      channel: string
      name: string
      email: string
      role: string
      method: string
      signedAt: string
      kind: string
      mimeType: string
      size: string
    }
    empty: {
      noParties: string
      noSignatures: string
      noAttachments: string
    }
    confirms: {
      voidContract: string
      deleteContract: string
      deleteAttachment: string
    }
  }
  templatesPage: {
    title: string
    description: string
    create: string
    searchPlaceholder: string
    allScopes: string
    empty: string
    versions: string
    noVersions: string
    columns: {
      version: string
      changelog: string
      createdBy: string
      createdAt: string
    }
    confirms: {
      deleteTemplate: string
    }
  }
  templateDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      name: string
      slug: string
      scope: string
      language: string
      description: string
      body: string
      active: string
    }
    placeholders: {
      name: string
      slug: string
      language: string
      description: string
      body: string
    }
    actions: {
      create: string
    }
    validation: {
      nameRequired: string
      slugRequired: string
      slugKebabCase: string
      bodyRequired: string
    }
  }
  templateVersionDialog: {
    title: string
    fields: {
      body: string
      changelog: string
      createdBy: string
    }
    placeholders: {
      body: string
      changelog: string
      createdBy: string
    }
    validation: {
      bodyRequired: string
    }
  }
  numberSeriesPage: {
    title: string
    description: string
    create: string
    empty: string
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
    confirms: {
      deleteSeries: string
    }
  }
  numberSeriesDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      name: string
      prefix: string
      separator: string
      padLength: string
      resetStrategy: string
      scope: string
      active: string
    }
    placeholders: {
      name: string
      prefix: string
      separator: string
    }
    actions: {
      create: string
    }
    validation: {
      nameRequired: string
      prefixRequired: string
    }
    duplicateWarning: string
  }
  policiesPage: {
    title: string
    description: string
    create: string
    searchPlaceholder: string
    allKinds: string
    columns: {
      name: string
      slug: string
      kind: string
      language: string
      created: string
    }
    summary: string
  }
  policyDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      kind: string
      name: string
      slug: string
      description: string
      language: string
    }
    placeholders: {
      name: string
      slug: string
      description: string
      language: string
    }
    actions: {
      create: string
    }
    validation: {
      nameRequired: string
      slugRequired: string
      slugKebabCase: string
    }
  }
  policyAssignmentDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      scope: string
      priority: string
      productId: string
      channelId: string
      supplierId: string
      marketId: string
      organizationId: string
      validFrom: string
      validTo: string
    }
    placeholders: {
      productId: string
      channelId: string
      supplierId: string
      marketId: string
      organizationId: string
      validFrom: string
      validTo: string
    }
    actions: {
      create: string
    }
    scopeLabels: {
      product: string
      channel: string
      supplier: string
      market: string
      organization: string
      global: string
    }
    validation: {
      policyIdRequired: string
    }
  }
  policyDetailPage: {
    notFound: string
    backToPolicies: string
    sections: {
      versions: string
      assignments: string
      recentAcceptances: string
      body: string
      rules: string
    }
    empty: {
      noVersions: string
      noAssignments: string
      noAcceptances: string
      noRules: string
    }
    fields: {
      scope: string
      targetId: string
      priority: string
      valid: string
      versionId: string
      personId: string
      bookingId: string
      method: string
      acceptedAt: string
      sort: string
      type: string
      label: string
      days: string
      refund: string
      refundType: string
    }
    actions: {
      createVersion: string
      addAssignment: string
      addRule: string
      publish: string
      retire: string
    }
    current: string
    always: string
    validRange: string
    confirms: {
      deletePolicy: string
      deleteAssignment: string
      deleteRule: string
    }
  }
  templateDetailPage: {
    notFound: string
    backToTemplates: string
    sections: {
      details: string
      description: string
      currentBody: string
      variables: string
      versions: string
    }
    fields: {
      language: string
      currentVersionId: string
      created: string
      updated: string
      version: string
      changelog: string
      createdBy: string
      createdAt: string
    }
    empty: {
      noDescription: string
      noVersions: string
    }
    actions: {
      addVersion: string
    }
    currentBadge: string
    variablesDescription: string
    confirms: {
      deleteTemplate: string
    }
  }
}
