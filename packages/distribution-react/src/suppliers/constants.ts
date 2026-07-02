export const SUPPLIER_TYPES = [
  { value: "hotel", label: "Hotel" },
  { value: "transfer", label: "Transfer" },
  { value: "guide", label: "Guide" },
  { value: "experience", label: "Experience" },
  { value: "airline", label: "Airline" },
  { value: "restaurant", label: "Restaurant" },
  { value: "other", label: "Other" },
] as const

export const SUPPLIER_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
] as const

export const SERVICE_TYPES = [
  { value: "accommodation", label: "Accommodation" },
  { value: "transfer", label: "Transfer" },
  { value: "experience", label: "Experience" },
  { value: "guide", label: "Guide" },
  { value: "meal", label: "Meal" },
  { value: "other", label: "Other" },
] as const

export const RATE_UNITS = [
  { value: "per_person", label: "Per Person" },
  { value: "per_group", label: "Per Group" },
  { value: "per_night", label: "Per Night" },
  { value: "per_vehicle", label: "Per Vehicle" },
  { value: "flat", label: "Flat" },
] as const

export const CONTACT_POINT_KINDS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "mobile", label: "Mobile" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
  { value: "sms", label: "SMS" },
  { value: "fax", label: "Fax" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
] as const

export const NAMED_CONTACT_ROLES = [
  { value: "general", label: "General" },
  { value: "primary", label: "Primary" },
  { value: "reservations", label: "Reservations" },
  { value: "operations", label: "Operations" },
  { value: "front_desk", label: "Front desk" },
  { value: "sales", label: "Sales" },
  { value: "emergency", label: "Emergency" },
  { value: "accounting", label: "Accounting" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
] as const

export const ADDRESS_LABELS = [
  { value: "primary", label: "Primary" },
  { value: "billing", label: "Billing" },
  { value: "shipping", label: "Shipping" },
  { value: "mailing", label: "Mailing" },
  { value: "meeting", label: "Meeting" },
  { value: "service", label: "Service" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
] as const

export const SUPPLIER_CONTRACT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
  { value: "terminated", label: "Terminated" },
] as const

export const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  pending: "outline",
}
