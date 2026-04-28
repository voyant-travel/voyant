import {
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  type Supplier,
  useSupplierMutation,
} from "@voyantjs/suppliers-react"
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
import { CountryCombobox } from "@voyantjs/ui/components/country-combobox"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

const getSupplierFormSchema = (messages: ReturnType<typeof useAdminMessages>) =>
  z.object({
    name: z.string().min(1, messages.suppliers.dialogs.supplier.validationNameRequired),
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
      .string()
      .max(3, messages.suppliers.dialogs.supplier.validationIsoCurrency)
      .optional()
      .nullable(),
    contactName: z.string().optional().nullable(),
    contactEmail: z.string().email().optional().or(z.literal("")).nullable(),
    contactPhone: z.string().optional().nullable(),
  })

export type SupplierData = Supplier

export type SupplierDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: SupplierData
  onSuccess: () => void
}

export function SupplierDialog({ open, onOpenChange, supplier, onSuccess }: SupplierDialogProps) {
  const isEditing = !!supplier
  const supplierMutation = useSupplierMutation()
  const messages = useAdminMessages()
  const dialogMessages = messages.suppliers.dialogs.supplier
  const supplierFormSchema = getSupplierFormSchema(messages)

  const form = useForm<
    z.input<typeof supplierFormSchema>,
    unknown,
    z.output<typeof supplierFormSchema>
  >({
    resolver: zodResolver(supplierFormSchema),
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
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
  })

  useEffect(() => {
    if (open && supplier) {
      form.reset({
        name: supplier.name,
        type: supplier.type,
        status: supplier.status,
        description: supplier.description ?? "",
        email: supplier.email ?? "",
        phone: supplier.phone ?? "",
        website: supplier.website ?? "",
        address: supplier.address ?? "",
        city: supplier.city ?? "",
        country: supplier.country ?? "",
        defaultCurrency: supplier.defaultCurrency ?? "",
        contactName: supplier.contactName ?? "",
        contactEmail: supplier.contactEmail ?? "",
        contactPhone: supplier.contactPhone ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, supplier, form])

  const onSubmit = async (values: z.output<typeof supplierFormSchema>) => {
    const payload = {
      ...values,
      description: values.description || null,
      email: values.email || null,
      phone: values.phone || null,
      website: values.website || null,
      address: values.address || null,
      city: values.city || null,
      country: values.country || null,
      defaultCurrency: values.defaultCurrency || null,
      contactName: values.contactName || null,
      contactEmail: values.contactEmail || null,
      contactPhone: values.contactPhone || null,
    }

    if (isEditing) {
      await supplierMutation.update.mutateAsync({ id: supplier.id, input: payload })
    } else {
      await supplierMutation.create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.typeLabel}</Label>
                <Select
                  items={SUPPLIER_TYPES}
                  value={form.watch("type")}
                  onValueChange={(v) =>
                    form.setValue("type", v as z.input<typeof supplierFormSchema>["type"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {messages.suppliers.typeLabels[t.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.statusLabel}</Label>
                <Select
                  items={SUPPLIER_STATUSES}
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    form.setValue("status", v as z.input<typeof supplierFormSchema>["status"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {messages.suppliers.statusLabels[s.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.nameLabel}</Label>
              <Input {...form.register("name")} placeholder={dialogMessages.namePlaceholder} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.descriptionLabel}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={dialogMessages.descriptionPlaceholder}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.emailLabel}</Label>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder={dialogMessages.emailPlaceholder}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.phoneLabel}</Label>
                <Input {...form.register("phone")} placeholder={dialogMessages.phonePlaceholder} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.websiteLabel}</Label>
              <Input
                {...form.register("website")}
                placeholder={dialogMessages.websitePlaceholder}
              />
              {form.formState.errors.website && (
                <p className="text-xs text-destructive">{form.formState.errors.website.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.addressLabel}</Label>
                <Input
                  {...form.register("address")}
                  placeholder={dialogMessages.addressPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.cityLabel}</Label>
                <Input {...form.register("city")} placeholder={dialogMessages.cityPlaceholder} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.countryLabel}</Label>
                <CountryCombobox
                  value={form.watch("country") ?? null}
                  onChange={(code) => form.setValue("country", code)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.defaultCurrencyLabel}</Label>
              <Input
                {...form.register("defaultCurrency")}
                placeholder={dialogMessages.defaultCurrencyPlaceholder}
                maxLength={3}
                className="max-w-[120px]"
              />
            </div>

            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">{dialogMessages.primaryContactTitle}</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{dialogMessages.contactNameLabel}</Label>
                  <Input
                    {...form.register("contactName")}
                    placeholder={dialogMessages.contactNamePlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{dialogMessages.contactEmailLabel}</Label>
                  <Input
                    {...form.register("contactEmail")}
                    type="email"
                    placeholder={dialogMessages.contactEmailPlaceholder}
                  />
                  {form.formState.errors.contactEmail && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.contactEmail.message}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{dialogMessages.contactPhoneLabel}</Label>
                  <Input
                    {...form.register("contactPhone")}
                    placeholder={dialogMessages.contactPhonePlaceholder}
                  />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {dialogMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.save : dialogMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
