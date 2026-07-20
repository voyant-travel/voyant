import type { ProductsUiCatalogMessages } from "./messages-catalog.js"

export const productsUiCatalogEn = {
  productCategoryDialog: {
    titles: {
      create: "New product category",
      edit: "Edit product category",
    },
    descriptions: {
      create: "Create a category for organizing your product catalog.",
      edit: "Update category hierarchy, slug, and active state.",
    },
  },
  productCategoryForm: {
    fields: {
      name: "Name",
      slug: "Slug",
      parentCategory: "Parent category",
      description: "Description",
      sortOrder: "Sort order",
      active: "Active",
      customerPaymentPolicy: "Customer payment policy",
    },
    descriptions: {
      customerPaymentPolicy:
        "When set, products in this category inherit these terms unless the listing or booking sets its own override. Wins over the supplier-level policy.",
    },
    placeholders: {
      name: "Adventure",
      slug: "adventure",
      parentCategory: "Search parent category...",
      description: "Category description...",
    },
    validation: {
      nameRequired: "Category name is required.",
      slugRequired: "Category slug is required.",
      saveFailed: "Failed to save product category.",
    },
    actions: {
      createCategory: "Create category",
    },
  },
  productCategoryList: {
    searchPlaceholder: "Search product categories...",
    addCategory: "Add category",
    columns: {
      name: "Name",
      slug: "Slug",
      parent: "Parent",
      status: "Status",
      actions: "Actions",
    },
    loadingError: "Failed to load product categories.",
    empty: "No product categories found.",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this product category?",
    showingSummary: "Showing {count} of {total}",
  },
  productTagDialog: {
    titles: {
      create: "New product tag",
      edit: "Edit product tag",
    },
    descriptions: {
      create: "Create a reusable tag for filtering and classification.",
      edit: "Update the tag used to label and filter products.",
    },
  },
  productTagForm: {
    fields: {
      name: "Name",
    },
    placeholders: {
      name: "Family Friendly",
    },
    validation: {
      nameRequired: "Tag name is required.",
      saveFailed: "Failed to save product tag.",
    },
    actions: {
      createTag: "Create tag",
    },
  },
  productTagList: {
    searchPlaceholder: "Search product tags...",
    addTag: "Add tag",
    columns: {
      name: "Name",
      actions: "Actions",
    },
    loadingError: "Failed to load product tags.",
    empty: "No product tags found.",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this product tag?",
    showingSummary: "Showing {count} of {total}",
  },
  productTagsPage: {
    title: "Product Tags",
    description: "Free-form labels to tag and filter products.",
  },
  productTypesPage: {
    title: "Product Types",
    description:
      "Classification types for your products: City Break, Circuit, Cruise, and similar.",
    addType: "Add Type",
    empty: "No product types yet. Create types like City Break, Circuit, or Cruise.",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this product type?",
    showingSummary: "Showing {count} of {total}",
    editSheetTitle: "Edit Product Type",
    newSheetTitle: "New Product Type",
    nameLabel: "Name",
    namePlaceholder: "City Break",
    codeLabel: "Code",
    codePlaceholder: "city-break",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Optional description...",
    sortOrderLabel: "Sort Order",
    activeLabel: "Active",
    cancel: "Cancel",
    saveChanges: "Save Changes",
    createType: "Create Type",
    validation: {
      nameRequired: "Name is required",
      codeRequired: "Code is required",
    },
  },
  productMediaDialog: {
    titles: {
      create: "Add media",
      edit: "Edit media",
    },
    descriptions: {
      create: "Register a product or day-level media item by URL.",
      edit: "Update metadata, sorting, and cover behavior for this media item.",
    },
  },
  productMediaForm: {
    fields: {
      mediaType: "Media type",
      name: "Name",
      url: "URL",
      storageKey: "Storage key",
      mimeType: "MIME type",
      fileSize: "File size",
      sortOrder: "Sort order",
      coverMedia: "Cover media",
      altText: "Alt text",
    },
    placeholders: {
      name: "Hero image",
      url: "https://example.com/media/hero.jpg",
      mimeType: "image/jpeg",
      altText: "Short accessibility description",
    },
    validation: {
      nameRequired: "Media name is required.",
      urlRequired: "Media URL is required.",
      coverRequiresImage: "Only image media can be marked as cover.",
      saveFailed: "Failed to save media.",
    },
    actions: {
      addMedia: "Add media",
      saveMedia: "Save media",
    },
  },
  productMediaSection: {
    titles: {
      media: "Media",
      dayMedia: "Day media",
    },
    descriptions: {
      media: "Manage product-level media assets and cover selection.",
      dayMedia: "Manage media attached to this itinerary day.",
    },
    actions: {
      upload: "Upload",
      chooseFromLibrary: "Choose from Media Library",
      addMedia: "Add media",
      reorder: "Reorder",
      saveOrder: "Save order",
      cancelReorder: "Cancel",
      drag: "Drag",
      markCover: "Mark as cover",
      openPreview: "Open media preview",
      closePreview: "Close preview",
      previousMedia: "Previous media",
      nextMedia: "Next media",
      openFile: "Open file",
      edit: "Edit",
      delete: "Delete",
    },
    loadingError: "Failed to load media.",
    empty: "No media items configured yet.",
    itemCount: "Media items: {count}",
    uploadFailed: "Failed to upload media.",
    libraryAddFailed: "Failed to add media from the library.",
    deleteConfirm: "Delete this media item?",
    viewerTitle: "Media preview",
    coverBadge: "Cover",
  },
} satisfies ProductsUiCatalogMessages
