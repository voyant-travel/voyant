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
import type * as React from "react"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"

export function DialogActions({
  isSubmitting,
  isEditing,
  onCancel,
}: {
  isSubmitting: boolean
  isEditing: boolean
  onCancel: () => void
}) {
  const messages = useSuppliersUiMessagesOrDefault()

  return (
    <DialogFooter>
      <Button type="button" variant="ghost" onClick={onCancel}>
        {messages.common.cancel}
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isEditing ? messages.common.save : messages.common.create}
      </Button>
    </DialogFooter>
  )
}

export function SelectField({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) onValueChange(next)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function SwitchField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      <Label>{label}</Label>
    </div>
  )
}

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function nullableString(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
