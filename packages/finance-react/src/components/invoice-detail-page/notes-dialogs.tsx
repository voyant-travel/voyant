"use client"

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2, Plus } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useFinanceUiMessagesOrDefault } from "../../i18n/index.js"
import type { FinanceNoteRecord, InvoiceAttachmentRecord } from "../../index.js"
import { useInvoiceAttachmentMutation } from "../../index.js"
import { EmptyRow, InvoiceSection, LoadingRow } from "./primitives.js"

export interface InvoiceNotesCardProps {
  notes: FinanceNoteRecord[]
  noteContent?: string
  pending?: boolean
  addPending?: boolean
  className?: string
  onNoteChange?: (value: string) => void
  onAddNote?: () => Promise<void>
  onCreate?: () => void
}

export function InvoiceNotesCard({
  notes,
  noteContent,
  pending,
  addPending,
  className,
  onNoteChange,
  onAddNote,
  onCreate,
}: InvoiceNotesCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const controlledNoteContent = noteContent ?? ""

  return (
    <InvoiceSection
      dataSlot="invoice-notes-card"
      title={detail.titles.notes}
      className={className}
      action={
        onCreate ? (
          <Button size="sm" onClick={onCreate} disabled={addPending}>
            {addPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            <Plus className="size-4" aria-hidden="true" />
            {detail.actions.addNote}
          </Button>
        ) : null
      }
    >
      {pending ? (
        <LoadingRow />
      ) : notes.length === 0 ? (
        <EmptyRow>{detail.states.noNotes}</EmptyRow>
      ) : (
        <ul className="divide-y">
          {notes.map((note) => (
            <li key={note.id} className="py-3">
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note.createdAt}</p>
            </li>
          ))}
        </ul>
      )}
      {!onCreate && onNoteChange && onAddNote ? (
        <div className="mt-4 flex flex-col gap-2">
          <Textarea
            value={controlledNoteContent}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={detail.placeholders.note}
            rows={3}
          />
          <Button
            type="button"
            className="self-end"
            disabled={addPending || controlledNoteContent.trim().length === 0}
            onClick={() => void onAddNote()}
          >
            {addPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {detail.actions.addNote}
          </Button>
        </div>
      ) : null}
    </InvoiceSection>
  )
}

function createInvoiceNoteFormSchema(messages: ReturnType<typeof useFinanceUiMessagesOrDefault>) {
  return z.object({
    content: z.string().trim().min(1, messages.invoiceDetailPage.noteDialog.contentRequired),
  })
}

type InvoiceNoteFormSchema = ReturnType<typeof createInvoiceNoteFormSchema>
type InvoiceNoteFormValues = z.input<InvoiceNoteFormSchema>
type InvoiceNoteFormOutput = z.output<InvoiceNoteFormSchema>

export interface InvoiceNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending?: boolean
  onSubmit: (content: string) => Promise<void>
}

export function InvoiceNoteDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: InvoiceNoteDialogProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const noteFormSchema = createInvoiceNoteFormSchema(messages)

  const form = useForm<InvoiceNoteFormValues, unknown, InvoiceNoteFormOutput>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      content: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({ content: "" })
    }
  }, [form, open])

  const handleSubmit = async (values: InvoiceNoteFormOutput) => {
    await onSubmit(values.content)
    form.reset({ content: "" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{detail.noteDialog.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{detail.fields.notes}</Label>
              <Textarea
                {...form.register("content")}
                placeholder={detail.placeholders.note}
                rows={4}
              />
              {form.formState.errors.content ? (
                <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={pending || form.formState.isSubmitting}>
              {pending || form.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {detail.noteDialog.createAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function createInvoiceAttachmentFormSchema(
  messages: ReturnType<typeof useFinanceUiMessagesOrDefault>,
) {
  return z.object({
    name: z.string().min(1, messages.invoiceDetailPage.attachmentDialog.nameRequired),
    kind: z.string().min(1).optional(),
    mimeType: z.string().optional(),
    fileSize: z.coerce.number().int().min(0).optional(),
    storageKey: z.string().optional(),
    checksum: z.string().optional(),
  })
}

type InvoiceAttachmentFormSchema = ReturnType<typeof createInvoiceAttachmentFormSchema>
type InvoiceAttachmentFormValues = z.input<InvoiceAttachmentFormSchema>
type InvoiceAttachmentFormOutput = z.output<InvoiceAttachmentFormSchema>

export interface InvoiceAttachmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  attachment?: InvoiceAttachmentRecord
  onSuccess: () => void
}

export function InvoiceAttachmentDialog({
  open,
  onOpenChange,
  invoiceId,
  attachment,
  onSuccess,
}: InvoiceAttachmentDialogProps) {
  const isEditing = Boolean(attachment)
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const attachmentFormSchema = createInvoiceAttachmentFormSchema(messages)
  const { create, update } = useInvoiceAttachmentMutation(invoiceId)

  const form = useForm<InvoiceAttachmentFormValues, unknown, InvoiceAttachmentFormOutput>({
    resolver: zodResolver(attachmentFormSchema),
    defaultValues: {
      name: "",
      kind: "supporting_document",
      mimeType: "",
      fileSize: undefined,
      storageKey: "",
      checksum: "",
    },
  })

  useEffect(() => {
    if (open && attachment) {
      form.reset({
        name: attachment.name,
        kind: attachment.kind,
        mimeType: attachment.mimeType ?? "",
        fileSize: attachment.fileSize ?? undefined,
        storageKey: attachment.storageKey ?? "",
        checksum: attachment.checksum ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, attachment, form])

  const onSubmit = async (values: InvoiceAttachmentFormOutput) => {
    const payload = {
      name: values.name,
      kind: values.kind || "supporting_document",
      mimeType: values.mimeType || undefined,
      fileSize: values.fileSize || undefined,
      storageKey: values.storageKey || undefined,
      checksum: values.checksum || undefined,
    }

    if (isEditing && attachment) {
      await update.mutateAsync({ id: attachment.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? detail.attachmentDialog.editTitle : detail.attachmentDialog.createTitle}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{detail.fields.name}</Label>
              <Input {...form.register("name")} placeholder={detail.placeholders.attachmentName} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{detail.fields.kind}</Label>
                <Input
                  {...form.register("kind")}
                  placeholder={detail.placeholders.attachmentKind}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{detail.fields.storageKey}</Label>
                <Input
                  {...form.register("storageKey")}
                  placeholder={detail.placeholders.attachmentStorageKey}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isEditing ? messages.common.saveChanges : detail.attachmentDialog.createAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
