export type RegistryBookingRequirementsMessages = {
  common: {
    cancel: string
    saveChanges: string
    active: string
    default: string
  }
  page: {
    title: string
    fields: {
      product: string
    }
    placeholders: {
      product: string
    }
    empty: {
      noProducts: string
      noProductSelected: string
    }
    help: {
      product: string
    }
    tabs: {
      contactRequirements: string
      questions: string
    }
  }
  contactRequirementDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      field: string
      scope: string
      required: string
      perTraveler: string
      sortOrder: string
      active: string
      notes: string
    }
    actions: {
      create: string
    }
  }
  bookingQuestionDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      label: string
      code: string
      description: string
      target: string
      fieldType: string
      placeholder: string
      helpText: string
      required: string
      active: string
      sortOrder: string
    }
    placeholders: {
      label: string
      code: string
      description: string
      placeholder: string
      helpText: string
    }
    validation: {
      labelRequired: string
    }
    actions: {
      create: string
    }
  }
  questionOptionDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      value: string
      label: string
      sortOrder: string
      isDefault: string
      active: string
    }
    placeholders: {
      value: string
      label: string
    }
    validation: {
      valueRequired: string
      labelRequired: string
    }
    actions: {
      create: string
    }
  }
}
