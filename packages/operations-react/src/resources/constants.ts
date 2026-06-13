export const NONE_VALUE = "__none__"

export const resourceKindOptions = [
  { value: "guide", label: "Guide" },
  { value: "vehicle", label: "Vehicle" },
  { value: "room", label: "Room" },
  { value: "boat", label: "Boat" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
] as const

export const allocationModeOptions = [
  { value: "shared", label: "Shared" },
  { value: "exclusive", label: "Exclusive" },
] as const

export const assignmentStatusOptions = [
  { value: "reserved", label: "Reserved" },
  { value: "assigned", label: "Assigned" },
  { value: "released", label: "Released" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
] as const
