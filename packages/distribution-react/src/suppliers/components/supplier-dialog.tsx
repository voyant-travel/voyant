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
  Textarea,
} from "@voyant-travel/ui/components"
import { CountryCombobox } from "@voyant-travel/ui/components/country-combobox"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { PhoneInput } from "@voyant-travel/ui/components/phone-input"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"
import { SUPPLIER_STATUSES, SUPPLIER_TYPES, type Supplier, useSupplierMutation } from "../index.js"

function getSupplierSchema(messages: ReturnType<typeof useSuppliersUiMessagesOrDefault>) {
  const dialog = messages.dialogs.supplier
  const currencyCodeSchema = z
    .string()
    .length(3, dialog.validationIsoCurrency)
    .regex(/^[A-Z]{3}$/, dialog.validationIsoCurrency)
  return z.object({
    name: z.string().min(1, dialog.validationNameRequired),
    type: z.enum(["hotel", "transfer", "guide", "experience", "airline", "restaurant", "other"]),
    status: z.enum(["active", "inactive", "pending"]),
    description: z.string().optional().nullable(),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    phone: z.string().optional().nullable(),
    website: z.string().url().optional().or(z.literal("")).nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    defaultCurrency: z
      .union([z.literal(""), currencyCodeSchema])
      .optional()
      .nullable(),
    reservationTimeoutMinutes: z
      .union([z.literal(""), z.coerce.number().int().min(0, dialog.validationReservationTimeout)])
      .optional()
      .nullable(),
    contactName: z.string().optional().nullable(),
    contactEmail: z.string().email().optional().or(z.literal("")).nullable(),
    contactPhone: z.string().optional().nullable(),
  })
}

export type SupplierDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: Supplier
  onSuccess?: (supplier: Supplier) => void
}

export function SupplierDialog({ open, onOpenChange, supplier, onSuccess }: SupplierDialogProps) {
  const messages = useSuppliersUiMessagesOrDefault()
  const dialog = messages.dialogs.supplier
  const schema = React.useMemo(() => getSupplierSchema(messages), [messages])
  const supplierMutation = useSupplierMutation()
  const isEditing = !!supplier

  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      type: "hotel",
      status: "active",
      description: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      city: "",
      country: "",
      defaultCurrency: "",
      reservationTimeoutMinutes: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      name: supplier?.name ?? "",
      type: supplier?.type ?? "hotel",
      status: supplier?.status ?? "active",
      description: supplier?.description ?? "",
      email: supplier?.email ?? "",
      phone: supplier?.phone ?? "",
      website: supplier?.website ?? "",
      address: supplier?.address ?? "",
      city: supplier?.city ?? "",
      country: supplier?.country ?? "",
      defaultCurrency: supplier?.defaultCurrency ?? "",
      reservationTimeoutMinutes:
        supplier?.reservationTimeoutMinutes == null
          ? ""
          : String(supplier.reservationTimeoutMinutes),
      contactName: supplier?.contactName ?? "",
      contactEmail: supplier?.contactEmail ?? "",
      contactPhone: supplier?.contactPhone ?? "",
    })
  }, [form, open, supplier])

  async function onSubmit(values: z.output<typeof schema>) {
    const input = {
      ...values,
      description: values.description || null,
      email: values.email || null,
      phone: values.phone || null,
      website: values.website || null,
      address: values.address || null,
      city: values.city || null,
      country: values.country || null,
      defaultCurrency: values.defaultCurrency ? values.defaultCurrency.toUpperCase() : null,
      reservationTimeoutMinutes:
        values.reservationTimeoutMinutes === "" ||
        values.reservationTimeoutMinutes === null ||
        values.reservationTimeoutMinutes === undefined
          ? null
          : values.reservationTimeoutMinutes,
      contactName: values.contactName || null,
      contactEmail: values.contactEmail || null,
      contactPhone: values.contactPhone || null,
    }

    const saved = isEditing
      ? await supplierMutation.update.mutateAsync({ id: supplier.id, input })
      : await supplierMutation.create.mutateAsync(input)
    onSuccess?.(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? dialog.editTitle : dialog.newTitle}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{dialog.typeLabel}</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value) =>
                    form.setValue("type", value as z.input<typeof schema>["type"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {messages.common.supplierTypeLabels[type.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialog.statusLabel}</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as z.input<typeof schema>["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {messages.common.supplierStatusLabels[status.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Field label={dialog.nameLabel} error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} placeholder={dialog.namePlaceholder} />
            </Field>
            <Field label={dialog.descriptionLabel}>
              <Textarea
                {...form.register("description")}
                placeholder={dialog.descriptionPlaceholder}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dialog.emailLabel} error={form.formState.errors.email?.message}>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder={dialog.emailPlaceholder}
                />
              </Field>
              <Field label={dialog.phoneLabel}>
                <PhoneInput
                  value={form.watch("phone") ?? ""}
                  onChange={(next) => form.setValue("phone", next, { shouldDirty: true })}
                  placeholder={dialog.phonePlaceholder}
                />
              </Field>
            </div>
            <Field label={dialog.websiteLabel} error={form.formState.errors.website?.message}>
              <Input {...form.register("website")} placeholder={dialog.websitePlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={dialog.cityLabel}>
                <Input {...form.register("city")} placeholder={dialog.cityPlaceholder} />
              </Field>
              <Field label={dialog.countryLabel}>
                <CountryCombobox
                  value={form.watch("country")}
                  onChange={(value) => form.setValue("country", value ?? "")}
                  placeholder={dialog.countryPlaceholder}
                />
              </Field>
            </div>
            <Field label={dialog.addressLabel}>
              <Textarea {...form.register("address")} placeholder={dialog.addressPlaceholder} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={dialog.defaultCurrencyLabel}
                error={form.formState.errors.defaultCurrency?.message}
              >
                <CurrencyCombobox
                  value={form.watch("defaultCurrency") || null}
                  onChange={(next) =>
                    form.setValue("defaultCurrency", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.defaultCurrencyPlaceholder}
                />
              </Field>
              <Field
                label={dialog.reservationTimeoutLabel}
                error={form.formState.errors.reservationTimeoutMinutes?.message}
              >
                <Input
                  {...form.register("reservationTimeoutMinutes")}
                  type="number"
                  min="0"
                  placeholder={dialog.reservationTimeoutPlaceholder}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={dialog.contactNameLabel}>
                <Input
                  {...form.register("contactName")}
                  placeholder={dialog.contactNamePlaceholder}
                />
              </Field>
              <Field
                label={dialog.contactEmailLabel}
                error={form.formState.errors.contactEmail?.message}
              >
                <Input
                  {...form.register("contactEmail")}
                  type="email"
                  placeholder={dialog.contactEmailPlaceholder}
                />
              </Field>
              <Field label={dialog.contactPhoneLabel}>
                <PhoneInput
                  value={form.watch("contactPhone") ?? ""}
                  onChange={(next) => form.setValue("contactPhone", next, { shouldDirty: true })}
                  placeholder={dialog.contactPhonePlaceholder}
                />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {isEditing ? messages.common.save : messages.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
