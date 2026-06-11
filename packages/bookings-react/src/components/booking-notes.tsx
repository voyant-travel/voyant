"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@voyantjs/ui/components"
import { Pencil, Plus, StickyNote, Trash2 } from "lucide-react"
import * as React from "react"
import {
  formatMessage,
  useBookingsUiI18nOrDefault,
  useBookingsUiMessagesOrDefault,
} from "../i18n/provider.js"
import { type BookingNoteRecord, useBookingNoteMutation, useBookingNotes } from "../index.js"
import { BookingNoteDialog } from "./booking-note-dialog.js"
import { IconActionButton } from "./icon-action-button.js"

export interface BookingNotesProps {
  bookingId: string
}

export function BookingNotes({ bookingId }: BookingNotesProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingNoteRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<BookingNoteRecord | null>(null)
  const { data } = useBookingNotes(bookingId)
  const mutation = useBookingNoteMutation(bookingId)
  const { formatDateTime } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const card = messages.bookingNotes

  const notes = (data?.data ?? []) as BookingNoteRecord[]

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await mutation.remove.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div data-slot="booking-notes" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          {card.title}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {card.addAction}
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-md border bg-background p-6 text-center">
          <p className="text-sm text-muted-foreground">{card.empty}</p>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              authorTemplate={card.authorLabel}
              editLabel={card.actions.edit}
              deleteLabel={card.actions.delete}
              formatDateTime={formatDateTime}
              onEdit={() => {
                setEditing(note)
                setDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget(note)}
            />
          ))}
        </div>
      )}

      <BookingNoteDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next)
          if (!next) setEditing(null)
        }}
        bookingId={bookingId}
        note={editing}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !mutation.remove.isPending) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{card.deleteConfirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{card.deleteConfirm.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.remove.isPending}>
              {card.deleteConfirm.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutation.remove.isPending}
              onClick={() => void handleConfirmDelete()}
            >
              {card.deleteConfirm.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function NoteCard({
  note,
  authorTemplate,
  editLabel,
  deleteLabel,
  formatDateTime,
  onEdit,
  onDelete,
}: {
  note: BookingNoteRecord
  authorTemplate: string
  editLabel: string
  deleteLabel: string
  formatDateTime: (value: string) => string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex flex-col gap-2 rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-pre-wrap text-sm">{note.content}</p>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <IconActionButton
            label={editLabel}
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={onEdit}
          />
          <IconActionButton
            label={deleteLabel}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={onDelete}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {formatMessage(authorTemplate, {
          actor: note.authorName || note.authorEmail || note.authorId,
        })}{" "}
        · {formatDateTime(note.createdAt)}
      </p>
    </div>
  )
}
