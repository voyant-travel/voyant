export const SELECT_TYPES = new Set(["single_select", "multi_select"])

export const QUESTION_TARGETS = [
  { value: "booking", label: "Booking" },
  { value: "traveler", label: "Traveler" },
  { value: "lead_traveler", label: "Lead traveler" },
  { value: "booker", label: "Booker" },
  { value: "extra", label: "Extra" },
  { value: "service", label: "Service" },
] as const

export const QUESTION_FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & time" },
  { value: "boolean", label: "Yes / no" },
  { value: "single_select", label: "Single select" },
  { value: "multi_select", label: "Multi select" },
  { value: "file", label: "File upload" },
  { value: "country", label: "Country" },
  { value: "other", label: "Other" },
] as const

export const CONTACT_FIELDS = [
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "date_of_birth", label: "Date of birth" },
  { value: "nationality", label: "Nationality" },
  { value: "passport_number", label: "Passport number" },
  { value: "passport_expiry", label: "Passport expiry" },
  { value: "dietary_requirements", label: "Dietary requirements" },
  { value: "accessibility_needs", label: "Accessibility needs" },
  { value: "special_requests", label: "Special requests" },
  { value: "address", label: "Address" },
  { value: "other", label: "Other" },
] as const

export const CONTACT_SCOPES = [
  { value: "booking", label: "Booking" },
  { value: "lead_traveler", label: "Lead traveler" },
  { value: "traveler", label: "Traveler" },
  { value: "booker", label: "Booker" },
] as const
