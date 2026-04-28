"use client"

import { useBookingNoteMutation } from "@voyantjs/bookings-react"
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
import { useAdminMessages } from "@/lib/admin-i18n"

export interface BookingNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  onSuccess?: () => void
}

export function BookingNoteDialog({
  open,
  onOpenChange,
  bookingId,
  onSuccess,
}: BookingNoteDialogProps) {
  const noteDialogMessages = useAdminMessages().bookings.detail.noteDialog
  const [content, setContent] = React.useState("")
  const { create } = useBookingNoteMutation(bookingId)

  React.useEffect(() => {
    if (!open) setContent("")
  }, [open])

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed) return
    await create.mutateAsync({ content: trimmed })
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{noteDialogMessages.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          <Label htmlFor="booking-note-content">{noteDialogMessages.noteLabel}</Label>
          <Textarea
            id="booking-note-content"
            autoFocus
            placeholder={noteDialogMessages.notePlaceholder}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[140px]"
          />
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            {noteDialogMessages.cancel}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || create.isPending}
          >
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {noteDialogMessages.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
