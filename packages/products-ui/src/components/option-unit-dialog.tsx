"use client"

import type { OptionUnitRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components/dialog"

import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import { OptionUnitForm } from "./option-unit-form.js"

export interface OptionUnitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  optionId: string
  unit?: OptionUnitRecord
  sortOrder?: number
  onSuccess?: (unit: OptionUnitRecord) => void
}

export function OptionUnitDialog({
  open,
  onOpenChange,
  optionId,
  unit,
  sortOrder,
  onSuccess,
}: OptionUnitDialogProps) {
  const isEdit = Boolean(unit)
  const messages = useProductsUiMessagesOrDefault()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="option-unit-dialog" className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? messages.optionUnitDialog.titles.edit
              : messages.optionUnitDialog.titles.create}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? messages.optionUnitDialog.descriptions.edit
              : messages.optionUnitDialog.descriptions.create}
          </DialogDescription>
        </DialogHeader>
        <OptionUnitForm
          mode={unit ? { kind: "edit", unit } : { kind: "create", optionId, sortOrder }}
          onSuccess={(saved) => {
            onSuccess?.(saved)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
