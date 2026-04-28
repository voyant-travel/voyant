import { useLegalContractTemplateVersionMutation } from "@voyantjs/legal-react"
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
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const versionFormSchema = z.object({
  body: z.string().min(1, "Body is required"),
  variableSchema: z.string().optional(),
  changelog: z.string().optional(),
  createdBy: z.string().optional(),
})

type FormValues = z.input<typeof versionFormSchema>
type FormOutput = z.output<typeof versionFormSchema>

type TemplateVersionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string
  onSuccess: () => void
}

export function TemplateVersionDialog({
  open,
  onOpenChange,
  templateId,
  onSuccess,
}: TemplateVersionDialogProps) {
  const { create } = useLegalContractTemplateVersionMutation()
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(versionFormSchema),
    defaultValues: {
      body: "",
      variableSchema: "",
      changelog: "",
      createdBy: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [open, form])

  const onSubmit = async (values: FormOutput) => {
    await create.mutateAsync({
      templateId,
      input: {
        body: values.body,
        variableSchema: values.variableSchema ? JSON.parse(values.variableSchema) : undefined,
        changelog: values.changelog || undefined,
        createdBy: values.createdBy || undefined,
      },
    })
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New Template Version</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Body</Label>
              <Textarea {...form.register("body")} placeholder="Template content..." rows={10} />
              {form.formState.errors.body && (
                <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Variable Schema (JSON)</Label>
              <Textarea
                {...form.register("variableSchema")}
                placeholder='{"type": "object", "properties": {...}}'
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Changelog</Label>
                <Input {...form.register("changelog")} placeholder="What changed..." />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Created By</Label>
                <Input {...form.register("createdBy")} placeholder="Author name" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Version
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
