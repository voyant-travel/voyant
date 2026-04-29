import type { RegistryBookingsMessages } from "./messages"

export const registryBookingsEn: RegistryBookingsMessages = {
  passengerDialog: {
    titles: {
      create: "Add passenger",
      edit: "Edit passenger",
    },
    fields: {
      firstName: "First name",
      lastName: "Last name",
      email: "Email",
      phone: "Phone",
      specialRequests: "Special requests",
    },
    placeholders: {
      firstName: "John",
      lastName: "Smith",
      email: "john@example.com",
      phone: "+44 7911 123456",
      specialRequests: "Any special requests...",
    },
    validation: {
      firstNameRequired: "First name is required",
      lastNameRequired: "Last name is required",
    },
    actions: {
      addPassenger: "Add passenger",
    },
  },
  passengerList: {
    title: "Passengers",
    addPassenger: "Add passenger",
    empty: "No passengers yet.",
    values: {
      emailUnavailable: "-",
      phoneUnavailable: "-",
    },
    columns: {
      name: "Name",
      email: "Email",
      phone: "Phone",
    },
    actions: {
      deleteConfirm: "Delete this passenger?",
    },
  },
  bookingItemParticipants: {
    title: "Assigned participants",
    empty: "No participants assigned to this item.",
    selectPassengerPlaceholder: "Select passenger...",
    primaryBadge: "Primary",
    roleLabels: {
      traveler: "Traveler",
      occupant: "Occupant",
      primary_contact: "Primary contact",
      service_assignee: "Service assignee",
      beneficiary: "Beneficiary",
      other: "Other",
    },
    actions: {
      assign: "Assign",
      removeConfirm: "Remove this participant from the item?",
    },
  },
}
