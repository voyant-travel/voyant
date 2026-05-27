"use client"

import { type BookingNoteRecord, useBookingNoteMutation } from "@voyantjs/bookings-react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

export interface BookingNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  /** When set, the dialog opens in edit mode against this note. */
  note?: BookingNoteRecord | null
  onSuccess?: () => void
}

/**
 * Add / edit a booking note. Mirrors the supplier-status / traveler
 * dialog pattern so the activity tab is consistent with the rest of
 * the booking-detail surface.
 */
export function BookingNoteDialog({
  open,
  onOpenChange,
  bookingId,
  note,
  onSuccess,
}: BookingNoteDialogProps) {
  const [content, setContent] = React.useState("")
  const messages = useBookingsUiMessagesOrDefault()
  const dialog = messages.bookingNotes.dialog
  const mutation = useBookingNoteMutation(bookingId)
  const isEditing = Boolean(note)

  React.useEffect(() => {
    if (open) setContent(note?.content ?? "")
  }, [note, open])

  const submit = async () => {
    const trimmed = content.trim()
    if (!trimmed) return
    if (note) {
      await mutation.update.mutateAsync({ id: note.id, content: trimmed })
    } else {
      await mutation.create.mutateAsync({ content: trimmed })
    }
    onOpenChange(false)
    onSuccess?.()
  }

  const pending = isEditing ? mutation.update.isPending : mutation.create.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? dialog.editTitle : dialog.createTitle}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-2">
            <Label htmlFor="booking-note-content">{dialog.contentLabel}</Label>
            <Textarea
              id="booking-note-content"
              placeholder={dialog.contentPlaceholder}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px]"
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {dialog.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={!content.trim() || pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? dialog.save : dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
