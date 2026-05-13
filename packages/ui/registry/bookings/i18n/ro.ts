import type { RegistryBookingsMessages } from "./messages"

export const registryBookingsRo: RegistryBookingsMessages = {
  travelerDialog: {
    titles: {
      create: "Adauga calator",
      edit: "Editeaza calatorul",
    },
    fields: {
      firstName: "Prenume",
      lastName: "Nume",
      email: "Email",
      phone: "Telefon",
      specialRequests: "Cerinte speciale",
    },
    placeholders: {
      firstName: "Ion",
      lastName: "Popescu",
      email: "ion@example.com",
      phone: "+40 721 123 456",
      specialRequests: "Cerinte speciale...",
    },
    validation: {
      firstNameRequired: "Prenumele este obligatoriu",
      lastNameRequired: "Numele este obligatoriu",
    },
    actions: {
      addTraveler: "Adauga calator",
    },
  },
  travelerList: {
    title: "Calatori",
    addTraveler: "Adauga calator",
    empty: "Nu exista calatori inca.",
    values: {
      emailUnavailable: "-",
      phoneUnavailable: "-",
    },
    columns: {
      name: "Nume",
      email: "Email",
      phone: "Telefon",
    },
    actions: {
      deleteConfirm: "Stergi acest calator?",
    },
  },
  bookingItemTravelers: {
    title: "Calatori alocati",
    empty: "Nu exista calatori alocati acestui articol.",
    selectTravelerPlaceholder: "Selecteaza calatorul...",
    primaryBadge: "Principal",
    roleLabels: {
      traveler: "Calator",
      occupant: "Ocupant",
      primary_contact: "Contact principal",
      service_assignee: "Responsabil serviciu",
      beneficiary: "Beneficiar",
      other: "Altul",
    },
    actions: {
      assign: "Aloca",
      removeConfirm: "Elimini acest calator din articol?",
    },
  },
}
