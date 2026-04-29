import type { PricingUiMessages } from "./messages"

export const pricingUiEn = {
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
    categoryTypeLabels: {
      adult: "Adult",
      child: "Child",
      infant: "Infant",
      senior: "Senior",
      group: "Group",
      room: "Room",
      vehicle: "Vehicle",
      service: "Service",
      other: "Other",
    },
    dependencyTypeLabels: {
      requires: "Requires",
      limits_per_master: "Limits per master",
      limits_sum: "Limits sum",
      excludes: "Excludes",
    },
    chargeTypeLabels: {
      none: "None",
      amount: "Amount",
      percentage: "Percentage",
    },
    addonPricingModeLabels: {
      included: "Included",
      per_person: "Per person",
      per_booking: "Per booking",
      on_request: "On request",
      unavailable: "Unavailable",
    },
    optionPriceRulePricingModeLabels: {
      per_person: "Per person",
      per_booking: "Per booking",
      starting_from: "Starting from",
      free: "Free",
      on_request: "On request",
    },
    startTimeRuleModeLabels: {
      included: "Included",
      excluded: "Excluded",
      override: "Override",
      adjustment: "Adjustment",
    },
    adjustmentTypeLabels: {
      fixed: "Fixed",
      percentage: "Percentage",
    },
    unitPricingModeLabels: {
      per_unit: "Per unit",
      per_person: "Per person",
      per_booking: "Per booking",
      included: "Included",
      free: "Free",
      on_request: "On request",
    },
  },
  comboboxes: {
    pricingCategory: {
      placeholder: "Search pricing categories...",
      empty: "No pricing categories found.",
    },
    priceCatalog: {
      placeholder: "Search price catalogs...",
      empty: "No price catalogs found.",
    },
    priceSchedule: {
      placeholder: "Search price schedules...",
      empty: "No price schedules found.",
    },
    cancellationPolicy: {
      placeholder: "Search cancellation fee policies...",
      empty: "No cancellation fee policies found.",
    },
    optionPriceRule: {
      placeholder: "Search option price rules...",
      empty: "No option price rules found.",
    },
    product: {
      placeholder: "Search products...",
      empty: "No products found.",
    },
    productOption: {
      placeholder: "Select product option...",
      empty: "No product options found.",
      missingParent: "Select a product first.",
    },
  },
  pricingCategoryDialog: {
    titles: {
      create: "New pricing category",
      edit: "Edit pricing category",
    },
    descriptions: {
      create: "Create a reusable pricing category for products and options.",
      edit: "Update reusable pricing category rules and eligibility.",
    },
  },
  pricingCategoryForm: {
    fields: {
      name: "Name",
      code: "Code",
      type: "Type",
      seatOccupancy: "Seat occupancy",
      ageQualified: "Age qualified",
      minAge: "Min age",
      maxAge: "Max age",
      sortOrder: "Sort order",
      active: "Active",
    },
    placeholders: {
      name: "Adult",
      code: "adult",
    },
    validation: {
      nameRequired: "Category name is required.",
      saveFailed: "Failed to save pricing category.",
    },
    actions: {
      create: "Create category",
    },
  },
  pricingCategoryList: {
    searchPlaceholder: "Search pricing categories...",
    add: "New category",
    columns: {
      name: "Name",
      code: "Code",
      type: "Type",
      age: "Age",
      seat: "Seat",
      sort: "Sort",
      status: "Status",
      actions: "Actions",
    },
    loadingError: "Failed to load pricing categories.",
    empty: "No pricing categories found.",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: 'Delete category "{name}"?',
    showingSummary: "Showing {count} of {total}",
  },
  pricingCategoryDependencyDialog: {
    titles: {
      create: "Add category dependency",
      edit: "Edit category dependency",
    },
    description:
      "Rules between pricing categories such as requires, excludes, and quantity limits.",
  },
  pricingCategoryDependencyForm: {
    fields: {
      masterCategory: "Master category",
      dependentCategory: "Dependent category",
      dependencyType: "Dependency type",
      maxPerMaster: "Max per master",
      maxDependentSum: "Max dependent sum",
      active: "Active",
      notes: "Notes",
    },
    placeholders: {
      categorySearch: "Search category",
    },
    validation: {
      categoriesRequired: "Both master and dependent categories are required.",
      saveFailed: "Failed to save category dependency.",
    },
    actions: {
      create: "Add dependency",
    },
  },
  priceScheduleDialog: {
    titles: {
      create: "New Price Schedule",
      edit: "Edit Price Schedule",
    },
    fields: {
      catalog: "Catalog",
      name: "Name",
      code: "Code",
      recurrenceRule: "Recurrence rule (RRULE)",
      validFrom: "Valid from",
      validTo: "Valid to",
      timezone: "Timezone",
      priority: "Priority",
      active: "Active",
      notes: "Notes",
    },
    placeholders: {
      catalog: "Search price catalogs...",
      name: "High Season",
      code: "high-season",
      recurrenceRule: "FREQ=YEARLY;BYMONTH=6,7,8",
      validFrom: "Optional",
      validTo: "Optional",
      timezone: "Europe/Istanbul",
    },
    validation: {
      catalogRequired: "Catalog is required",
      nameRequired: "Name is required",
      recurrenceRuleRequired: "RRULE is required",
    },
    helpText: {
      recurrenceRuleExample: "e.g. FREQ=YEARLY;BYMONTH=6,7,8 for June-August.",
    },
    actions: {
      create: "Create Schedule",
    },
  },
  cancellationPolicyRuleDialog: {
    titles: {
      create: "Add cancellation rule",
      edit: "Edit cancellation rule",
    },
    fields: {
      cutoffMinutesBefore: "Cutoff (minutes before)",
      sortOrder: "Sort order",
      chargeType: "Charge type",
      chargeAmount: "Charge amount",
      chargePercent: "Charge percent (0-100)",
      active: "Active",
      notes: "Notes",
    },
    placeholders: {
      cutoffMinutesBefore: "2880",
      chargePercent: "50",
    },
    helpText: {
      cutoffMinutesBefore: "48h = 2880m · 24h = 1440m",
    },
    actions: {
      create: "Add rule",
    },
  },
  optionPriceRuleDialog: {
    titles: {
      create: "Add option price rule",
      edit: "Edit option price rule",
    },
    fields: {
      product: "Product",
      option: "Option",
      name: "Name",
      code: "Code",
      catalog: "Catalog",
      schedule: "Schedule (optional)",
      cancellationPolicy: "Cancellation policy (optional)",
      pricingMode: "Pricing mode",
      baseSell: "Base sell",
      baseCost: "Base cost",
      minPerBooking: "Min per booking",
      maxPerBooking: "Max per booking",
      description: "Description",
      allPricingCategories: "All pricing categories",
      defaultRule: "Default rule",
      active: "Active",
      notes: "Notes",
    },
    validation: {
      productRequired: "Product is required",
      optionRequired: "Option is required",
      catalogRequired: "Catalog is required",
      nameRequired: "Name is required",
    },
    actions: {
      create: "Create rule",
    },
  },
  locationPriceRuleDialog: {
    fields: {
      optionPriceRule: "Option price rule",
      optionId: "Option ID",
      facilityId: "Facility ID (optional)",
      pickupPointId: "Pickup point ID",
      dropoffName: "Dropoff name",
      dropoffCode: "Dropoff code (optional)",
      pricingMode: "Pricing mode",
      sellAmount: "Sell amount",
      costAmount: "Cost amount",
      sortOrder: "Sort order",
      active: "Active",
      notes: "Notes",
    },
    placeholders: {
      optionId: "popt_…",
      facilityId: "fac_…",
      pickupPointId: "ppnt_…",
    },
    validation: {
      optionPriceRuleRequired: "Option price rule is required",
      optionIdRequired: "Option ID is required",
      pickupPointIdRequired: "Pickup point is required",
      dropoffNameRequired: "Dropoff name is required",
    },
    actions: {
      createRule: "Add rule",
      saveRule: "Save Changes",
    },
    pickup: {
      titles: {
        create: "Add pickup price rule",
        edit: "Edit pickup price rule",
      },
    },
    dropoff: {
      titles: {
        create: "Add dropoff price rule",
        edit: "Edit dropoff price rule",
      },
    },
    extra: {
      titles: {
        create: "Add extra price rule",
        edit: "Edit extra price rule",
      },
      fields: {
        productExtraId: "Product extra ID (optional)",
        optionExtraConfigId: "Option extra config ID (optional)",
      },
      placeholders: {
        productExtraId: "pext_…",
        optionExtraConfigId: "oecf_…",
      },
    },
  },
  optionStartTimeRuleDialog: {
    titles: {
      create: "Add start time rule",
      edit: "Edit start time rule",
    },
    fields: {
      optionPriceRule: "Option price rule",
      optionId: "Option ID",
      startTimeId: "Start time ID",
      ruleMode: "Rule mode",
      adjustmentType: "Adjustment type",
      sellAdjustment: "Sell adjustment",
      costAdjustment: "Cost adjustment",
      adjustmentPercent: "Adjustment (%)",
      active: "Active",
      notes: "Notes",
    },
    placeholders: {
      optionId: "popt_…",
      startTimeId: "pst_…",
      select: "Select...",
    },
    validation: {
      optionPriceRuleRequired: "Option price rule is required",
      optionIdRequired: "Option ID is required",
      startTimeIdRequired: "Start time ID is required",
    },
    actions: {
      create: "Add rule",
    },
  },
  optionUnitPriceRuleDialog: {
    titles: {
      create: "Add option unit price rule",
      edit: "Edit option unit price rule",
    },
    fields: {
      optionPriceRule: "Option price rule",
      optionId: "Option ID",
      unitId: "Unit ID",
      pricingCategory: "Pricing category (optional)",
      pricingMode: "Pricing mode",
      sellAmount: "Sell amount",
      costAmount: "Cost amount",
      minQuantity: "Min quantity",
      maxQuantity: "Max quantity",
      sortOrder: "Sort order",
      active: "Active",
      notes: "Notes",
    },
    placeholders: {
      optionId: "popt_…",
      unitId: "punit_…",
      pricingCategory: "Search pricing categories...",
    },
    validation: {
      optionPriceRuleRequired: "Option price rule is required",
      optionIdRequired: "Option ID is required",
      unitIdRequired: "Unit ID is required",
    },
    actions: {
      create: "Add rule",
    },
  },
  optionUnitTierDialog: {
    titles: {
      create: "Add unit tier",
      edit: "Edit unit tier",
    },
    fields: {
      optionUnitPriceRuleId: "Option unit price rule ID",
      minQuantity: "Min quantity",
      maxQuantity: "Max quantity",
      sellAmount: "Sell amount",
      costAmount: "Cost amount",
      sortOrder: "Sort order",
      active: "Active",
    },
    placeholders: {
      optionUnitPriceRuleId: "oupr_…",
    },
    validation: {
      optionUnitPriceRuleIdRequired: "Option unit price rule is required",
      minQuantityMin: "Min quantity must be at least 1",
    },
    actions: {
      create: "Add tier",
    },
  },
} satisfies PricingUiMessages
