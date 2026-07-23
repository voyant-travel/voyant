import { useOperatorAdminMessages } from "@voyant-travel/admin"
import {
  Button,
  ContractTemplateAuthoringHelp,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@voyant-travel/ui/components"
import { RichTextEditor } from "@voyant-travel/ui/components/rich-text-editor"
import { Switch } from "@voyant-travel/ui/components/switch"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { languages } from "@voyant-travel/utils"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  type LegalContractTemplateRecord,
  useLegalContractTemplateAuthoring,
  useLegalContractTemplateMutation,
} from "../index.js"

const SCOPE_VALUES = ["customer", "supplier", "partner", "channel", "other"] as const
type TemplateScope = (typeof SCOPE_VALUES)[number]

const templateFormSchema = z.object({
  name: z.string().min(1, "nameRequired"),
  slug: z
    .string()
    .min(1, "slugRequired")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slugKebabCase"),
  scope: z.enum(SCOPE_VALUES),
  language: z.string().min(2).max(10).optional(),
  description: z.string().optional(),
  body: z.string().min(1, "bodyRequired"),
  active: z.boolean(),
  isDefault: z.boolean(),
})

type FormValues = z.input<typeof templateFormSchema>
type FormOutput = z.output<typeof templateFormSchema>

type TemplateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: LegalContractTemplateRecord
  onSuccess: () => void
}

/**
 * Language picker options derived from the canonical ISO 639-1 list
 * shipped by `@voyant-travel/utils`. Sorted alphabetically by the English
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
  const t = useOperatorAdminMessages().legal.templateDialog
  const { create, update } = useLegalContractTemplateMutation()

  const validationByCode: Record<string, string> = {
    nameRequired: t.validation.nameRequired,
    slugRequired: t.validation.slugRequired,
    slugKebabCase: t.validation.slugKebabCase,
    bodyRequired: t.validation.bodyRequired,
  }
  const resolveValidation = (code: string | undefined) =>
    (code && validationByCode[code]) || code || ""
  const { variableCatalog, liquidSnippets } = useLegalContractTemplateAuthoring()
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
      isDefault: false,
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
        isDefault: template.isDefault,
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
      isDefault: values.isDefault,
    }

    if (isEditing && template) {
      await update.mutateAsync({ id: template.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }

    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? t.titleEdit : t.titleNew}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4 max-h-[70vh]">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t.nameLabel}</Label>
                <Input {...form.register("name")} placeholder={t.namePlaceholder} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">
                    {resolveValidation(form.formState.errors.name.message)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.slugLabel}</Label>
                <Input {...form.register("slug")} placeholder={t.slugPlaceholder} />
                {form.formState.errors.slug ? (
                  <p className="text-xs text-destructive">
                    {resolveValidation(form.formState.errors.slug.message)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t.scopeLabel}</Label>
                <Select
                  items={SCOPE_VALUES.map((value) => ({ value, label: t.scopeOptions[value] }))}
                  value={form.watch("scope")}
                  onValueChange={(value) => form.setValue("scope", value as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t.scopeOptions[value as TemplateScope]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.languageLabel}</Label>
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
              <Label>{t.descriptionLabel}</Label>
              <Textarea {...form.register("description")} placeholder={t.descriptionPlaceholder} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t.bodyLabel}</Label>
              <RichTextEditor
                value={form.watch("body")}
                onChange={(value) =>
                  form.setValue("body", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                placeholder={t.bodyPlaceholder}
                enableVariables
              />
              {form.formState.errors.body ? (
                <p className="text-xs text-destructive">
                  {resolveValidation(form.formState.errors.body.message)}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{t.bodyHelp}</p>
              )}
            </div>

            <ContractTemplateAuthoringHelp
              variableGroups={variableGroups}
              snippets={liquidSnippets}
            />

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{t.activeLabel}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  disabled={!form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("isDefault", checked)}
                />
                <div>
                  <Label>{t.defaultLabel}</Label>
                  <p className="text-xs text-muted-foreground">{t.defaultHelp}</p>
                </div>
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? t.saveChanges : t.createAction}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
