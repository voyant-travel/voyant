import type { CancellationPolicyRecord, PriceCatalogRecord } from "@voyantjs/pricing-react"

export type RegistryPricingCatalogType = PriceCatalogRecord["catalogType"]
export type RegistryPricingPolicyType = CancellationPolicyRecord["policyType"]

export type RegistryPricingMessages = {
  priceCatalogDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      code: string
      name: string
      type: string
      currency: string
      defaultCatalog: string
      active: string
      notes: string
    }
    placeholders: {
      code: string
      name: string
      currencySearch: string
      currencyEmpty: string
      notes: string
    }
    validation: {
      codeRequired: string
      nameRequired: string
      currencyLength: string
      currencyUppercase: string
    }
    actions: {
      create: string
    }
    catalogTypeLabels: Record<RegistryPricingCatalogType, string>
  }
  cancellationPolicyDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      name: string
      code: string
      type: string
      simpleCutoffHours: string
      defaultPolicy: string
      active: string
      notes: string
    }
    placeholders: {
      name: string
      code: string
      notes: string
    }
    validation: {
      nameRequired: string
      simpleCutoffMin: string
    }
    actions: {
      create: string
    }
    policyTypeLabels: Record<RegistryPricingPolicyType, string>
  }
  pricingCategoryDependencyList: {
    title: string
    description: string
    add: string
    columns: {
      master: string
      dependent: string
      type: string
      limits: string
      status: string
      actions: string
    }
    states: {
      loadFailed: string
      empty: string
      noLimit: string
    }
    labels: {
      perMaster: string
      sum: string
      showing: string
      of: string
      edit: string
      delete: string
      deleteConfirm: string
    }
  }
  priceCatalogsPage: {
    title: string
    description: string
    searchPlaceholder: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      code: string
      name: string
      type: string
      currency: string
      default: string
      status: string
    }
    labels: {
      default: string
      deleteConfirm: string
    }
  }
  priceSchedulesPage: {
    title: string
    description: string
    searchPlaceholder: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      name: string
      catalog: string
      code: string
      valid: string
      priority: string
      status: string
    }
    labels: {
      deleteConfirm: string
      validitySeparator: string
      infinity: string
    }
  }
  cancellationPoliciesPage: {
    title: string
    description: string
    searchPlaceholder: string
    addPolicy: string
    addRule: string
    empty: string
    emptyLoading: string
    rulesEmpty: string
    rulesLoading: string
    simpleCutoff: string
    rulesTitle: string
    columns: {
      sort: string
      cutoff: string
      charge: string
      status: string
      notes: string
    }
    labels: {
      default: string
      deletePolicyConfirm: string
      deleteRuleConfirm: string
      atStart: string
      beforeDays: string
      beforeHours: string
      beforeMinutes: string
      none: string
    }
  }
  optionPriceRulesPage: {
    title: string
    description: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      name: string
      product: string
      option: string
      catalog: string
      schedule: string
      policy: string
      mode: string
      baseSell: string
      status: string
    }
    labels: {
      deleteConfirm: string
    }
  }
  pickupPriceRulesPage: {
    title: string
    description: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      optionPriceRule: string
      pickupPoint: string
      mode: string
      sell: string
      cost: string
      status: string
    }
    labels: {
      deleteConfirm: string
    }
  }
  dropoffPriceRulesPage: {
    title: string
    description: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      optionPriceRule: string
      dropoffName: string
      code: string
      mode: string
      sell: string
      cost: string
      status: string
    }
    labels: {
      deleteConfirm: string
    }
  }
  extraPriceRulesPage: {
    title: string
    description: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      optionPriceRule: string
      productExtra: string
      optionExtraConfig: string
      mode: string
      sell: string
      cost: string
      status: string
    }
    labels: {
      deleteConfirm: string
    }
  }
  optionStartTimeRulesPage: {
    title: string
    description: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      optionPriceRule: string
      startTime: string
      mode: string
      adjustmentType: string
      sellAdjustment: string
      costAdjustment: string
      percent: string
      status: string
    }
    labels: {
      deleteConfirm: string
    }
  }
  optionUnitPriceRulesPage: {
    title: string
    description: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      optionPriceRule: string
      unit: string
      pricingCategory: string
      mode: string
      sell: string
      cost: string
      quantity: string
      status: string
    }
    labels: {
      deleteConfirm: string
    }
  }
  optionUnitTiersPage: {
    title: string
    description: string
    add: string
    empty: string
    emptyLoading: string
    columns: {
      optionUnitPriceRule: string
      quantityRange: string
      sell: string
      cost: string
      order: string
      status: string
    }
    labels: {
      deleteConfirm: string
      infinity: string
    }
  }
}
