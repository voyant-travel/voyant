import type { RegistryBookingsMessages } from "./messages"

export const registryBookingsEn: RegistryBookingsMessages = {
  travelerDialog: {
    titles: {
      create: "Add traveler",
      edit: "Edit traveler",
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
      addTraveler: "Add traveler",
    },
  },
  travelerList: {
    title: "Travelers",
    addTraveler: "Add traveler",
    empty: "No travelers yet.",
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
      deleteConfirm: "Delete this traveler?",
    },
  },
  bookingItemTravelers: {
    title: "Assigned travelers",
    empty: "No travelers assigned to this item.",
    selectTravelerPlaceholder: "Select traveler...",
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
      removeConfirm: "Remove this traveler from the item?",
    },
  },
}
