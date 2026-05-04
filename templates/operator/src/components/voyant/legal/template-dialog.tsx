import type { Editor } from "@tiptap/core"
import {
  type LegalContractTemplateRecord,
  useLegalContractTemplateAuthoring,
  useLegalContractTemplateMutation,
} from "@voyantjs/legal-react"
import {
  Button,
  ContractTemplateAuthoringHelp,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import {
  insertPlainText,
  insertVariableToken,
} from "@voyantjs/ui/components/rich-text-variable-extension"
import { Switch } from "@voyantjs/ui/components/switch"
import { languages } from "@voyantjs/utils"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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

/**
 * Language picker options derived from the canonical ISO 639-1 list
 * shipped by `@voyantjs/utils`. Sorted alphabetically by the English
 * display name for predictable scanning. Lifted to module scope so
 * the array reference is stable across re-renders (otherwise the
 * Select primitive's `items` identity changes every render and
 * forces internal state churn).
 */
const LANGUAGE_ITEMS: Array<{ value: string; label: string }> = Object.entries(languages)
  .map(([code, label]) => ({ value: code, label: `${label} (${code})` }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function TemplateDialog({ open, onOpenChange, template, onSuccess }: TemplateDialogProps) {
  const isEditing = !!template
  const { create, update } = useLegalContractTemplateMutation()
  const { variableCatalog, liquidSnippets } = useLegalContractTemplateAuthoring()
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
  const variableGroups = useMemo(
    () =>
      variableCatalog.map((group) => ({
        ...group,
        variables: group.variables.map((variable) => ({
          ...variable,
          example: String(variable.example),
        })),
      })),
    [variableCatalog],
  )

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      scope: "customer",
      language: "en",
      description: "",
      body: "",
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
          <DialogBody className="grid gap-4 max-h-[70vh]">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Template name" />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Slug</Label>
                <Input {...form.register("slug")} placeholder="template-slug" />
                {form.formState.errors.slug ? (
                  <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Scope</Label>
                <Select
                  items={SCOPES}
                  value={form.watch("scope")}
                  onValueChange={(value) => form.setValue("scope", value as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((scope) => (
                      <SelectItem key={scope.value} value={scope.value}>
                        {scope.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Language</Label>
                <Select
                  items={LANGUAGE_ITEMS}
                  value={form.watch("language") ?? "en"}
                  onValueChange={(value) =>
                    form.setValue("language", value ?? "en", { shouldDirty: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_ITEMS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Optional description..." />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Body</Label>
              <RichTextEditor
                value={form.watch("body")}
                onChange={(value) =>
                  form.setValue("body", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                placeholder="Template body with Liquid variables and conditionals..."
                enableVariables
                onEditorReady={setEditorInstance}
              />
              {form.formState.errors.body ? (
                <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Editing the body automatically creates a new version. Metadata-only changes (name,
                  scope, description) update in place without versioning.
                </p>
              )}
            </div>

            <ContractTemplateAuthoringHelp
              variableGroups={variableGroups}
              snippets={liquidSnippets}
              onInsertVariable={(variable) => {
                if (!editorInstance) return
                insertVariableToken(editorInstance, variable.key)
              }}
              onInsertSnippet={(snippet) => {
                if (!editorInstance) return
                insertPlainText(editorInstance, snippet.code)
              }}
            />

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
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
