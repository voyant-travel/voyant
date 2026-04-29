import type { RegistryBookingRequirementsMessages } from "./messages"

export const registryBookingRequirementsEn = {
  common: {
    cancel: "Cancel",
    saveChanges: "Save Changes",
    active: "Active",
    default: "Default",
  },
  page: {
    title: "Booking Requirements",
    fields: {
      product: "Product",
    },
    placeholders: {
      product: "Select a product...",
    },
    empty: {
      noProducts: "No products",
      noProductSelected:
        "Select a product above to manage its contact requirements and custom booking questions.",
    },
    help: {
      product: "Pick a product to configure traveler data collection.",
    },
    tabs: {
      contactRequirements: "Contact Requirements",
      questions: "Questions",
    },
  },
  contactRequirementDialog: {
    titles: {
      create: "Add Requirement",
      edit: "Edit Requirement",
    },
    fields: {
      field: "Field",
      scope: "Scope",
      required: "Required",
      perTraveler: "Per traveler",
      sortOrder: "Sort order",
      active: "Active",
      notes: "Notes",
    },
    actions: {
      create: "Add Requirement",
    },
  },
  bookingQuestionDialog: {
    titles: {
      create: "Add Question",
      edit: "Edit Question",
    },
    fields: {
      label: "Label",
      code: "Code",
      description: "Description",
      target: "Target",
      fieldType: "Field type",
      placeholder: "Placeholder",
      helpText: "Help text",
      required: "Required",
      active: "Active",
      sortOrder: "Sort order",
    },
    placeholders: {
      label: "What dietary restrictions do you have?",
      code: "dietary",
      description: "Internal note for the operations team...",
      placeholder: "Optional placeholder",
      helpText: "Shown below the field",
    },
    validation: {
      labelRequired: "Label is required",
    },
    actions: {
      create: "Add Question",
    },
  },
  questionOptionDialog: {
    titles: {
      create: "Add Choice",
      edit: "Edit Choice",
    },
    fields: {
      value: "Value",
      label: "Label",
      sortOrder: "Sort order",
      isDefault: "Default",
      active: "Active",
    },
    placeholders: {
      value: "vegetarian",
      label: "Vegetarian",
    },
    validation: {
      valueRequired: "Value is required",
      labelRequired: "Label is required",
    },
    actions: {
      create: "Add Choice",
    },
  },
} satisfies RegistryBookingRequirementsMessages
