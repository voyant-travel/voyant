export type RegistryBookingParticipantRole =
  | "traveler"
  | "occupant"
  | "primary_contact"
  | "service_assignee"
  | "beneficiary"
  | "other"

export type RegistryBookingsMessages = {
  travelerDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      firstName: string
      lastName: string
      email: string
      phone: string
      specialRequests: string
    }
    placeholders: {
      firstName: string
      lastName: string
      email: string
      phone: string
      specialRequests: string
    }
    validation: {
      firstNameRequired: string
      lastNameRequired: string
    }
    actions: {
      addTraveler: string
    }
  }
  travelerList: {
    title: string
    addTraveler: string
    empty: string
    values: {
      emailUnavailable: string
      phoneUnavailable: string
    }
    columns: {
      name: string
      email: string
      phone: string
    }
    actions: {
      deleteConfirm: string
    }
  }
  bookingItemTravelers: {
    title: string
    empty: string
    selectTravelerPlaceholder: string
    primaryBadge: string
    roleLabels: Record<RegistryBookingParticipantRole, string>
    actions: {
      assign: string
      removeConfirm: string
    }
  }
}
