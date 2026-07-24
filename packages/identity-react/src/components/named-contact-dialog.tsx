"use client"

import {
  Button,
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
  type CreateNamedContactInput,
  type NamedContactRecord,
  type UpdateNamedContactInput,
  useNamedContactMutation,
} from "../index.js"

const NAMED_CONTACT_ROLES = [
  "general",
  "primary",
  "reservations",
  "operations",
  "front_desk",
  "sales",
  "emergency",
  "accounting",
  "legal",
  "other",
] as const

type NamedContactRole = (typeof NAMED_CONTACT_ROLES)[number]

function createFormSchema(messages: ReturnType<typeof useIdentityUiMessagesOrDefault>) {
  return z.object({
    role: z.enum(NAMED_CONTACT_ROLES),
    name: z.string().min(1, messages.namedContactDialog.validation.nameRequired).max(255),
    title: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    isPrimary: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export interface NamedContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: string
  entityId: string
  namedContact?: NamedContactRecord
  onSuccess?: (namedContact: NamedContactRecord) => void
}

export function NamedContactDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  namedContact,
  onSuccess,
}: NamedContactDialogProps) {
  const isEditing = Boolean(namedContact)
  const { create, update } = useNamedContactMutation()
  const messages = useIdentityUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: "general",
      name: "",
      title: "",
      email: "",
      phone: "",
      isPrimary: false,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && namedContact) {
      form.reset({
        role: namedContact.role,
        name: namedContact.name,
        title: namedContact.title ?? "",
        email: namedContact.email ?? "",
        phone: namedContact.phone ?? "",
        isPrimary: namedContact.isPrimary,
        notes: namedContact.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        role: "general",
        name: "",
        title: "",
        email: "",
        phone: "",
        isPrimary: false,
        notes: "",
      })
    }
  }, [form, namedContact, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateNamedContactInput | UpdateNamedContactInput = {
      entityType,
      entityId,
      role: values.role,
      name: values.name,
      title: values.title || null,
      email: values.email || null,
      phone: values.phone || null,
      isPrimary: values.isPrimary,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: namedContact!.id, input: payload })
      : await create.mutateAsync(payload as CreateNamedContactInput)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.namedContactDialog.titles.edit
              : messages.namedContactDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.namedContactDialog.fields.role}</Label>
                <Select
                  items={NAMED_CONTACT_ROLES.map((x) => ({
                    label: messages.common.namedContactRoleLabels[x],
                    value: x,
                  }))}
                  value={form.watch("role")}
                  onValueChange={(value) => form.setValue("role", value as NamedContactRole)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NAMED_CONTACT_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {messages.common.namedContactRoleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 self-end pb-1">
                <Switch
                  checked={form.watch("isPrimary")}
                  onCheckedChange={(value) => form.setValue("isPrimary", value)}
                />
                <Label>{messages.common.primary}</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.namedContactDialog.fields.name}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.namedContactDialog.placeholders.name}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.namedContactDialog.fields.title}</Label>
                <Input
                  {...form.register("title")}
                  placeholder={messages.namedContactDialog.placeholders.title}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.namedContactDialog.fields.email}</Label>
                <Input
                  {...form.register("email")}
                  placeholder={messages.namedContactDialog.placeholders.email}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.namedContactDialog.fields.phone}</Label>
                <PhoneInput
                  value={form.watch("phone") ?? ""}
                  onChange={(next) => form.setValue("phone", next, { shouldDirty: true })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.namedContactDialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : messages.namedContactDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
