import { resourcesUiEn } from "./i18n/en.js"

export const NONE_VALUE = "__none__"

const labels = resourcesUiEn.common

export const resourceKindOptions = [
  { value: "guide", label: labels.resourceKindLabels.guide },
  { value: "vehicle", label: labels.resourceKindLabels.vehicle },
  { value: "room", label: labels.resourceKindLabels.room },
  { value: "boat", label: labels.resourceKindLabels.boat },
  { value: "equipment", label: labels.resourceKindLabels.equipment },
  { value: "other", label: labels.resourceKindLabels.other },
] as const

export const allocationModeOptions = [
  { value: "shared", label: labels.allocationModeLabels.shared },
  { value: "exclusive", label: labels.allocationModeLabels.exclusive },
] as const

export const assignmentStatusOptions = [
  { value: "reserved", label: labels.assignmentStatusLabels.reserved },
  { value: "assigned", label: labels.assignmentStatusLabels.assigned },
  { value: "released", label: labels.assignmentStatusLabels.released },
  { value: "cancelled", label: labels.assignmentStatusLabels.cancelled },
  { value: "completed", label: labels.assignmentStatusLabels.completed },
] as const
