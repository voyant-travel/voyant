"use client"

import {
  type ContactPointRecord,
  type CreateContactPointInput,
  type UpdateContactPointInput,
  useContactPointMutation,
} from "@voyantjs/identity-react"
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
  Switch,
  Textarea,
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const CONTACT_POINT_KINDS = [
  "email",
  "phone",
  "mobile",
  "whatsapp",
  "website",
  "sms",
  "fax",
  "social",
  "other",
] as const

type ContactPointKind = (typeof CONTACT_POINT_KINDS)[number]

const formSchema = z.object({
  kind: z.enum(CONTACT_POINT_KINDS),
  label: z.string().optional().nullable(),
  value: z.string().min(1, "Value is required").max(500),
  isPrimary: z.boolean(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface ContactPointDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: string
  entityId: string
  contactPoint?: ContactPointRecord
  onSuccess?: (contactPoint: ContactPointRecord) => void
}

export function ContactPointDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  contactPoint,
  onSuccess,
}: ContactPointDialogProps) {
  const isEditing = Boolean(contactPoint)
  const { create, update } = useContactPointMutation()
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { kind: "email", label: "", value: "", isPrimary: false, notes: "" },
  })

  useEffect(() => {
    if (open && contactPoint) {
      form.reset({
        kind: contactPoint.kind,
        label: contactPoint.label ?? "",
        value: contactPoint.value,
        isPrimary: contactPoint.isPrimary,
        notes: contactPoint.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({ kind: "email", label: "", value: "", isPrimary: false, notes: "" })
    }
  }, [contactPoint, form, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateContactPointInput | UpdateContactPointInput = {
      entityType,
      entityId,
      kind: values.kind,
      label: values.label || null,
      value: values.value,
      isPrimary: values.isPrimary,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: contactPoint!.id, input: payload })
      : await create.mutateAsync(payload as CreateContactPointInput)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Contact Point" : "Add Contact Point"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Kind</Label>
                <Select
                  items={CONTACT_POINT_KINDS.map((x) => ({
                    label: x.replace(/_/g, " "),
                    value: x,
                  }))}
                  value={form.watch("kind")}
                  onValueChange={(value) => form.setValue("kind", value as ContactPointKind)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_POINT_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind} className="capitalize">
                        {kind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Label</Label>
                <Input {...form.register("label")} placeholder="work, personal..." />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Value</Label>
              <Input {...form.register("value")} placeholder="name@example.com" />
              {form.formState.errors.value ? (
                <p className="text-xs text-destructive">{form.formState.errors.value.message}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("isPrimary")}
                onCheckedChange={(value) => form.setValue("isPrimary", value)}
              />
              <Label>Primary</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Contact Point"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
