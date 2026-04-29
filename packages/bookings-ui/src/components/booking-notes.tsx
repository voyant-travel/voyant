"use client"

import { useBookingNoteMutation, useBookingNotes } from "@voyantjs/bookings-react"
import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider"

export interface BookingNotesProps {
  bookingId: string
}

export function BookingNotes({ bookingId }: BookingNotesProps) {
  const [content, setContent] = React.useState("")
  const { data } = useBookingNotes(bookingId)
  const mutation = useBookingNoteMutation(bookingId)
  const { formatDateTime } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const notes = data?.data ?? []

  return (
    <Card data-slot="booking-notes">
      <CardHeader>
        <CardTitle>{messages.bookingNotes.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Textarea
            placeholder={messages.bookingNotes.placeholder}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[80px]"
          />
          <Button
            className="self-end"
            disabled={!content.trim() || mutation.isPending}
            onClick={async () => {
              await mutation.mutateAsync({ content: content.trim() })
              setContent("")
            }}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              messages.bookingNotes.add
            )}
          </Button>
        </div>

        {notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.bookingNotes.empty}
          </p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-md border p-3">
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
