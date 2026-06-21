"use client"

import {
  Button,
  DialogFooter,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import type { AvailabilitySlotRow, ProductOption } from "../../index.js"

interface RuleDialogMessages {
  validationProductRequired: string
  validationTimezoneRequired: string
  validationRecurrenceRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  timezoneLabel: string
  timezonePlaceholder: string
  maxCapacityLabel: string
  recurrenceRuleLabel: string
  recurrenceRulePlaceholder: string
  maxPickupCapacityLabel: string
  minimumTotalPaxLabel: string
  cutoffMinutesLabel: string
  earlyBookingLimitMinutesLabel: string
  activeTitle: string
  activeDescription: string
  cancel: string
  save: string
  create: string
}

interface StartTimeDialogMessages {
  validationProductRequired: string
  validationStartTimeRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  labelLabel: string
  labelPlaceholder: string
  startTimeLabel: string
  durationMinutesLabel: string
  sortOrderLabel: string
  activeTitle: string
  activeDescription: string
  cancel: string
  save: string
  create: string
}

interface SlotDialogMessages {
  validationProductRequired: string
  validationDateRequired: string
  validationStartsAtRequired: string
  validationTimezoneRequired: string
  validationOptionRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  optionLabel: string
  selectOptionPlaceholder: string
  noOption: string
  defaultOptionSuffix: string
  ruleLabel: string
  optionalRulePlaceholder: string
  noRule: string
  startTimeLabel: string
  optionalStartTimePlaceholder: string
  noStartTime: string
  dateLabel: string
  timezoneLabel: string
  timezonePlaceholder: string
  startsAtLabel: string
  endsAtLabel: string
  statusLabel: string
  unlimitedLabel: string
  yes: string
  no: string
  initialPaxLabel: string
  remainingPaxLabel: string
  remainingResourcesLabel: string
  initialPickupsLabel: string
  remainingPickupsLabel: string
  pastCutoffTitle: string
  pastCutoffDescription: string
  tooEarlyTitle: string
  tooEarlyDescription: string
  notesLabel: string
  notesPlaceholder: string
  cancel: string
  save: string
  create: string
}

interface CloseoutDialogMessages {
  validationProductRequired: string
  validationDateRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  slotLabel: string
  optionalSlotPlaceholder: string
  productLevelOption: string
  dateLabel: string
  datePlaceholder: string
  reasonLabel: string
  reasonPlaceholder: string
  cancel: string
  save: string
  create: string
}

interface PickupPointDialogMessages {
  validationProductRequired: string
  validationNameRequired: string
  editTitle: string
  newTitle: string
  productLabel: string
  selectProductPlaceholder: string
  nameLabel: string
  namePlaceholder: string
  locationTextLabel: string
  locationTextPlaceholder: string
  descriptionLabel: string
  descriptionPlaceholder: string
  activeTitle: string
  activeDescription: string
  cancel: string
  save: string
  create: string
}

export interface AvailabilityDialogMessages {
  dialogs: {
    rule: RuleDialogMessages
    startTime: StartTimeDialogMessages
    slot: SlotDialogMessages
    closeout: CloseoutDialogMessages
    pickupPoint: PickupPointDialogMessages
  }
  statusOpen: string
  statusClosed: string
  statusSoldOut: string
  statusCancelled: string
}

export type SubmitContext = {
  isEditing: boolean
  id?: string
}

export type AvailabilityRuleSubmitPayload = {
  productId: string
  timezone: string
  recurrenceRule: string
  maxCapacity: number
  maxPickupCapacity: number | null
  minTotalPax: number | null
  cutoffMinutes: number | null
  earlyBookingLimitMinutes: number | null
  active: boolean
}

export type AvailabilityStartTimeSubmitPayload = {
  productId: string
  label: string | null
  startTimeLocal: string
  durationMinutes: number | null
  sortOrder: number
  active: boolean
}

export type AvailabilitySlotSubmitPayload = {
  productId: string
  optionId: string | null
  availabilityRuleId: string | null
  startTimeId: string | null
  dateLocal: string
  startsAt: string
  endsAt: string | null
  timezone: string
  status: AvailabilitySlotRow["status"]
  unlimited: boolean
  initialPax: number | null
  remainingPax: number | null
  initialPickups: number | null
  remainingPickups: number | null
  remainingResources: number | null
  pastCutoff: boolean
  tooEarly: boolean
  notes: string | null
}

export type AvailabilityCloseoutSubmitPayload = {
  productId: string
  slotId: string | null
  dateLocal: string
  reason: string | null
}

export type AvailabilityPickupPointSubmitPayload = {
  productId: string
  name: string
  description: string | null
  locationText: string | null
  active: boolean
}

export function formatSlotLocalDateTime(value: { date: string; time: string }) {
  return `${value.date} ${value.time}`
}

export function ProductSelect({
  label,
  placeholder,
  products,
  value,
  onValueChange,
}: {
  label: string
  placeholder: string
  products: ProductOption[]
  value: string
  onValueChange: (value: string | null) => void
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select
        items={products.map((product) => ({ label: product.name, value: product.id }))}
        value={value}
        onValueChange={onValueChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {products.map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function SwitchField({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function DialogActions({
  cancel,
  save,
  create,
  isEditing,
  isSubmitting,
  onCancel,
}: {
  cancel: string
  save: string
  create: string
  isEditing: boolean
  isSubmitting: boolean
  onCancel: () => void
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {cancel}
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEditing ? save : create}
      </Button>
    </DialogFooter>
  )
}
