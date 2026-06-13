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

export const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  pending: "outline",
}
