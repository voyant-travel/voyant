import { type LegalPolicyVersionRecord, useLegalPolicyVersionMutation } from "@voyantjs/legal-react"
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
  RichTextEditor,
} from "@voyantjs/ui/components"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { useLegalUiMessagesOrDefault } from "../i18n/index.js"

function createVersionFormSchema(messages: ReturnType<typeof useLegalUiMessagesOrDefault>) {
  return z.object({
    title: z.string().min(1, messages.policyVersionDialog.validation.titleRequired),
    body: z.string().optional(),
  })
}

type VersionFormSchema = ReturnType<typeof createVersionFormSchema>
type FormValues = z.input<VersionFormSchema>
type FormOutput = z.output<VersionFormSchema>

type PolicyVersionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  policyId: string
  version?: LegalPolicyVersionRecord
  onSuccess: () => void
}

export function PolicyVersionDialog({
  open,
  onOpenChange,
  policyId,
  version,
  onSuccess,
}: PolicyVersionDialogProps) {
  const isEditing = !!version
  const { create, update } = useLegalPolicyVersionMutation()
  const messages = useLegalUiMessagesOrDefault()
  const versionFormSchema = createVersionFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(versionFormSchema),
    defaultValues: {
      title: "",
      body: "",
    },
  })

  useEffect(() => {
    if (open && version) {
      form.reset({
        title: version.title,
        body: version.body ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, version, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      title: values.title,
      body: values.body || undefined,
    }

    if (isEditing && version) {
      await update.mutateAsync({ id: version.id, input: payload })
    } else {
      await create.mutateAsync({ policyId, input: payload })
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.policyVersionDialog.titles.edit
              : messages.policyVersionDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.policyVersionDialog.fields.title}</Label>
              <Input
                {...form.register("title")}
                placeholder={messages.policyVersionDialog.placeholders.title}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{messages.policyVersionDialog.fields.body}</Label>
              <RichTextEditor
                value={form.watch("body") ?? ""}
                onChange={(value) =>
                  form.setValue("body", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                placeholder={messages.policyVersionDialog.placeholders.body}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing
                ? messages.common.saveChanges
                : messages.policyVersionDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
