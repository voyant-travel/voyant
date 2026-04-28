import { type LegalPolicyRecord, useLegalPolicyMutation } from "@voyantjs/legal-react"
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
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const policyFormSchema = z.object({
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
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be kebab-case"),
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

const KINDS = [
  { value: "cancellation", label: "Cancellation" },
  { value: "payment", label: "Payment" },
  { value: "terms_and_conditions", label: "Terms & Conditions" },
  { value: "privacy", label: "Privacy" },
  { value: "refund", label: "Refund" },
  { value: "commission", label: "Commission" },
  { value: "guarantee", label: "Guarantee" },
  { value: "other", label: "Other" },
] as const

export function PolicyDialog({ open, onOpenChange, policy, onSuccess }: PolicyDialogProps) {
  const isEditing = !!policy
  const { create, update } = useLegalPolicyMutation()

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
          <DialogTitle>{isEditing ? "Edit Policy" : "New Policy"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Kind</Label>
              <Select
                items={KINDS}
                value={form.watch("kind")}
                onValueChange={(v) => form.setValue("kind", v as FormValues["kind"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="Policy name" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Slug</Label>
              <Input {...form.register("slug")} placeholder="policy-slug" />
              {form.formState.errors.slug && (
                <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} placeholder="Optional description..." />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Language</Label>
              <Input
                {...form.register("language")}
                placeholder="en"
                maxLength={10}
                className="max-w-[120px]"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
