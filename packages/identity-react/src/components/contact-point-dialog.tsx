"use client"

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
} from "@voyant-travel/ui/components"
import { PhoneInput } from "@voyant-travel/ui/components/phone-input"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useIdentityUiMessagesOrDefault } from "../i18n/index.js"
import {
  type ContactPointRecord,
  type CreateContactPointInput,
  type UpdateContactPointInput,
  useContactPointMutation,
} from "../index.js"

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

function createFormSchema(messages: ReturnType<typeof useIdentityUiMessagesOrDefault>) {
  return z.object({
    kind: z.enum(CONTACT_POINT_KINDS),
    label: z.string().optional().nullable(),
    value: z.string().min(1, messages.contactPointDialog.validation.valueRequired).max(500),
    isPrimary: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

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
  const messages = useIdentityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)
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
          <DialogTitle>
            {isEditing
              ? messages.contactPointDialog.titles.edit
              : messages.contactPointDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.contactPointDialog.fields.kind}</Label>
                <Select
                  items={CONTACT_POINT_KINDS.map((x) => ({
                    label: messages.common.contactPointKindLabels[x],
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
                      <SelectItem key={kind} value={kind}>
                        {messages.common.contactPointKindLabels[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.contactPointDialog.fields.label}</Label>
                <Input
                  {...form.register("label")}
                  placeholder={messages.contactPointDialog.placeholders.label}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.contactPointDialog.fields.value}</Label>
              {form.watch("kind") === "phone" ? (
                <PhoneInput
                  value={form.watch("value") ?? ""}
                  onChange={(next) => form.setValue("value", next, { shouldDirty: true })}
                  placeholder={messages.contactPointDialog.placeholders.value}
                />
              ) : (
                <Input
                  {...form.register("value")}
                  placeholder={messages.contactPointDialog.placeholders.value}
                />
              )}
              {form.formState.errors.value ? (
                <p className="text-xs text-destructive">{form.formState.errors.value.message}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("isPrimary")}
                onCheckedChange={(value) => form.setValue("isPrimary", value)}
              />
              <Label>{messages.common.primary}</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.contactPointDialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : messages.contactPointDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
