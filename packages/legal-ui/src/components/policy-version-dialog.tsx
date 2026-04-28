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
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const versionFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().optional(),
})

type FormValues = z.input<typeof versionFormSchema>
type FormOutput = z.output<typeof versionFormSchema>

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
          <DialogTitle>{isEditing ? "Edit Version" : "New Version"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input {...form.register("title")} placeholder="Version title" />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Body</Label>
              <RichTextEditor
                value={form.watch("body") ?? ""}
                onChange={(value) =>
                  form.setValue("body", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                placeholder="Policy content..."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Version"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
