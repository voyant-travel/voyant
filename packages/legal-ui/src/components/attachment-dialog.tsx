import {
  type LegalContractAttachmentRecord,
  useLegalContractAttachmentMutation,
} from "@voyantjs/legal-react"
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
} from "@voyantjs/ui/components"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { useLegalUiMessagesOrDefault } from "../i18n/index.js"

function createAttachmentFormSchema(messages: ReturnType<typeof useLegalUiMessagesOrDefault>) {
  return z.object({
    name: z.string().min(1, messages.attachmentDialog.validation.nameRequired),
    kind: z.string().min(1).optional(),
    mimeType: z.string().optional(),
    fileSize: z.coerce.number().int().optional(),
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
  const { create, update } = useLegalContractAttachmentMutation()
  const messages = useLegalUiMessagesOrDefault()
  const attachmentFormSchema = createAttachmentFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(attachmentFormSchema),
    defaultValues: {
      name: "",
      kind: "appendix", // i18n-literal-ok domain default attachment kind
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

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      kind: values.kind || "appendix", // i18n-literal-ok domain default attachment kind
      mimeType: values.mimeType || undefined,
      fileSize: values.fileSize || undefined,
      storageKey: values.storageKey || undefined,
      checksum: values.checksum || undefined,
    }

    if (isEditing && attachment) {
      await update.mutateAsync({ contractId, id: attachment.id, input: payload })
    } else {
      await create.mutateAsync({ contractId, input: payload })
    }
    onSuccess()
  }

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
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.attachmentDialog.fields.kind}</Label>
                <Input
                  {...form.register("kind")}
                  placeholder={messages.attachmentDialog.placeholders.kind}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.attachmentDialog.fields.mimeType}</Label>
                <Input
                  {...form.register("mimeType")}
                  placeholder={messages.attachmentDialog.placeholders.mimeType}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.attachmentDialog.fields.fileSize}</Label>
                <Input
                  {...form.register("fileSize")}
                  type="number"
                  placeholder={messages.attachmentDialog.placeholders.fileSize}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.attachmentDialog.fields.checksum}</Label>
                <Input
                  {...form.register("checksum")}
                  placeholder={messages.attachmentDialog.placeholders.checksum}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.attachmentDialog.fields.storageKey}</Label>
              <Input
                {...form.register("storageKey")}
                placeholder={messages.attachmentDialog.placeholders.storageKey}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? messages.common.saveChanges : messages.attachmentDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
