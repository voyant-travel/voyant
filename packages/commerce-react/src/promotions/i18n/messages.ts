import type {
  PromotionalOfferApplicationMode,
  PromotionalOfferListStatus,
  PromotionalOfferScopeKind,
} from "../index.js"

export type PromotionsUiMessages = {
  common: {
    cancel: string
    create: string
    saveChanges: string
    saving: string
    active: string
    edit: string
    archive: string
    activate: string
    delete: string
    discountTypeLabels: Record<"percentage" | "fixed_amount", string>
    applicationModeLabels: Record<PromotionalOfferApplicationMode, string>
    statusLabels: Record<PromotionalOfferListStatus, string>
    scopeKindLabels: Record<PromotionalOfferScopeKind, string>
    audienceLabels: Record<"staff" | "customer" | "partner" | "supplier", string>
  }
  promotionsPage: {
    title: string
    description: string
    newPromotion: string
    searchLabel: string
    searchPlaceholder: string
    modePlaceholder: string
    allModes: string
    statusPlaceholder: string
    allStatuses: string
    scopePlaceholder: string
    allScopes: string
    validityRangePlaceholder: string
    filtersButton: string
    clearFilters: string
    loadFailed: string
    loadFailedPrefix: string
    empty: string
    columns: {
      name: string
      mode: string
      scope: string
      discount: string
      validity: string
      code: string
      status: string
      actions: string
    }
    actions: {
      edit: string
      archive: string
      activate: string
      delete: string
      archiveConfirm: string
      activateConfirm: string
      deleteConfirm: string
      deleteConflict: string
      actionFailedPrefix: string
      dismissError: string
    }
    badges: {
      auto: string
      code: string
      stackable: string
    }
    pagination: {
      showing: string
      previous: string
      next: string
      page: string
    }
    summaries: {
      globalScope: string
      productsScope: string
      categoriesScope: string
      destinationsScope: string
      marketsScope: string
      audiencesScope: string
      fareCodesScope: string
      cabinGradesScope: string
      productNouns: {
        singular: string
        plural: string
      }
      categoryNouns: {
        singular: string
        plural: string
      }
      destinationNouns: {
        singular: string
        plural: string
      }
      unknownPercentage: string
      anytime: string
      until: string
      from: string
      range: string
      noCode: string
    }
  }
  promotionDialog: {
    titles: {
      create: string
      edit: string
    }
    description: string
    fields: {
      name: string
      slug: string
      description: string
      type: string
      percent: string
      amount: string
      currency: string
      scope: string
      scopeIds: string
      products: string
      categories: string
      audiences: string
      validFrom: string
      validUntil: string
      code: string
      minPax: string
      stackable: string
      active: string
    }
    placeholders: {
      name: string
      slug: string
      description: string
      percent: string
      amount: string
      currency: string
      code: string
      minPax: string
      productIds: string
      productPicker: string
      categoryIds: string
      categoryPicker: string
      destinationIds: string
      marketIds: string
      fareCodes: string
      cabinGradeCodes: string
    }
    hints: {
      globalScope: string
      commaSeparatedIds: string
      noProductsSelected: string
      noCategoriesSelected: string
    }
    actions: {
      removeScopeId: string
    }
    validation: {
      nameRequired: string
      slugRequired: string
      slugInvalid: string
      codeInvalid: string
      discountPercentRequired: string
      discountPercentInvalid: string
      discountAmountRequired: string
      currencyRequired: string
      minPaxInvalid: string
      validFromInvalid: string
      validUntilInvalid: string
      validRangeInvalid: string
      scopeInvalid: string
      scopeInvalidPrefix: string
      scopeIdsRequired: string
    }
  }
}
