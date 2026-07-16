import { distributionUiEn } from "./i18n/en.js"

export const NONE_VALUE = "__none__"

const labels = distributionUiEn.common

export const channelKindOptions = [
  { value: "direct", label: labels.channelKindLabels.direct },
  { value: "affiliate", label: labels.channelKindLabels.affiliate },
  { value: "ota", label: labels.channelKindLabels.ota },
  { value: "reseller", label: labels.channelKindLabels.reseller },
  { value: "marketplace", label: labels.channelKindLabels.marketplace },
  { value: "api_partner", label: labels.channelKindLabels.api_partner },
  { value: "connect", label: labels.channelKindLabels.connect },
] as const

export const channelStatusOptions = [
  { value: "active", label: labels.channelStatusLabels.active },
  { value: "inactive", label: labels.channelStatusLabels.inactive },
  { value: "pending", label: labels.channelStatusLabels.pending },
  { value: "archived", label: labels.channelStatusLabels.archived },
] as const

export const contractStatusOptions = [
  { value: "draft", label: labels.contractStatusLabels.draft },
  { value: "active", label: labels.contractStatusLabels.active },
  { value: "expired", label: labels.contractStatusLabels.expired },
  { value: "terminated", label: labels.contractStatusLabels.terminated },
] as const

export const paymentOwnerOptions = [
  { value: "operator", label: labels.paymentOwnerLabels.operator },
  { value: "channel", label: labels.paymentOwnerLabels.channel },
  { value: "split", label: labels.paymentOwnerLabels.split },
] as const

export const cancellationOwnerOptions = [
  { value: "operator", label: labels.cancellationOwnerLabels.operator },
  { value: "channel", label: labels.cancellationOwnerLabels.channel },
  { value: "mixed", label: labels.cancellationOwnerLabels.mixed },
] as const

export const commissionScopeOptions = [
  { value: "booking", label: labels.commissionScopeLabels.booking },
  { value: "product", label: labels.commissionScopeLabels.product },
  { value: "rate", label: labels.commissionScopeLabels.rate },
  { value: "category", label: labels.commissionScopeLabels.category },
] as const

export const commissionTypeOptions = [
  { value: "fixed", label: labels.commissionTypeLabels.fixed },
  { value: "percentage", label: labels.commissionTypeLabels.percentage },
] as const

export const webhookStatusOptions = [
  { value: "pending", label: labels.webhookStatusLabels.pending },
  { value: "processed", label: labels.webhookStatusLabels.processed },
  { value: "failed", label: labels.webhookStatusLabels.failed },
  { value: "ignored", label: labels.webhookStatusLabels.ignored },
] as const
