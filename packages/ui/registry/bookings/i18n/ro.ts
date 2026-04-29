import type { RegistryBookingsMessages } from "./messages"

export const registryBookingsRo: RegistryBookingsMessages = {
  passengerDialog: {
    titles: {
      create: "Adauga pasager",
      edit: "Editeaza pasagerul",
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
      addPassenger: "Adauga pasager",
    },
  },
  passengerList: {
    title: "Pasageri",
    addPassenger: "Adauga pasager",
    empty: "Nu exista pasageri inca.",
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
      deleteConfirm: "Stergi acest pasager?",
    },
  },
  bookingItemParticipants: {
    title: "Participanti alocati",
    empty: "Nu exista participanti alocati acestui articol.",
    selectPassengerPlaceholder: "Selecteaza pasagerul...",
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
      removeConfirm: "Elimini acest participant din articol?",
    },
  },
}
