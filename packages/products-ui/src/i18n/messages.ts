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
  }
  comboboxes: {
    productCategory: {
      placeholder: string
      empty: string
    }
    productType: {
      placeholder: string
      empty: string
    }
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
      markCover: string
      edit: string
      delete: string
    }
    loadingError: string
    empty: string
    uploadFailed: string
    deleteConfirm: string
    coverBadge: string
    columns: {
      name: string
      type: string
      url: string
      sort: string
    }
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
