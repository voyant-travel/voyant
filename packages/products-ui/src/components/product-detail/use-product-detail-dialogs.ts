import { useState } from "react"

import type { AvailabilityRule, DepartureSlot } from "./product-detail-shared"

export interface Toggle {
  open: boolean
  setOpen: (open: boolean) => void
  openNow: () => void
  close: () => void
}

export interface EditingToggle<T> {
  open: boolean
  setOpen: (open: boolean) => void
  editing: T | undefined
  openNew: () => void
  openEdit: (item: T) => void
  close: () => void
}

export interface UseProductDetailDialogsResult {
  edit: Toggle
  bookingCreate: Toggle
  departure: EditingToggle<DepartureSlot>
  departureOverride: EditingToggle<DepartureSlot>
  schedule: EditingToggle<AvailabilityRule>
}

function useToggle(): Toggle {
  const [open, setOpen] = useState(false)
  return {
    open,
    setOpen,
    openNow: () => setOpen(true),
    close: () => setOpen(false),
  }
}

function useEditingToggle<T>(): EditingToggle<T> {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | undefined>()
  return {
    open,
    setOpen,
    editing,
    openNew: () => {
      setEditing(undefined)
      setOpen(true)
    },
    openEdit: (item: T) => {
      setEditing(item)
      setOpen(true)
    },
    close: () => {
      setOpen(false)
      setEditing(undefined)
    },
  }
}

export function useProductDetailDialogs(): UseProductDetailDialogsResult {
  return {
    edit: useToggle(),
    bookingCreate: useToggle(),
    departure: useEditingToggle<DepartureSlot>(),
    departureOverride: useEditingToggle<DepartureSlot>(),
    schedule: useEditingToggle<AvailabilityRule>(),
  }
}
