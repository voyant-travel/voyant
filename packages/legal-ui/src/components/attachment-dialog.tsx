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
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const attachmentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  kind: z.string().min(1).optional(),
  mimeType: z.string().optional(),
  fileSize: z.coerce.number().int().optional(),
  storageKey: z.string().optional(),
  checksum: z.string().optional(),
})

type FormValues = z.input<typeof attachmentFormSchema>
type FormOutput = z.output<typeof attachmentFormSchema>

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

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(attachmentFormSchema),
    defaultValues: {
      name: "",
      kind: "appendix",
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
      kind: values.kind || "appendix",
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
          <DialogTitle>{isEditing ? "Edit Attachment" : "Add Attachment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="Attachment name" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Kind</Label>
                <Input {...form.register("kind")} placeholder="appendix" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>MIME Type</Label>
                <Input {...form.register("mimeType")} placeholder="application/pdf" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>File Size</Label>
                <Input {...form.register("fileSize")} type="number" placeholder="Bytes" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Checksum</Label>
                <Input {...form.register("checksum")} placeholder="Optional" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Storage Key</Label>
              <Input {...form.register("storageKey")} placeholder="Optional storage reference" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Attachment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
