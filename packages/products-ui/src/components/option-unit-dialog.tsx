"use client"

import type { OptionUnitRecord } from "@voyantjs/products-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/voyant-ui/components/dialog"

import { OptionUnitForm } from "./option-unit-form"

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="option-unit-dialog" className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit option unit" : "New option unit"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update unit constraints, quantity limits, and occupancy rules."
              : "Create a selectable unit under this option."}
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
