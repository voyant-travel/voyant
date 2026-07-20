export type ProductsUiCatalogMessages = {
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
      customerPaymentPolicy: string
    }
    descriptions: {
      customerPaymentPolicy: string
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
      coverRequiresImage: string
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
      chooseFromLibrary: string
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
    libraryAddFailed: string
    deleteConfirm: string
    viewerTitle: string
    coverBadge: string
  }
}
