"use client"

import {
  Input,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"
import {
  ADDRESS_LABELS,
  CONTACT_POINT_KINDS,
  NAMED_CONTACT_ROLES,
  type SupplierAddress,
  type SupplierContactPoint,
  type SupplierNamedContact,
  useSupplierAddressMutation,
  useSupplierContactMutation,
  useSupplierContactPointMutation,
} from "../index.js"
import {
  DialogActions,
  Field,
  nullableString,
  SelectField,
  SwitchField,
} from "./supplier-resource-dialog-fields.js"

export function ContactPointDialog({
  open,
  onOpenChange,
  supplierId,
  contactPoint,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  contactPoint?: SupplierContactPoint
  onSuccess: () => void
}) {
  const messages = useSuppliersUiMessagesOrDefault()
  const dialog = messages.dialogs.contactPoint
  const mutation = useSupplierContactPointMutation(supplierId)
  const schema = React.useMemo(
    () =>
      z.object({
        kind: z.enum([
          "email",
          "phone",
          "mobile",
          "whatsapp",
          "website",
          "sms",
          "fax",
          "social",
          "other",
        ]),
        label: z.string().optional().nullable(),
        value: z.string().min(1, dialog.validationValueRequired),
        normalizedValue: z.string().optional().nullable(),
        isPrimary: z.boolean().default(false),
        notes: z.string().optional().nullable(),
      }),
    [dialog.validationValueRequired],
  )
  const isEditing = !!contactPoint
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: "email",
      label: "",
      value: "",
      normalizedValue: "",
      isPrimary: false,
      notes: "",
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      kind: contactPoint?.kind ?? "email",
      label: contactPoint?.label ?? "",
      value: contactPoint?.value ?? "",
      normalizedValue: contactPoint?.normalizedValue ?? "",
      isPrimary: contactPoint?.isPrimary ?? false,
      notes: contactPoint?.notes ?? "",
    })
  }, [contactPoint, form, open])

  async function onSubmit(values: z.output<typeof schema>) {
    const input = {
      kind: values.kind,
      label: nullableString(values.label),
      value: values.value,
      normalizedValue: nullableString(values.normalizedValue),
      isPrimary: values.isPrimary,
      notes: nullableString(values.notes),
    }
    if (isEditing) {
      await mutation.update.mutateAsync({ contactPointId: contactPoint.id, input })
    } else {
      await mutation.create.mutateAsync(input)
    }
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? dialog.editTitle : dialog.newTitle}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <SelectField
              label={dialog.kindLabel}
              value={form.watch("kind")}
              onValueChange={(value) =>
                form.setValue("kind", value as z.input<typeof schema>["kind"])
              }
              options={CONTACT_POINT_KINDS.map((kind) => ({
                value: kind.value,
                label: messages.common.contactPointKindLabels[kind.value],
              }))}
            />
            <Field label={dialog.labelLabel}>
              <Input {...form.register("label")} placeholder={dialog.labelPlaceholder} />
            </Field>
            <Field label={dialog.valueLabel} error={form.formState.errors.value?.message}>
              <Input {...form.register("value")} placeholder={dialog.valuePlaceholder} />
            </Field>
            <Field label={dialog.normalizedValueLabel}>
              <Input
                {...form.register("normalizedValue")}
                placeholder={dialog.normalizedValuePlaceholder}
              />
            </Field>
            <SwitchField
              label={dialog.primaryLabel}
              checked={form.watch("isPrimary") ?? false}
              onCheckedChange={(value) => form.setValue("isPrimary", value)}
            />
            <Field label={dialog.notesLabel}>
              <Textarea {...form.register("notes")} placeholder={dialog.notesPlaceholder} />
            </Field>
          </SheetBody>
          <DialogActions
            isSubmitting={form.formState.isSubmitting}
            isEditing={isEditing}
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function NamedContactDialog({
  open,
  onOpenChange,
  supplierId,
  contact,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  contact?: SupplierNamedContact
  onSuccess: () => void
}) {
  const messages = useSuppliersUiMessagesOrDefault()
  const dialog = messages.dialogs.namedContact
  const mutation = useSupplierContactMutation(supplierId)
  const schema = React.useMemo(
    () =>
      z.object({
        role: z.enum([
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
        ]),
        name: z.string().min(1, dialog.validationNameRequired),
        title: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        isPrimary: z.boolean().default(false),
        notes: z.string().optional().nullable(),
      }),
    [dialog.validationNameRequired],
  )
  const isEditing = !!contact
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
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

  React.useEffect(() => {
    if (!open) return
    form.reset({
      role: contact?.role ?? "general",
      name: contact?.name ?? "",
      title: contact?.title ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      isPrimary: contact?.isPrimary ?? false,
      notes: contact?.notes ?? "",
    })
  }, [contact, form, open])

  async function onSubmit(values: z.output<typeof schema>) {
    const input = {
      role: values.role,
      name: values.name,
      title: nullableString(values.title),
      email: nullableString(values.email),
      phone: nullableString(values.phone),
      isPrimary: values.isPrimary,
      notes: nullableString(values.notes),
    }
    if (isEditing) {
      await mutation.update.mutateAsync({ contactId: contact.id, input })
    } else {
      await mutation.create.mutateAsync(input)
    }
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? dialog.editTitle : dialog.newTitle}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <SelectField
              label={dialog.roleLabel}
              value={form.watch("role")}
              onValueChange={(value) =>
                form.setValue("role", value as z.input<typeof schema>["role"])
              }
              options={NAMED_CONTACT_ROLES.map((role) => ({
                value: role.value,
                label: messages.common.namedContactRoleLabels[role.value],
              }))}
            />
            <Field label={dialog.nameLabel} error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder={dialog.namePlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dialog.titleLabel}>
                <Input {...form.register("title")} placeholder={dialog.titlePlaceholder} />
              </Field>
              <Field label={dialog.emailLabel}>
                <Input {...form.register("email")} placeholder={dialog.emailPlaceholder} />
              </Field>
            </div>
            <Field label={dialog.phoneLabel}>
              <Input {...form.register("phone")} placeholder={dialog.phonePlaceholder} />
            </Field>
            <SwitchField
              label={dialog.primaryLabel}
              checked={form.watch("isPrimary") ?? false}
              onCheckedChange={(value) => form.setValue("isPrimary", value)}
            />
            <Field label={dialog.notesLabel}>
              <Textarea {...form.register("notes")} placeholder={dialog.notesPlaceholder} />
            </Field>
          </SheetBody>
          <DialogActions
            isSubmitting={form.formState.isSubmitting}
            isEditing={isEditing}
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function AddressDialog({
  open,
  onOpenChange,
  supplierId,
  address,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  address?: SupplierAddress
  onSuccess: () => void
}) {
  const messages = useSuppliersUiMessagesOrDefault()
  const dialog = messages.dialogs.address
  const mutation = useSupplierAddressMutation(supplierId)
  const schema = React.useMemo(
    () =>
      z.object({
        label: z.enum([
          "primary",
          "billing",
          "shipping",
          "mailing",
          "meeting",
          "service",
          "legal",
          "other",
        ]),
        fullText: z.string().optional().nullable(),
        line1: z.string().optional().nullable(),
        line2: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        region: z.string().optional().nullable(),
        postalCode: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
        timezone: z.string().optional().nullable(),
        isPrimary: z.boolean().default(false),
        notes: z.string().optional().nullable(),
      }),
    [],
  )
  const isEditing = !!address
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: "primary",
      fullText: "",
      line1: "",
      line2: "",
      city: "",
      region: "",
      postalCode: "",
      country: "",
      timezone: "",
      isPrimary: false,
      notes: "",
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      label: address?.label ?? "primary",
      fullText: address?.fullText ?? "",
      line1: address?.line1 ?? "",
      line2: address?.line2 ?? "",
      city: address?.city ?? "",
      region: address?.region ?? "",
      postalCode: address?.postalCode ?? "",
      country: address?.country ?? "",
      timezone: address?.timezone ?? "",
      isPrimary: address?.isPrimary ?? false,
      notes: address?.notes ?? "",
    })
  }, [address, form, open])

  async function onSubmit(values: z.output<typeof schema>) {
    const input = {
      label: values.label,
      fullText: nullableString(values.fullText),
      line1: nullableString(values.line1),
      line2: nullableString(values.line2),
      city: nullableString(values.city),
      region: nullableString(values.region),
      postalCode: nullableString(values.postalCode),
      country: nullableString(values.country),
      timezone: nullableString(values.timezone),
      isPrimary: values.isPrimary,
      notes: nullableString(values.notes),
    }
    if (isEditing) {
      await mutation.update.mutateAsync({ addressId: address.id, input })
    } else {
      await mutation.create.mutateAsync(input)
    }
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? dialog.editTitle : dialog.newTitle}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <SelectField
              label={dialog.labelLabel}
              value={form.watch("label")}
              onValueChange={(value) =>
                form.setValue("label", value as z.input<typeof schema>["label"])
              }
              options={ADDRESS_LABELS.map((label) => ({
                value: label.value,
                label: messages.common.addressLabelLabels[label.value],
              }))}
            />
            <Field label={dialog.fullTextLabel}>
              <Textarea {...form.register("fullText")} placeholder={dialog.fullTextPlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dialog.line1Label}>
                <Input {...form.register("line1")} placeholder={dialog.line1Placeholder} />
              </Field>
              <Field label={dialog.line2Label}>
                <Input {...form.register("line2")} placeholder={dialog.line2Placeholder} />
              </Field>
              <Field label={dialog.cityLabel}>
                <Input {...form.register("city")} placeholder={dialog.cityPlaceholder} />
              </Field>
              <Field label={dialog.regionLabel}>
                <Input {...form.register("region")} placeholder={dialog.regionPlaceholder} />
              </Field>
              <Field label={dialog.postalCodeLabel}>
                <Input
                  {...form.register("postalCode")}
                  placeholder={dialog.postalCodePlaceholder}
                />
              </Field>
              <Field label={dialog.countryLabel}>
                <Input {...form.register("country")} placeholder={dialog.countryPlaceholder} />
              </Field>
            </div>
            <Field label={dialog.timezoneLabel}>
              <Input {...form.register("timezone")} placeholder={dialog.timezonePlaceholder} />
            </Field>
            <SwitchField
              label={dialog.primaryLabel}
              checked={form.watch("isPrimary") ?? false}
              onCheckedChange={(value) => form.setValue("isPrimary", value)}
            />
            <Field label={dialog.notesLabel}>
              <Textarea {...form.register("notes")} placeholder={dialog.notesPlaceholder} />
            </Field>
          </SheetBody>
          <DialogActions
            isSubmitting={form.formState.isSubmitting}
            isEditing={isEditing}
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </SheetContent>
    </Sheet>
  )
}
