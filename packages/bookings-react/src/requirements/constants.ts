import { bookingRequirementsUiEn } from "./i18n/en.js"

const labels = bookingRequirementsUiEn.common

export const SELECT_TYPES = new Set(["single_select", "multi_select"])

export const QUESTION_TARGETS = [
  { value: "booking", label: labels.questionTargetLabels.booking },
  { value: "traveler", label: labels.questionTargetLabels.traveler },
  { value: "lead_traveler", label: labels.questionTargetLabels.lead_traveler },
  { value: "booker", label: labels.questionTargetLabels.booker },
  { value: "extra", label: labels.questionTargetLabels.extra },
  { value: "service", label: labels.questionTargetLabels.service },
] as const

export const QUESTION_FIELD_TYPES = [
  { value: "text", label: labels.questionFieldTypeLabels.text },
  { value: "textarea", label: labels.questionFieldTypeLabels.textarea },
  { value: "number", label: labels.questionFieldTypeLabels.number },
  { value: "email", label: labels.questionFieldTypeLabels.email },
  { value: "phone", label: labels.questionFieldTypeLabels.phone },
  { value: "date", label: labels.questionFieldTypeLabels.date },
  { value: "datetime", label: labels.questionFieldTypeLabels.datetime },
  { value: "boolean", label: labels.questionFieldTypeLabels.boolean },
  { value: "single_select", label: labels.questionFieldTypeLabels.single_select },
  { value: "multi_select", label: labels.questionFieldTypeLabels.multi_select },
  { value: "file", label: labels.questionFieldTypeLabels.file },
  { value: "country", label: labels.questionFieldTypeLabels.country },
  { value: "other", label: labels.questionFieldTypeLabels.other },
] as const

export const CONTACT_FIELDS = [
  { value: "first_name", label: labels.fieldKeyLabels.first_name },
  { value: "last_name", label: labels.fieldKeyLabels.last_name },
  { value: "email", label: labels.fieldKeyLabels.email },
  { value: "phone", label: labels.fieldKeyLabels.phone },
  { value: "date_of_birth", label: labels.fieldKeyLabels.date_of_birth },
  { value: "nationality", label: labels.fieldKeyLabels.nationality },
  { value: "passport_number", label: labels.fieldKeyLabels.passport_number },
  { value: "passport_expiry", label: labels.fieldKeyLabels.passport_expiry },
  { value: "dietary_requirements", label: labels.fieldKeyLabels.dietary_requirements },
  { value: "accessibility_needs", label: labels.fieldKeyLabels.accessibility_needs },
  { value: "special_requests", label: labels.fieldKeyLabels.special_requests },
  { value: "address", label: labels.fieldKeyLabels.address },
  { value: "other", label: labels.fieldKeyLabels.other },
] as const

export const CONTACT_SCOPES = [
  { value: "booking", label: labels.scopeLabels.booking },
  { value: "lead_traveler", label: labels.scopeLabels.lead_traveler },
  { value: "traveler", label: labels.scopeLabels.traveler },
  { value: "booker", label: labels.scopeLabels.booker },
] as const
