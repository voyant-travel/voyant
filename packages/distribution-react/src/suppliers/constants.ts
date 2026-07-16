import { suppliersUiEn } from "./i18n/en.js"

const labels = suppliersUiEn.common

export const SUPPLIER_TYPES = [
  { value: "hotel", label: labels.supplierTypeLabels.hotel },
  { value: "transfer", label: labels.supplierTypeLabels.transfer },
  { value: "guide", label: labels.supplierTypeLabels.guide },
  { value: "experience", label: labels.supplierTypeLabels.experience },
  { value: "airline", label: labels.supplierTypeLabels.airline },
  { value: "restaurant", label: labels.supplierTypeLabels.restaurant },
  { value: "other", label: labels.supplierTypeLabels.other },
] as const

export const SUPPLIER_STATUSES = [
  { value: "active", label: labels.supplierStatusLabels.active },
  { value: "inactive", label: labels.supplierStatusLabels.inactive },
  { value: "pending", label: labels.supplierStatusLabels.pending },
] as const

export const SERVICE_TYPES = [
  { value: "accommodation", label: labels.serviceTypeLabels.accommodation },
  { value: "transfer", label: labels.serviceTypeLabels.transfer },
  { value: "experience", label: labels.serviceTypeLabels.experience },
  { value: "guide", label: labels.serviceTypeLabels.guide },
  { value: "meal", label: labels.serviceTypeLabels.meal },
  { value: "other", label: labels.serviceTypeLabels.other },
] as const

export const RATE_UNITS = [
  { value: "per_person", label: labels.rateUnitLabels.per_person },
  { value: "per_group", label: labels.rateUnitLabels.per_group },
  { value: "per_night", label: labels.rateUnitLabels.per_night },
  { value: "per_vehicle", label: labels.rateUnitLabels.per_vehicle },
  { value: "flat", label: labels.rateUnitLabels.flat },
] as const

export const CONTACT_POINT_KINDS = [
  { value: "email", label: labels.contactPointKindLabels.email },
  { value: "phone", label: labels.contactPointKindLabels.phone },
  { value: "mobile", label: labels.contactPointKindLabels.mobile },
  { value: "whatsapp", label: labels.contactPointKindLabels.whatsapp },
  { value: "website", label: labels.contactPointKindLabels.website },
  { value: "sms", label: labels.contactPointKindLabels.sms },
  { value: "fax", label: labels.contactPointKindLabels.fax },
  { value: "social", label: labels.contactPointKindLabels.social },
  { value: "other", label: labels.contactPointKindLabels.other },
] as const

export const NAMED_CONTACT_ROLES = [
  { value: "general", label: labels.namedContactRoleLabels.general },
  { value: "primary", label: labels.namedContactRoleLabels.primary },
  { value: "reservations", label: labels.namedContactRoleLabels.reservations },
  { value: "operations", label: labels.namedContactRoleLabels.operations },
  { value: "front_desk", label: labels.namedContactRoleLabels.front_desk },
  { value: "sales", label: labels.namedContactRoleLabels.sales },
  { value: "emergency", label: labels.namedContactRoleLabels.emergency },
  { value: "accounting", label: labels.namedContactRoleLabels.accounting },
  { value: "legal", label: labels.namedContactRoleLabels.legal },
  { value: "other", label: labels.namedContactRoleLabels.other },
] as const

export const ADDRESS_LABELS = [
  { value: "primary", label: labels.addressLabelLabels.primary },
  { value: "billing", label: labels.addressLabelLabels.billing },
  { value: "shipping", label: labels.addressLabelLabels.shipping },
  { value: "mailing", label: labels.addressLabelLabels.mailing },
  { value: "meeting", label: labels.addressLabelLabels.meeting },
  { value: "service", label: labels.addressLabelLabels.service },
  { value: "legal", label: labels.addressLabelLabels.legal },
  { value: "other", label: labels.addressLabelLabels.other },
] as const

export const SUPPLIER_CONTRACT_STATUSES = [
  { value: "active", label: labels.contractStatusLabels.active },
  { value: "expired", label: labels.contractStatusLabels.expired },
  { value: "pending", label: labels.contractStatusLabels.pending },
  { value: "terminated", label: labels.contractStatusLabels.terminated },
] as const

export const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  pending: "outline",
}
