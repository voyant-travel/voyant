import { type LegalPolicyRecord, useLegalPolicyMutation } from "@voyantjs/legal-react"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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
} from "@/components/ui"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryLegalMessagesOrDefault } from "./i18n/provider"

type FormValues = {
  kind:
    | "cancellation"
    | "payment"
    | "terms_and_conditions"
    | "privacy"
    | "refund"
    | "commission"
    | "guarantee"
    | "other"
  name: string
  slug: string
  description?: string
  language?: string
}

type PolicyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy?: LegalPolicyRecord
  onSuccess: () => void
}

function createPolicyFormSchema(messages: ReturnType<typeof useRegistryLegalMessagesOrDefault>) {
  return z.object({
    kind: z.enum([
      "cancellation",
      "payment",
      "terms_and_conditions",
      "privacy",
      "refund",
      "commission",
      "guarantee",
      "other",
    ]),
    name: z.string().min(1, messages.policyDialog.validation.nameRequired),
    slug: z
      .string()
      .min(1, messages.policyDialog.validation.slugRequired)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, messages.policyDialog.validation.slugKebabCase),
    description: z.string().optional(),
    language: z.string().min(2).max(10).optional(),
  })
}

const KINDS = [
  "cancellation",
  "payment",
  "terms_and_conditions",
  "privacy",
  "refund",
  "commission",
  "guarantee",
  "other",
] as const

export function PolicyDialog({ open, onOpenChange, policy, onSuccess }: PolicyDialogProps) {
  const messages = useRegistryLegalMessagesOrDefault()
  const policyFormSchema = createPolicyFormSchema(messages)
  const isEditing = !!policy
  const { create, update } = useLegalPolicyMutation()

  const form = useForm<FormValues>({
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

  const onSubmit = async (values: FormValues) => {
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
          <DialogTitle>
            {isEditing ? messages.policyDialog.titles.edit : messages.policyDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.policyDialog.fields.kind}</Label>
              <Select
                items={KINDS.map((item) => ({
                  label: messages.common.policyKindLabels[item],
                  value: item,
                }))}
                value={form.watch("kind")}
                onValueChange={(v) => form.setValue("kind", v as FormValues["kind"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {messages.common.policyKindLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.policyDialog.fields.name}</Label>
              <Input
                {...form.register("name")}
                placeholder={messages.policyDialog.placeholders.name}
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.policyDialog.fields.slug}</Label>
              <Input
                {...form.register("slug")}
                placeholder={messages.policyDialog.placeholders.slug}
              />
              {form.formState.errors.slug ? (
                <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.policyDialog.fields.description}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={messages.policyDialog.placeholders.description}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.policyDialog.fields.language}</Label>
              <Input
                {...form.register("language")}
                placeholder={messages.policyDialog.placeholders.language}
                maxLength={10}
                className="max-w-[120px]"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? messages.common.saveChanges : messages.policyDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
