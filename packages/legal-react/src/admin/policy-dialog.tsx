import { useOperatorAdminMessages } from "@voyant-travel/admin"
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
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { type LegalPolicyRecord, useLegalPolicyMutation } from "../index.js"

const KIND_VALUES = [
  "cancellation",
  "payment",
  "terms_and_conditions",
  "privacy",
  "refund",
  "commission",
  "guarantee",
  "other",
] as const
type PolicyKind = (typeof KIND_VALUES)[number]

const policyFormSchema = z.object({
  kind: z.enum(KIND_VALUES),
  name: z.string().min(1, "nameRequired"),
  slug: z
    .string()
    .min(1, "slugRequired")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slugKebabCase"),
  description: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
})

type FormValues = z.input<typeof policyFormSchema>
type FormOutput = z.output<typeof policyFormSchema>

type PolicyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy?: LegalPolicyRecord
  onSuccess: () => void
}

export function PolicyDialog({ open, onOpenChange, policy, onSuccess }: PolicyDialogProps) {
  const isEditing = !!policy
  const t = useOperatorAdminMessages().legal.policyDialog
  const { create, update } = useLegalPolicyMutation()

  const validationByCode: Record<string, string> = {
    nameRequired: t.validation.nameRequired,
    slugRequired: t.validation.slugRequired,
    slugKebabCase: t.validation.slugKebabCase,
  }
  const resolveValidation = (code: string | undefined) =>
    (code && validationByCode[code]) || code || ""

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      kind: "cancellation",
      name: "",
      slug: "",
      description: "",
      language: "en",
    },
  })

  useEffect(() => {
    if (open && policy) {
      form.reset({
        kind: policy.kind as FormValues["kind"],
        name: policy.name,
        slug: policy.slug,
        description: policy.description ?? "",
        language: policy.language,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, policy, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      kind: values.kind,
      name: values.name,
      slug: values.slug,
      description: values.description || undefined,
      language: values.language || "en",
    }

    if (isEditing && policy) {
      await update.mutateAsync({ id: policy.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t.titleEdit : t.titleNew}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t.kindLabel}</Label>
              <Select
                items={KIND_VALUES.map((value) => ({ value, label: t.kindOptions[value] }))}
                value={form.watch("kind")}
                onValueChange={(v) => form.setValue("kind", v as FormValues["kind"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t.kindOptions[value as PolicyKind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t.nameLabel}</Label>
              <Input {...form.register("name")} placeholder={t.namePlaceholder} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {resolveValidation(form.formState.errors.name.message)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t.slugLabel}</Label>
              <Input {...form.register("slug")} placeholder={t.slugPlaceholder} />
              {form.formState.errors.slug && (
                <p className="text-xs text-destructive">
                  {resolveValidation(form.formState.errors.slug.message)}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t.descriptionLabel}</Label>
              <Textarea {...form.register("description")} placeholder={t.descriptionPlaceholder} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t.languageLabel}</Label>
              <Input
                {...form.register("language")}
                placeholder={t.languagePlaceholder}
                maxLength={10}
                className="max-w-[120px]"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t.saveChanges : t.createAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
