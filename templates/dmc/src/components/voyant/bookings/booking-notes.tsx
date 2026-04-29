"use client"

import { useLocale } from "@voyantjs/admin"
import { useBookingNoteMutation, useBookingNotes } from "@voyantjs/bookings-react"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Loader2, Plus, StickyNote, Trash2 } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

import { BookingNoteDialog } from "./booking-note-dialog"

export interface BookingNotesProps {
  bookingId: string
}

export function BookingNotes({ bookingId }: BookingNotesProps) {
  const noteMessages = useAdminMessages().bookings.detail.notes
  const { resolvedLocale } = useLocale()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const { data } = useBookingNotes(bookingId)
  const { remove } = useBookingNoteMutation(bookingId)

  const notes = data?.data ?? []

  return (
    <Card data-slot="booking-notes">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          {noteMessages.title}
        </CardTitle>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {noteMessages.addAction}
        </Button>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{noteMessages.empty}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {notes.map((note) => {
              const isDeleting = remove.isPending && remove.variables === note.id
              return (
                <div key={note.id} className="group relative rounded-md border p-3 pr-11">
                  <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(note.createdAt).toLocaleString(resolvedLocale)}
                  </p>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2 h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    disabled={isDeleting}
                    onClick={() => {
                      if (confirm(noteMessages.deleteConfirm)) {
                        remove.mutate(note.id)
                      }
                    }}
                    aria-label={noteMessages.deleteAriaLabel}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <BookingNoteDialog open={dialogOpen} onOpenChange={setDialogOpen} bookingId={bookingId} />
    </Card>
  )
}
