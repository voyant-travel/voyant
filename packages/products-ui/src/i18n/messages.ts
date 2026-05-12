import type { ProductRecord } from "@voyantjs/products-react"

export type ProductStatus = ProductRecord["status"]
export type ProductBookingMode = ProductRecord["bookingMode"]

export type ProductsUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    create: string
    add: string
    loading: string
    none: string
    previous: string
    next: string
    page: string
    active: string
    inactive: string
    mediaTypeLabels: {
      image: string
      video: string
      document: string
    }
    optionUnitTypeLabels: {
      person: string
      group: string
      room: string
      vehicle: string
      service: string
      other: string
    }
    optionStatusLabels: {
      draft: string
      active: string
      archived: string
    }
    productStatusLabels: Record<ProductStatus, string>
    productBookingModeLabels: Record<ProductBookingMode, string>
  }
  comboboxes: {
    product: {
      placeholder: string
      empty: string
    }
    productCategory: {
      placeholder: string
      empty: string
    }
    productType: {
      placeholder: string
      empty: string
    }
  }
  catalogCard: {
    untitled: string
  }
  productCategoriesPage: {
    title: string
    description: string
  }
  productsPage: {
    title: string
    description: string
  }
  productDetailPage: {
    actions: {
      back: string
      edit: string
      delete: string
      createBooking: string
      addItinerary: string
      editItinerary: string
      deleteItinerary: string
      addDay: string
    }
    sections: {
      overview: {
        title: string
        description: string
      }
      details: {
        title: string
        description: string
      }
      commercial: {
        title: string
        description: string
      }
      itinerary: {
        title: string
        description: string
      }
      sidebar: {
        title: string
        description: string
      }
    }
    fields: {
      status: string
      bookingMode: string
      visibility: string
      capacityMode: string
      timezone: string
      productType: string
      facility: string
      taxClass: string
      sellAmount: string
      costAmount: string
      margin: string
      pax: string
      startDate: string
      endDate: string
      reservationTimeout: string
      tags: string
      createdAt: string
      updatedAt: string
    }
    states: {
      loading: string
      loadFailed: string
      notFoundTitle: string
      notFoundDescription: string
      noDescription: string
      noItineraries: string
      noDays: string
      deleteConfirm: string
      deleteItineraryConfirm: string
      deleteDayConfirm: string
      deleteFailed: string
      minutes: string
    }
  }
  productDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productForm: {
    fields: {
      name: string
      description: string
      tags: string
      status: string
      bookingMode: string
      productType: string
      sellCurrency: string
      sellAmount: string
      costAmount: string
    }
    placeholders: {
      name: string
      description: string
      tagInput: string
      productTypeSearch: string
      currencySearch: string
      amount: string
    }
    validation: {
      nameRequired: string
      sellCurrencyInvalid: string
      saveFailed: string
    }
    actions: {
      cancel: string
      saving: string
      create: string
      saveChanges: string
    }
  }
  productList: {
    searchPlaceholder: string
    newProduct: string
    filters: {
      button: string
      statusLabel: string
      statusAll: string
      dateLabel: string
      datePlaceholder: string
      paxLabel: string
      sellAmountLabel: string
      min: string
      max: string
      clear: string
    }
    columns: {
      name: string
      status: string
      sellAmount: string
      pax: string
      startDate: string
    }
    loadFailed: string
    empty: string
    noValue: string
    paginationShowing: string
    paginationPage: string
    paginationPrevious: string
    paginationNext: string
  }
  productCategoryDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productCategoryForm: {
    fields: {
      name: string
      slug: string
      parentCategory: string
      description: string
      sortOrder: string
      active: string
    }
    placeholders: {
      name: string
      slug: string
      parentCategory: string
      description: string
    }
    validation: {
      nameRequired: string
      slugRequired: string
      saveFailed: string
    }
    actions: {
      createCategory: string
    }
  }
  productCategoryList: {
    searchPlaceholder: string
    addCategory: string
    columns: {
      name: string
      slug: string
      parent: string
      status: string
      actions: string
    }
    loadingError: string
    empty: string
    edit: string
    delete: string
    deleteConfirm: string
    showingSummary: string
  }
  productTagDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productTagForm: {
    fields: {
      name: string
    }
    placeholders: {
      name: string
    }
    validation: {
      nameRequired: string
      saveFailed: string
    }
    actions: {
      createTag: string
    }
  }
  productTagList: {
    searchPlaceholder: string
    addTag: string
    columns: {
      name: string
      actions: string
    }
    loadingError: string
    empty: string
    edit: string
    delete: string
    deleteConfirm: string
    showingSummary: string
  }
  productTagsPage: {
    title: string
    description: string
  }
  productTypesPage: {
    title: string
    description: string
    addType: string
    empty: string
    edit: string
    delete: string
    deleteConfirm: string
    showingSummary: string
    editSheetTitle: string
    newSheetTitle: string
    nameLabel: string
    namePlaceholder: string
    codeLabel: string
    codePlaceholder: string
    descriptionLabel: string
    descriptionPlaceholder: string
    sortOrderLabel: string
    activeLabel: string
    cancel: string
    saveChanges: string
    createType: string
    validation: {
      nameRequired: string
      codeRequired: string
    }
  }
  productMediaDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productMediaForm: {
    fields: {
      mediaType: string
      name: string
      url: string
      storageKey: string
      mimeType: string
      fileSize: string
      sortOrder: string
      coverMedia: string
      altText: string
    }
    placeholders: {
      name: string
      url: string
      mimeType: string
      altText: string
    }
    validation: {
      nameRequired: string
      urlRequired: string
      saveFailed: string
    }
    actions: {
      addMedia: string
      saveMedia: string
    }
  }
  productMediaSection: {
    titles: {
      media: string
      dayMedia: string
    }
    descriptions: {
      media: string
      dayMedia: string
    }
    actions: {
      upload: string
      addMedia: string
      reorder: string
      saveOrder: string
      cancelReorder: string
      drag: string
      markCover: string
      openPreview: string
      closePreview: string
      previousMedia: string
      nextMedia: string
      openFile: string
      edit: string
      delete: string
    }
    loadingError: string
    empty: string
    itemCount: string
    uploadFailed: string
    deleteConfirm: string
    viewerTitle: string
    coverBadge: string
  }
  productDayDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productDayForm: {
    fields: {
      dayNumber: string
      location: string
      title: string
      description: string
    }
    placeholders: {
      location: string
      title: string
      description: string
    }
    validation: {
      dayNumberMin: string
      saveFailed: string
    }
    actions: {
      addDay: string
      saveDay: string
    }
  }
  productDayServiceForm: {
    fields: {
      supplierService: string
      serviceType: string
      countryCode: string
      name: string
      description: string
      costCurrency: string
      costAmount: string
      quantity: string
      sortOrder: string
      notes: string
    }
    placeholders: {
      supplierService: string
      countryCode: string
      name: string
      description: string
      notes: string
    }
    serviceTypes: {
      accommodation: string
      transfer: string
      experience: string
      guide: string
      meal: string
      other: string
    }
    validation: {
      nameRequired: string
      currencyRequired: string
      costNonNegative: string
      quantityMin: string
      saveFailed: string
    }
    actions: {
      addService: string
      saveService: string
    }
  }
  productItineraryDayRow: {
    dayLabel: string
    emptyServices: string
    servicesLoadingError: string
    columns: {
      name: string
      type: string
      cost: string
      quantity: string
    }
  }
  productItineraryDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
    fields: {
      name: string
      defaultItinerary: string
      notesDefaultLocked: string
      notesFirstDefault: string
    }
    placeholders: {
      name: string
    }
    validation: {
      nameRequired: string
      saveFailed: string
    }
    actions: {
      createItinerary: string
    }
  }
  optionUnitDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  optionUnitForm: {
    fields: {
      name: string
      code: string
      unitType: string
      sortOrder: string
      minQuantity: string
      maxQuantity: string
      minAge: string
      maxAge: string
      occupancyMin: string
      occupancyMax: string
      description: string
      required: string
      hidden: string
    }
    placeholders: {
      name: string
      code: string
      description: string
    }
    validation: {
      nameRequired: string
      saveFailed: string
    }
    actions: {
      createUnit: string
    }
  }
  productVersionDialog: {
    title: string
    description: string
    fields: {
      notes: string
    }
    placeholders: {
      notes: string
    }
    validation: {
      saveFailed: string
    }
    actions: {
      createVersion: string
    }
  }
  productVersionsSection: {
    titles: {
      default: string
    }
    descriptions: {
      default: string
    }
    actions: {
      createVersion: string
    }
    loadingError: string
    empty: string
    versionLabel: string
  }
  productOptionDialog: {
    titles: {
      create: string
      edit: string
    }
    descriptions: {
      create: string
      edit: string
    }
  }
  productOptionForm: {
    fields: {
      name: string
      code: string
      description: string
      status: string
      sortOrder: string
      availableFrom: string
      availableTo: string
      defaultOption: string
    }
    placeholders: {
      name: string
      code: string
      description: string
      availableFrom: string
      availableTo: string
    }
    validation: {
      nameRequired: string
      saveFailed: string
    }
    actions: {
      createOption: string
    }
  }
  productOptionsSection: {
    titles: {
      default: string
      units: string
    }
    descriptions: {
      default: string
      units: string
    }
    actions: {
      addOption: string
      addUnit: string
      duplicate: string
      edit: string
      delete: string
    }
    loadingError: {
      options: string
      units: string
    }
    empty: {
      options: string
      units: string
    }
    deleteConfirm: {
      option: string
      unit: string
    }
    columns: {
      unitType: string
      unitName: string
      quantity: string
      age: string
      occupancy: string
      actions: string
    }
    badges: {
      defaultOption: string
    }
  }
}
