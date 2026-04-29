import type { RegistryBookingRequirementsMessages } from "./messages"

export const registryBookingRequirementsRo = {
  common: {
    cancel: "Anuleaza",
    saveChanges: "Salveaza modificarile",
    active: "Activ",
    default: "Implicit",
  },
  page: {
    title: "Cerinte rezervare",
    fields: {
      product: "Produs",
    },
    placeholders: {
      product: "Selecteaza un produs...",
    },
    empty: {
      noProducts: "Nu exista produse",
      noProductSelected:
        "Selecteaza mai sus un produs pentru a gestiona cerintele de contact si intrebarile personalizate de rezervare.",
    },
    help: {
      product: "Alege un produs pentru a configura colectarea datelor calatorilor.",
    },
    tabs: {
      contactRequirements: "Cerinte contact",
      questions: "Intrebari",
    },
  },
  contactRequirementDialog: {
    titles: {
      create: "Adauga cerinta",
      edit: "Editeaza cerinta",
    },
    fields: {
      field: "Camp",
      scope: "Scop",
      required: "Obligatoriu",
      perTraveler: "Per calator",
      sortOrder: "Ordine",
      active: "Activ",
      notes: "Note",
    },
    actions: {
      create: "Adauga cerinta",
    },
  },
  bookingQuestionDialog: {
    titles: {
      create: "Adauga intrebare",
      edit: "Editeaza intrebarea",
    },
    fields: {
      label: "Eticheta",
      code: "Cod",
      description: "Descriere",
      target: "Tinta",
      fieldType: "Tip camp",
      placeholder: "Placeholder",
      helpText: "Text ajutator",
      required: "Obligatoriu",
      active: "Activ",
      sortOrder: "Ordine",
    },
    placeholders: {
      label: "Ce restrictii alimentare aveti?",
      code: "dietary",
      description: "Nota interna pentru echipa operationala...",
      placeholder: "Placeholder optional",
      helpText: "Afisat sub camp",
    },
    validation: {
      labelRequired: "Eticheta este obligatorie",
    },
    actions: {
      create: "Adauga intrebare",
    },
  },
  questionOptionDialog: {
    titles: {
      create: "Adauga optiune",
      edit: "Editeaza optiunea",
    },
    fields: {
      value: "Valoare",
      label: "Eticheta",
      sortOrder: "Ordine",
      isDefault: "Implicita",
      active: "Activa",
    },
    placeholders: {
      value: "vegetarian",
      label: "Vegetarian",
    },
    validation: {
      valueRequired: "Valoarea este obligatorie",
      labelRequired: "Eticheta este obligatorie",
    },
    actions: {
      create: "Adauga optiune",
    },
  },
} satisfies RegistryBookingRequirementsMessages
