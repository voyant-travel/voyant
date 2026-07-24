import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useProductDetailApi, useProductDetailMessages } from "./host.js"
import { zodResolver } from "./zod-resolver.js"

type ServiceMessages = ReturnType<
  typeof useProductDetailMessages
>["products"]["operations"]["services"]

const buildServiceFormSchema = (messages: ServiceMessages) =>
  z.object({
    serviceType: z.enum(["accommodation", "transfer", "experience", "guide", "meal", "other"]),
    name: z.string().min(1, messages.validationNameRequired),
    description: z.string().optional().nullable(),
    countryCode: z
      .string()
      .trim()
      .max(2, messages.validationCountryCode)
      .optional()
      .or(z.literal(""))
      .nullable(),
    supplierServiceId: z.string().optional().nullable(),
    costCurrency: z.string().min(3).max(3, messages.validationIsoCurrency),
    costAmount: z.coerce.number().min(0, messages.validationCostNonNegative),
    quantity: z.coerce.number().int().positive().default(1),
    sortOrder: z.coerce.number().int().optional().or(z.literal("")).nullable(),
    notes: z.string().optional().nullable(),
  })

type ServiceFormSchema = ReturnType<typeof buildServiceFormSchema>
type ServiceFormValues = z.input<ServiceFormSchema>
type ServiceFormOutput = z.output<ServiceFormSchema>

export type DayServiceData = {
  id: string
  serviceType: "accommodation" | "transfer" | "experience" | "guide" | "meal" | "other"
  name: string
  description: string | null
  countryCode: string | null
  supplierServiceId: string | null
  costCurrency: string
  costAmountCents: number
  quantity: number
  sortOrder: number | null
  notes: string | null
}

type SupplierServiceOption = {
  id: string
  supplierId: string
  supplierName: string
  serviceType: string
  name: string
}

export interface ServiceFormProps {
  productId: string
  dayId: string
  service?: DayServiceData
  onSuccess: () => void
  onCancel?: () => void
}

function initialValues(service: DayServiceData | undefined): ServiceFormValues {
  if (service) {
    return {
      serviceType: service.serviceType,
      name: service.name,
      description: service.description ?? "",
      countryCode: service.countryCode ?? "",
      supplierServiceId: service.supplierServiceId ?? "",
      costCurrency: service.costCurrency,
      costAmount: service.costAmountCents / 100,
      quantity: service.quantity,
      sortOrder: service.sortOrder ?? "",
      notes: service.notes ?? "",
    }
  }
  return {
    serviceType: "accommodation",
    name: "",
    description: "",
    countryCode: "",
    supplierServiceId: "",
    costCurrency: "EUR",
    costAmount: 0,
    quantity: 1,
    sortOrder: "",
    notes: "",
  }
}

function getServiceTypeLabel(type: string, messages: ServiceMessages): string {
  switch (type) {
    case "accommodation":
      return messages.serviceTypeAccommodation
    case "transfer":
      return messages.serviceTypeTransfer
    case "experience":
      return messages.serviceTypeExperience
    case "guide":
      return messages.serviceTypeGuide
    case "meal":
      return messages.serviceTypeMeal
    case "other":
      return messages.serviceTypeOther
    default:
      return type
  }
}

export function ServiceForm({ productId, dayId, service, onSuccess, onCancel }: ServiceFormProps) {
  const messages = useProductDetailMessages()
  const api = useProductDetailApi()
  const productMessages = messages.products.core
  const serviceMessages = messages.products.operations.services
  const isEditing = !!service
  const serviceFormSchema = buildServiceFormSchema(serviceMessages)
  const serviceTypes = [
    { value: "accommodation", label: serviceMessages.serviceTypeAccommodation },
    { value: "transfer", label: serviceMessages.serviceTypeTransfer },
    { value: "experience", label: serviceMessages.serviceTypeExperience },
    { value: "guide", label: serviceMessages.serviceTypeGuide },
    { value: "meal", label: serviceMessages.serviceTypeMeal },
    { value: "other", label: serviceMessages.serviceTypeOther },
  ] as const

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-for-picker"],
    queryFn: async () => {
      const res = await api.get<{
        data: Array<{ id: string; name: string }>
        total: number
      }>("/v1/admin/suppliers?limit=100")
      const options: SupplierServiceOption[] = []
      for (const supplier of res.data) {
        const servicesRes = await api.get<{
          data: Array<{ id: string; serviceType: string; name: string }>
        }>(`/v1/admin/suppliers/${supplier.id}/services`)
        for (const svc of servicesRes.data) {
          options.push({
            id: svc.id,
            supplierId: supplier.id,
            supplierName: supplier.name,
            serviceType: svc.serviceType,
            name: svc.name,
          })
        }
      }
      return options
    },
  })

  const form = useForm<ServiceFormValues, unknown, ServiceFormOutput>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: initialValues(service),
  })

  useEffect(() => {
    form.reset(initialValues(service))
  }, [service, form])

  const handleSupplierServiceSelect = (supplierServiceId: string | null) => {
    const nextSupplierServiceId = supplierServiceId ?? ""
    form.setValue("supplierServiceId", nextSupplierServiceId)
    const option = suppliersData?.find((o) => o.id === nextSupplierServiceId)
    if (option) {
      form.setValue("name", option.name)
      form.setValue("serviceType", option.serviceType as ServiceFormValues["serviceType"])
    }
  }

  const onSubmit = async (values: ServiceFormOutput) => {
    const payload = {
      serviceType: values.serviceType,
      name: values.name,
      description: values.description || null,
      countryCode: values.countryCode?.trim().toUpperCase() || null,
      supplierServiceId: values.supplierServiceId || null,
      costCurrency: values.costCurrency,
      costAmountCents: Math.round(values.costAmount * 100),
      quantity: values.quantity,
      sortOrder: values.sortOrder && typeof values.sortOrder === "number" ? values.sortOrder : null,
      notes: values.notes || null,
    }

    if (isEditing) {
      await api.patch(
        `/v1/admin/products/${productId}/days/${dayId}/services/${service.id}`,
        payload,
      )
    } else {
      await api.post(`/v1/admin/products/${productId}/days/${dayId}/services`, payload)
    }
    onSuccess()
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-4 overflow-hidden"
    >
      <div className="grid gap-4">
        {suppliersData && suppliersData.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>{serviceMessages.supplierServiceLabel}</Label>
            <Select
              value={form.watch("supplierServiceId") ?? ""}
              onValueChange={handleSupplierServiceSelect}
              items={suppliersData.map((opt) => ({
                value: opt.id,
                label: `${opt.supplierName} — ${opt.name} (${getServiceTypeLabel(
                  opt.serviceType,
                  serviceMessages,
                )})`,
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={serviceMessages.supplierServicePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {suppliersData.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.supplierName} — {opt.name} (
                    {getServiceTypeLabel(opt.serviceType, serviceMessages)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{serviceMessages.serviceTypeLabel}</Label>
            <Select
              value={form.watch("serviceType")}
              onValueChange={(v) =>
                form.setValue("serviceType", v as ServiceFormValues["serviceType"])
              }
              items={serviceTypes}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{serviceMessages.nameLabel}</Label>
            <Input {...form.register("name")} placeholder={serviceMessages.namePlaceholder} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{serviceMessages.descriptionLabel}</Label>
          <Textarea
            {...form.register("description")}
            placeholder={serviceMessages.descriptionPlaceholder}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{serviceMessages.countryCodeLabel}</Label>
            <Input
              {...form.register("countryCode")}
              placeholder={serviceMessages.countryCodePlaceholder}
              maxLength={2}
              className="uppercase"
            />
            {form.formState.errors.countryCode && (
              <p className="text-xs text-destructive">
                {form.formState.errors.countryCode.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{serviceMessages.costCurrencyLabel}</Label>
            <CurrencyCombobox
              value={form.watch("costCurrency") || null}
              onChange={(next) =>
                form.setValue("costCurrency", next ?? "", {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              placeholder={serviceMessages.costCurrencyPlaceholder}
            />
            {form.formState.errors.costCurrency && (
              <p className="text-xs text-destructive">
                {form.formState.errors.costCurrency.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{serviceMessages.costAmountLabel}</Label>
            <Input
              {...form.register("costAmount")}
              type="number"
              step="0.01"
              min="0"
              placeholder={serviceMessages.costAmountPlaceholder}
            />
            {form.formState.errors.costAmount && (
              <p className="text-xs text-destructive">{form.formState.errors.costAmount.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{serviceMessages.quantityLabel}</Label>
            <Input
              {...form.register("quantity")}
              type="number"
              min="1"
              placeholder={serviceMessages.quantityPlaceholder}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{serviceMessages.sortOrderLabel}</Label>
            <Input
              {...form.register("sortOrder")}
              type="number"
              placeholder={serviceMessages.sortOrderPlaceholder}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{serviceMessages.notesLabel}</Label>
          <Textarea {...form.register("notes")} placeholder={serviceMessages.notesPlaceholder} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {productMessages.cancel}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? productMessages.saveChanges : serviceMessages.create}
        </Button>
      </div>
    </form>
  )
}
