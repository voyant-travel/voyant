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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { FileText, Loader2, Upload } from "lucide-react"
import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useLegalUiMessagesOrDefault } from "../i18n/index.js"
import { type LegalContractAttachmentRecord, useLegalContractAttachmentMutation } from "../index.js"

const attachmentKindValues = ["document", "appendix", "scan"] as const

function createAttachmentFormSchema(messages: ReturnType<typeof useLegalUiMessagesOrDefault>) {
  return z.object({
    name: z.string().min(1, messages.attachmentDialog.validation.nameRequired),
    kind: z.string().min(1).optional(),
    mimeType: z.string().optional(),
    fileSize: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().optional(),
    ),
    storageKey: z.string().optional(),
    checksum: z.string().optional(),
  })
}
type AttachmentFormSchema = ReturnType<typeof createAttachmentFormSchema>
type FormValues = z.input<AttachmentFormSchema>
type FormOutput = z.output<AttachmentFormSchema>

type AttachmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: string
  attachment?: LegalContractAttachmentRecord
  onSuccess: () => void
}

export function AttachmentDialog({
  open,
  onOpenChange,
  contractId,
  attachment,
  onSuccess,
}: AttachmentDialogProps) {
  const isEditing = !!attachment
  const { update, upload, replaceFile } = useLegalContractAttachmentMutation()
  const messages = useLegalUiMessagesOrDefault()
  const attachmentFormSchema = createAttachmentFormSchema(messages)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const kindItems: Array<{ value: string; label: string }> = attachmentKindValues.map((value) => ({
    value,
    label: messages.attachmentDialog.kindLabels[value],
  }))
  if (attachment?.kind && !(attachmentKindValues as readonly string[]).includes(attachment.kind)) {
    kindItems.push({ value: attachment.kind, label: attachment.kind })
  }

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(attachmentFormSchema),
    defaultValues: {
      name: "",
      kind: "document", // i18n-literal-ok domain attachment kind
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
      setSelectedFile(null)
      setFileError(null)
    } else if (open) {
      form.reset()
      setSelectedFile(null)
      setFileError(null)
    }
    setIsDragging(false)
  }, [open, attachment, form])

  const applySelectedFile = (file: File) => {
    setSelectedFile(file)
    setFileError(null)
    setIsDragging(false)

    const currentName = form.getValues("name")
    if (!currentName || currentName === attachment?.name) {
      form.setValue("name", file.name, { shouldDirty: true, shouldValidate: true })
    }
    form.setValue("mimeType", file.type || "", { shouldDirty: true, shouldValidate: true })
    form.setValue("fileSize", file.size, { shouldDirty: true, shouldValidate: true })
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return

    applySelectedFile(file)
    event.currentTarget.value = ""
  }

  const onFileDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const file = event.dataTransfer.files?.[0]
    if (file) applySelectedFile(file)
  }

  const onFileDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }

  const onFileDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  const onSubmit = async (values: FormOutput) => {
    const uploadInput = selectedFile
      ? {
          file: selectedFile,
          name: values.name,
          kind: values.kind || "document", // i18n-literal-ok domain attachment kind
        }
      : null

    if (uploadInput && isEditing && attachment) {
      await replaceFile.mutateAsync({ contractId, id: attachment.id, input: uploadInput })
      onSuccess()
      return
    }

    if (uploadInput) {
      await upload.mutateAsync({ contractId, input: uploadInput })
      onSuccess()
      return
    }

    if (!isEditing) {
      setFileError(messages.attachmentDialog.validation.fileRequired)
      return
    }

    await update.mutateAsync({
      contractId,
      id: attachment.id,
      input: {
        name: values.name,
        kind: values.kind || "document", // i18n-literal-ok domain attachment kind
        mimeType: values.mimeType || undefined,
        fileSize: values.fileSize,
        storageKey: values.storageKey || undefined,
        checksum: values.checksum || undefined,
      },
    })
    onSuccess()
  }

  const isSubmitting =
    form.formState.isSubmitting || update.isPending || upload.isPending || replaceFile.isPending
  const submitError = update.error ?? upload.error ?? replaceFile.error ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.attachmentDialog.titles.edit
              : messages.attachmentDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <input type="hidden" {...form.register("mimeType")} />
            <input type="hidden" {...form.register("fileSize")} />
            <input type="hidden" {...form.register("storageKey")} />
            <input type="hidden" {...form.register("checksum")} />

            <div className="flex flex-col gap-2">
              <Label>{messages.attachmentDialog.fields.file}</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={onFileDrop}
                onDragOver={onFileDragOver}
                onDragLeave={onFileDragLeave}
                data-dragging={isDragging}
                className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors hover:border-foreground/30 hover:bg-muted/30 data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/5"
              >
                {selectedFile ? (
                  <>
                    <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
                    <span className="max-w-full truncate font-medium text-sm">
                      {selectedFile.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatUploadSize(selectedFile.size)}
                      {selectedFile.type ? ` - ${selectedFile.type}` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
                    <span className="text-muted-foreground text-sm">
                      {messages.attachmentDialog.placeholders.file}
                    </span>
                  </>
                )}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />
              {fileError ? <p className="text-xs text-destructive">{fileError}</p> : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.attachmentDialog.fields.name}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.attachmentDialog.placeholders.name}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.attachmentDialog.fields.kind}</Label>
                <Select
                  items={kindItems}
                  value={form.watch("kind")}
                  onValueChange={(value) =>
                    form.setValue("kind", value ?? undefined, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kindItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {submitError ? <p className="text-xs text-destructive">{submitError.message}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? messages.common.saveChanges : messages.attachmentDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatUploadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
