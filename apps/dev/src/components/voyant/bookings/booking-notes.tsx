"use client"

import { useBookingNoteMutation, useBookingNotes } from "@voyantjs/bookings-react"
import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import * as React from "react"

export interface BookingNotesProps {
  bookingId: string
}

export function BookingNotes({ bookingId }: BookingNotesProps) {
  const [content, setContent] = React.useState("")
  const { data } = useBookingNotes(bookingId)
  const mutation = useBookingNoteMutation(bookingId)

  const notes = data?.data ?? []

  return (
    <Card data-slot="booking-notes">
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a note..."
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
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>

        {notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-md border p-3">
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
