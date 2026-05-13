"use client"

import { useQueries } from "@tanstack/react-query"
import {
  type ProductDayServiceRecord,
  useProductDayServiceMutation,
} from "@voyantjs/products-react"
import {
  getSupplierServicesQueryOptions,
  type SupplierService,
  useSuppliers,
  useVoyantSuppliersContext,
} from "@voyantjs/suppliers-react"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { CurrencyCombobox } from "@/components/ui/currency-combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"

type ServiceType = ProductDayServiceRecord["serviceType"]

type Mode =
  | { kind: "create"; productId: string; dayId: string }
  | { kind: "edit"; productId: string; dayId: string; service: ProductDayServiceRecord }

export interface ProductDayServiceFormProps {
  mode: Mode
  onSuccess?: (service: ProductDayServiceRecord) => void
  onCancel?: () => void
  renderSupplierServicePicker?: ProductDayServiceSupplierPickerRenderer
}

export interface ProductDayServiceSupplierOption {
  id: string
  supplierName: string
  service: SupplierService
  label: string
}

export interface ProductDayServiceSupplierPickerRenderProps {
  value: string
  onValueChange: (supplierServiceId: string) => void
  options: ProductDayServiceSupplierOption[]
  isLoading: boolean
  disabled: boolean
  defaultPicker: React.ReactNode
}

export type ProductDayServiceSupplierPickerRenderer = (
  props: ProductDayServiceSupplierPickerRenderProps,
) => React.ReactNode

interface FormState {
  serviceType: ServiceType
  name: string
  description: string
  supplierServiceId: string
  costCurrency: string
  costAmount: string
  quantity: string
  sortOrder: string
  notes: string
}

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    return {
      serviceType: mode.service.serviceType,
      name: mode.service.name,
      description: mode.service.description ?? "",
      supplierServiceId: mode.service.supplierServiceId ?? "",
      costCurrency: mode.service.costCurrency,
      costAmount: (mode.service.costAmountCents / 100).toFixed(2),
      quantity: String(mode.service.quantity),
      sortOrder: mode.service.sortOrder == null ? "" : String(mode.service.sortOrder),
      notes: mode.service.notes ?? "",
    }
  }

  return {
    serviceType: "accommodation",
    name: "",
    description: "",
    supplierServiceId: "",
    costCurrency: "EUR", // i18n-literal-ok ISO default currency
    costAmount: "0.00",
    quantity: "1",
    sortOrder: "",
    notes: "",
  }
}

export function ProductDayServiceForm({
  mode,
  onSuccess,
  onCancel,
  renderSupplierServicePicker,
}: ProductDayServiceFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useProductDayServiceMutation()
  const suppliersClient = useVoyantSuppliersContext()
  const suppliersQuery = useSuppliers({ enabled: true, limit: 100 })
  const messages = useRegistryProductsMessagesOrDefault()

  const supplierServiceQueries = useQueries({
    queries: (suppliersQuery.data?.data ?? []).map((supplier) => ({
      ...getSupplierServicesQueryOptions(suppliersClient, supplier.id),
      enabled: true,
    })),
  })

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const serviceTypes = React.useMemo(
    () => [
      {
        value: "accommodation" as const,
        label: messages.common.serviceTypeLabels.accommodation,
      },
      { value: "transfer" as const, label: messages.common.serviceTypeLabels.transfer },
      { value: "experience" as const, label: messages.common.serviceTypeLabels.experience },
      { value: "guide" as const, label: messages.common.serviceTypeLabels.guide },
      { value: "meal" as const, label: messages.common.serviceTypeLabels.meal },
      { value: "other" as const, label: messages.common.serviceTypeLabels.other },
    ],
    [messages],
  )

  const isSubmitting = create.isPending || update.isPending
  const isLoadingSupplierServices =
    suppliersQuery.isPending || supplierServiceQueries.some((query) => query.isPending)
  const supplierServiceOptions = React.useMemo(() => {
    const suppliersById = new Map(
      (suppliersQuery.data?.data ?? []).map((supplier) => [supplier.id, supplier] as const),
    )

    return supplierServiceQueries.flatMap((query) => {
      const services = query.data?.data ?? []
      return services.map((service) => {
        const supplier = suppliersById.get(service.supplierId)
        const supplierName =
          supplier?.name ?? messages.productDayServiceForm.placeholders.supplierFallback
        const typeLabel =
          serviceTypes.find((type) => type.value === service.serviceType)?.label ??
          service.serviceType
        return {
          id: service.id,
          supplierName,
          service,
          label: `${supplierName} - ${service.name} (${typeLabel})`,
        }
      })
    })
  }, [messages, serviceTypes, supplierServiceQueries, suppliersQuery.data?.data])

  const field =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setState((previous) => ({ ...previous, [key]: value }))
    }

  const handleSupplierServiceSelect = (supplierServiceId: string) => {
    field("supplierServiceId")(supplierServiceId)
    const option = supplierServiceOptions.find((entry) => entry.id === supplierServiceId)
    if (!option) {
      return
    }

    field("name")(option.service.name)
    field("serviceType")(option.service.serviceType)
  }

  const defaultSupplierServicePicker = isLoadingSupplierServices ? (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Label>{messages.productDayServiceForm.fields.supplierService}</Label>
      <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        {messages.productDayServiceForm.placeholders.loadingSupplierServices}
      </div>
    </div>
  ) : supplierServiceOptions.length > 0 ? (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Label>{messages.productDayServiceForm.fields.supplierService}</Label>
      <Select
        items={supplierServiceOptions.map((option) => ({ label: option.label, value: option.id }))}
        value={state.supplierServiceId}
        onValueChange={handleSupplierServiceSelect}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={messages.productDayServiceForm.placeholders.supplierService} />
        </SelectTrigger>
        <SelectContent>
          {supplierServiceOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError(messages.productDayServiceForm.validation.nameRequired)
      return
    }

    const costAmount = Number.parseFloat(state.costAmount || "0")
    const quantity = Number.parseInt(state.quantity || "0", 10)
    if (!Number.isFinite(costAmount) || costAmount < 0) {
      setError(messages.productDayServiceForm.validation.costInvalid)
      return
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      setError(messages.productDayServiceForm.validation.quantityInvalid)
      return
    }

    const payload = {
      serviceType: state.serviceType,
      name: state.name.trim(),
      description: state.description.trim() ? state.description.trim() : null,
      supplierServiceId: state.supplierServiceId.trim() ? state.supplierServiceId.trim() : null,
      costCurrency: state.costCurrency.trim().toUpperCase(),
      costAmountCents: Math.round(costAmount * 100),
      quantity,
      sortOrder: state.sortOrder.trim() ? Number.parseInt(state.sortOrder, 10) || 0 : null,
      notes: state.notes.trim() ? state.notes.trim() : null,
    }

    try {
      const service =
        mode.kind === "create"
          ? (
              await create.mutateAsync({
                productId: mode.productId,
                dayId: mode.dayId,
                ...payload,
              })
            ).data
          : (
              await update.mutateAsync({
                productId: mode.productId,
                dayId: mode.dayId,
                serviceId: mode.service.id,
                input: payload,
              })
            ).data
      onSuccess?.(service)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : messages.productDayServiceForm.validation.saveFailed,
      )
    }
  }

  return (
    <form
      data-slot="product-day-service-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {renderSupplierServicePicker
          ? renderSupplierServicePicker({
              value: state.supplierServiceId,
              onValueChange: handleSupplierServiceSelect,
              options: supplierServiceOptions,
              isLoading: isLoadingSupplierServices,
              disabled: isSubmitting,
              defaultPicker: defaultSupplierServicePicker,
            })
          : defaultSupplierServicePicker}
        <div className="flex flex-col gap-1.5">
          <Label>{messages.productDayServiceForm.fields.serviceType}</Label>
          <Select
            items={serviceTypes}
            value={state.serviceType}
            onValueChange={(value) => field("serviceType")(value as ServiceType)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-day-service-name">
            {messages.productDayServiceForm.fields.name}
          </Label>
          <Input
            id="product-day-service-name"
            autoFocus
            required
            value={state.name}
            onChange={(event) => field("name")(event.target.value)}
            placeholder={messages.productDayServiceForm.placeholders.name}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-day-service-description">
          {messages.productDayServiceForm.fields.description}
        </Label>
        <Textarea
          id="product-day-service-description"
          value={state.description}
          onChange={(event) => field("description")(event.target.value)}
          placeholder={messages.productDayServiceForm.placeholders.description}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-day-service-sort-order">
          {messages.productDayServiceForm.fields.sortOrder}
        </Label>
        <Input
          id="product-day-service-sort-order"
          type="number"
          value={state.sortOrder}
          onChange={(event) => field("sortOrder")(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-day-service-cost-currency">
            {messages.productDayServiceForm.fields.currency}
          </Label>
          <CurrencyCombobox
            value={state.costCurrency || null}
            onChange={(next) => field("costCurrency")(next ?? "EUR")} // i18n-literal-ok ISO default currency
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-day-service-cost-amount">
            {messages.productDayServiceForm.fields.cost}
          </Label>
          <Input
            id="product-day-service-cost-amount"
            type="number"
            min="0"
            step="0.01"
            value={state.costAmount}
            onChange={(event) => field("costAmount")(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-day-service-quantity">
            {messages.productDayServiceForm.fields.quantity}
          </Label>
          <Input
            id="product-day-service-quantity"
            type="number"
            min="1"
            value={state.quantity}
            onChange={(event) => field("quantity")(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-day-service-notes">
          {messages.productDayServiceForm.fields.notes}
        </Label>
        <Textarea
          id="product-day-service-notes"
          value={state.notes}
          onChange={(event) => field("notes")(event.target.value)}
          placeholder={messages.productDayServiceForm.placeholders.notes}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {messages.common.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "create"
            ? messages.productDayServiceForm.actions.addService
            : messages.productDayServiceForm.actions.saveService}
        </Button>
      </div>
    </form>
  )
}
