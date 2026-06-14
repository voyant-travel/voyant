export interface CustomerPortalContactExistsFilters {
  email: string
}

export interface CustomerPortalPhoneContactExistsFilters {
  phone: string
}

export const customerPortalQueryKeys = {
  all: ["customer-portal"] as const,
  profile: () => [...customerPortalQueryKeys.all, "profile"] as const,
  profileDocuments: () => [...customerPortalQueryKeys.profile(), "documents"] as const,
  companions: () => [...customerPortalQueryKeys.all, "companions"] as const,
  bookings: () => [...customerPortalQueryKeys.all, "bookings"] as const,
  booking: (bookingId: string) => [...customerPortalQueryKeys.bookings(), bookingId] as const,
  bookingBillingContact: (bookingId: string) =>
    [...customerPortalQueryKeys.booking(bookingId), "billing-contact"] as const,
  bookingDocuments: (bookingId: string) =>
    [...customerPortalQueryKeys.booking(bookingId), "documents"] as const,
  contactExists: () => [...customerPortalQueryKeys.all, "contact-exists"] as const,
  contactExistsLookup: (filters: CustomerPortalContactExistsFilters) =>
    [...customerPortalQueryKeys.contactExists(), filters] as const,
  phoneContactExists: () => [...customerPortalQueryKeys.all, "phone-contact-exists"] as const,
  phoneContactExistsLookup: (filters: CustomerPortalPhoneContactExistsFilters) =>
    [...customerPortalQueryKeys.phoneContactExists(), filters] as const,
}
