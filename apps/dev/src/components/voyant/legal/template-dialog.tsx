import {
  type LegalContractTemplateRecord,
  useLegalContractTemplateMutation,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { Switch } from "@voyantjs/ui/components/switch"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const templateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be kebab-case"),
  scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
  language: z.string().min(2).max(10).optional(),
  description: z.string().optional(),
  body: z.string().min(1, "Body is required"),
  variableSchema: z.string().optional(),
  active: z.boolean(),
})

type FormValues = z.input<typeof templateFormSchema>
type FormOutput = z.output<typeof templateFormSchema>

type TemplateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: LegalContractTemplateRecord
  onSuccess: () => void
}

const SCOPES = [
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "partner", label: "Partner" },
  { value: "channel", label: "Channel" },
  { value: "other", label: "Other" },
] as const

export function TemplateDialog({ open, onOpenChange, template, onSuccess }: TemplateDialogProps) {
  const isEditing = !!template
  const { create, update } = useLegalContractTemplateMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      scope: "customer",
      language: "en",
      description: "",
      body: "",
      variableSchema: "",
      active: true,
    },
  })

  useEffect(() => {
    if (open && template) {
      form.reset({
        name: template.name,
        slug: template.slug,
        scope: template.scope as FormValues["scope"],
        language: template.language,
        description: template.description ?? "",
        body: template.body,
        variableSchema: template.variableSchema
          ? JSON.stringify(template.variableSchema, null, 2)
          : "",
        active: template.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, template, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      slug: values.slug,
      scope: values.scope,
      language: values.language || "en",
      description: values.description || undefined,
      body: values.body,
      variableSchema: values.variableSchema ? JSON.parse(values.variableSchema) : undefined,
      active: values.active,
    }

    if (isEditing && template) {
      await update.mutateAsync({ id: template.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Template name" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Slug</Label>
                <Input {...form.register("slug")} placeholder="template-slug" />
                {form.formState.errors.slug && (
                  <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Scope</Label>
                <Select
                  items={SCOPES}
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Language</Label>
                <Input {...form.register("language")} placeholder="en" maxLength={10} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Optional description..." />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Body</Label>
              <Textarea
                {...form.register("body")}
                placeholder="Template content with {{variables}}..."
                rows={8}
              />
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

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>Active</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
