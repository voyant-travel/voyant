import type { ProductsUiMessages } from "./messages.js"

export const productsUiEn = {
  common: {
    cancel: "Cancel",
    saveChanges: "Save changes",
    create: "Create",
    add: "Add",
    loading: "Loading...",
    none: "—",
    previous: "Previous",
    next: "Next",
    page: "Page",
    active: "Active",
    inactive: "Inactive",
    mediaTypeLabels: {
      image: "Image",
      video: "Video",
      document: "Document",
    },
    optionUnitTypeLabels: {
      person: "Person",
      group: "Group",
      room: "Room",
      vehicle: "Vehicle",
      service: "Service",
      other: "Other",
    },
    optionStatusLabels: {
      draft: "Draft",
      active: "Active",
      archived: "Archived",
    },
  },
  comboboxes: {
    productCategory: {
      placeholder: "Search parent category...",
      empty: "No product categories found.",
    },
    productType: {
      placeholder: "Search product types...",
      empty: "No product types found.",
    },
  },
  productCategoriesPage: {
    title: "Categories",
    description: "Hierarchical product categories for organizing your catalog.",
  },
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
      addMedia: "Add media",
      markCover: "Mark as cover",
      edit: "Edit",
      delete: "Delete",
    },
    loadingError: "Failed to load media.",
    empty: "No media items configured yet.",
    uploadFailed: "Failed to upload media.",
    deleteConfirm: "Delete this media item?",
    coverBadge: "Cover",
    columns: {
      name: "Name",
      type: "Type",
      url: "URL",
      sort: "Sort",
    },
  },
  productDayDialog: {
    titles: {
      create: "Add itinerary day",
      edit: "Edit itinerary day",
    },
    descriptions: {
      create: "Create a structured day in the product itinerary.",
      edit: "Update the title, location, and overview for this day.",
    },
  },
  productDayForm: {
    fields: {
      dayNumber: "Day number",
      location: "Location",
      title: "Title",
      description: "Description",
    },
    placeholders: {
      location: "Dubrovnik",
      title: "Arrival in Dubrovnik",
      description: "Overview and activities for this day",
    },
    validation: {
      dayNumberMin: "Day number must be at least 1.",
      saveFailed: "Failed to save day.",
    },
    actions: {
      addDay: "Add day",
      saveDay: "Save day",
    },
  },
  productDayServiceForm: {
    fields: {
      supplierService: "Supplier service",
      serviceType: "Service type",
      countryCode: "Country code",
      name: "Name",
      description: "Description",
      costCurrency: "Currency",
      costAmount: "Cost",
      quantity: "Quantity",
      sortOrder: "Sort order",
      notes: "Notes",
    },
    placeholders: {
      supplierService: "Optional supplier service id",
      countryCode: "RO",
      name: "Hotel stay",
      description: "Operational service details",
      notes: "Internal notes",
    },
    serviceTypes: {
      accommodation: "Accommodation",
      transfer: "Transfer",
      experience: "Experience",
      guide: "Guide",
      meal: "Meal",
      other: "Other",
    },
    validation: {
      nameRequired: "Service name is required.",
      currencyRequired: "Currency must be a 3-letter ISO code.",
      costNonNegative: "Cost must be zero or greater.",
      quantityMin: "Quantity must be at least 1.",
      saveFailed: "Failed to save service.",
    },
    actions: {
      addService: "Add service",
      saveService: "Save service",
    },
  },
  productItineraryDayRow: {
    dayLabel: "Day {dayNumber}",
    emptyServices: "No services configured for this day.",
    servicesLoadingError: "Failed to load day services.",
    columns: {
      name: "Name",
      type: "Type",
      cost: "Cost",
      quantity: "Quantity",
    },
  },
  productItineraryDialog: {
    titles: {
      create: "New itinerary",
      edit: "Rename itinerary",
    },
    descriptions: {
      create: "Add another itinerary variant for this product.",
      edit: "Update the itinerary name and default state.",
    },
    fields: {
      name: "Name",
      defaultItinerary: "Set as default itinerary",
      notesDefaultLocked: "This is the default. Set another itinerary as default to change it.",
      notesFirstDefault: "The first itinerary is automatically the default.",
    },
    placeholders: {
      name: "e.g. Main itinerary, Family variant",
    },
    validation: {
      nameRequired: "Name is required",
      saveFailed: "Failed to save itinerary.",
    },
    actions: {
      createItinerary: "Create itinerary",
    },
  },
  optionUnitDialog: {
    titles: {
      create: "New option unit",
      edit: "Edit option unit",
    },
    descriptions: {
      create: "Create a selectable unit under this option.",
      edit: "Update unit constraints, quantity limits, and occupancy rules.",
    },
  },
  optionUnitForm: {
    fields: {
      name: "Name",
      code: "Code",
      unitType: "Unit type",
      sortOrder: "Sort order",
      minQuantity: "Min quantity",
      maxQuantity: "Max quantity",
      minAge: "Min age",
      maxAge: "Max age",
      occupancyMin: "Occupancy min",
      occupancyMax: "Occupancy max",
      description: "Description",
      required: "Required",
      hidden: "Hidden",
    },
    placeholders: {
      name: "Adult",
      code: "adult",
      description: "Optional unit description",
    },
    validation: {
      nameRequired: "Unit name is required.",
      saveFailed: "Failed to save option unit.",
    },
    actions: {
      createUnit: "Create unit",
    },
  },
  productVersionDialog: {
    title: "Create version snapshot",
    description:
      "Save the current product state, including itinerary and option structure, as a new version.",
    fields: {
      notes: "Notes",
    },
    placeholders: {
      notes: "What changed in this version?",
    },
    validation: {
      saveFailed: "Failed to create version snapshot.",
    },
    actions: {
      createVersion: "Create version",
    },
  },
  productVersionsSection: {
    titles: {
      default: "Versions",
    },
    descriptions: {
      default: "Create and browse immutable product snapshots.",
    },
    actions: {
      createVersion: "Create version",
    },
    loadingError: "Failed to load product versions.",
    empty: "No version snapshots created yet.",
    versionLabel: "Version",
  },
  productOptionDialog: {
    titles: {
      create: "New option",
      edit: "Edit option",
    },
    descriptions: {
      create: "Create a reusable option under this product.",
      edit: "Update option availability, ordering, and default behavior.",
    },
  },
  productOptionForm: {
    fields: {
      name: "Name",
      code: "Code",
      description: "Description",
      status: "Status",
      sortOrder: "Sort order",
      availableFrom: "Available from",
      availableTo: "Available to",
      defaultOption: "Default option",
    },
    placeholders: {
      name: "Single room",
      code: "single-room",
      description: "Optional option description",
      availableFrom: "Select start date",
      availableTo: "Select end date",
    },
    validation: {
      nameRequired: "Option name is required.",
      saveFailed: "Failed to save product option.",
    },
    actions: {
      createOption: "Create option",
    },
  },
  productOptionsSection: {
    titles: {
      default: "Options and units",
      units: "Units",
    },
    descriptions: {
      default: "Manage option variants and the units available under each option.",
      units: "Configure the selectable units that belong to this option.",
    },
    actions: {
      addOption: "Add option",
      addUnit: "Add unit",
      duplicate: "Duplicate option",
      edit: "Edit",
      delete: "Delete",
    },
    loadingError: {
      options: "Failed to load product options.",
      units: "Failed to load option units.",
    },
    empty: {
      options: "No options configured for this product.",
      units: "No units configured for this option.",
    },
    deleteConfirm: {
      option: 'Delete option "{name}" and all its units?',
      unit: 'Delete unit "{name}"?',
    },
    columns: {
      unitType: "Type",
      unitName: "Name",
      quantity: "Quantity",
      age: "Age",
      occupancy: "Occupancy",
      actions: "Actions",
    },
    badges: {
      defaultOption: "Default",
    },
  },
} satisfies ProductsUiMessages
