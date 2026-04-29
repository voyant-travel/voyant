"use client"

import {
  type CreateOrderInput,
  type OrderRecord,
  type UpdateOrderInput,
  useOrderMutation,
} from "@voyantjs/transactions-react"
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
import { CurrencyCombobox } from "@/components/ui/currency-combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { EntityCombobox } from "@/components/ui/entity-combobox"
import { zodResolver } from "@/lib/zod-resolver"
import { useRegistryTransactionsMessagesOrDefault } from "./i18n"

type PersonRef = {
  id: string
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}
type OrganizationRef = { id: string; name: string; domain?: string | null }
type MarketRef = { id: string; name: string; code?: string | null; defaultCurrency?: string | null }
type OfferRef = { id: string; offerNumber: string; title: string; status?: string | null }

function personLabel(person: PersonRef): string {
  if (person.displayName) return person.displayName
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ")
  return full || person.email || person.id
}

const ORDER_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "fulfilled",
  "cancelled",
  "expired",
] as const
const DEFAULT_CURRENCY_CODE = "EUR" // i18n-literal-ok ISO default currency

type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface OrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order?: OrderRecord
  onSuccess?: (order: OrderRecord) => void
}

export function OrderDialog({ open, onOpenChange, order, onSuccess }: OrderDialogProps) {
  const messages = useRegistryTransactionsMessagesOrDefault()
  const dialogMessages = messages.orderDialog
  const isEditing = Boolean(order)
  const { create, update } = useOrderMutation()
  const formSchema = z.object({
    orderNumber: z.string().min(1, dialogMessages.errors.orderNumberRequired).max(50),
    offerId: z.string().optional().nullable(),
    title: z.string().min(1, dialogMessages.errors.titleRequired).max(255),
    status: z.enum(ORDER_STATUSES),
    currency: z.string().length(3, dialogMessages.errors.currencyLength),
    personId: z.string().optional().nullable(),
    organizationId: z.string().optional().nullable(),
    marketId: z.string().optional().nullable(),
    subtotalEuros: z.coerce.number().min(0),
    taxEuros: z.coerce.number().min(0),
    feeEuros: z.coerce.number().min(0),
    totalEuros: z.coerce.number().min(0),
    orderedAt: z.string().optional().nullable(),
    confirmedAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  type FormValues = z.input<typeof formSchema>
  type FormOutput = z.output<typeof formSchema>

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderNumber: "",
      offerId: "",
      title: "",
      status: "draft",
      currency: DEFAULT_CURRENCY_CODE,
      personId: "",
      organizationId: "",
      marketId: "",
      subtotalEuros: 0,
      taxEuros: 0,
      feeEuros: 0,
      totalEuros: 0,
      orderedAt: "",
      confirmedAt: "",
      expiresAt: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && order) {
      form.reset({
        orderNumber: order.orderNumber,
        offerId: order.offerId ?? "",
        title: order.title,
        status: order.status as OrderStatus,
        currency: order.currency,
        personId: order.personId ?? "",
        organizationId: order.organizationId ?? "",
        marketId: order.marketId ?? "",
        subtotalEuros: order.subtotalAmountCents / 100,
        taxEuros: order.taxAmountCents / 100,
        feeEuros: order.feeAmountCents / 100,
        totalEuros: order.totalAmountCents / 100,
        orderedAt: order.orderedAt ? order.orderedAt.slice(0, 10) : "",
        confirmedAt: order.confirmedAt ? order.confirmedAt.slice(0, 10) : "",
        expiresAt: order.expiresAt ? order.expiresAt.slice(0, 10) : "",
        notes: order.notes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        orderNumber: "",
        offerId: "",
        title: "",
        status: "draft",
        currency: DEFAULT_CURRENCY_CODE,
        personId: "",
        organizationId: "",
        marketId: "",
        subtotalEuros: 0,
        taxEuros: 0,
        feeEuros: 0,
        totalEuros: 0,
        orderedAt: "",
        confirmedAt: "",
        expiresAt: "",
        notes: "",
      })
    }
  }, [form, open, order])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateOrderInput | UpdateOrderInput = {
      orderNumber: values.orderNumber,
      offerId: values.offerId || null,
      title: values.title,
      status: values.status,
      currency: values.currency.toUpperCase(),
      personId: values.personId || null,
      organizationId: values.organizationId || null,
      marketId: values.marketId || null,
      subtotalAmountCents: Math.round(values.subtotalEuros * 100),
      taxAmountCents: Math.round(values.taxEuros * 100),
      feeAmountCents: Math.round(values.feeEuros * 100),
      totalAmountCents: Math.round(values.totalEuros * 100),
      orderedAt: values.orderedAt || null,
      confirmedAt: values.confirmedAt || null,
      expiresAt: values.expiresAt || null,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: order!.id, input: payload })
      : await create.mutateAsync(payload as CreateOrderInput)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.titleEdit : dialogMessages.titleNew}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.orderNumber}</Label>
                <Input
                  {...form.register("orderNumber")}
                  placeholder={dialogMessages.placeholders.orderNumber}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.title}</Label>
                <Input
                  {...form.register("title")}
                  placeholder={dialogMessages.placeholders.title}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.status}</Label>
                <Select
                  items={ORDER_STATUSES.map((x) => ({
                    label: messages.common.orderStatusLabels[x],
                    value: x,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as OrderStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {messages.common.orderStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.currency}</Label>
                <CurrencyCombobox
                  value={form.watch("currency") || null}
                  onChange={(next) =>
                    form.setValue("currency", next ?? DEFAULT_CURRENCY_CODE, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={messages.common.selectCurrency}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.market}</Label>
                <EntityCombobox<MarketRef>
                  value={form.watch("marketId") ?? null}
                  onChange={(id) => form.setValue("marketId", id)}
                  endpoint="/v1/markets/markets"
                  detailEndpoint="/v1/markets/markets/:id"
                  queryKey={["markets", "picker"]}
                  getLabel={(market) => market.name}
                  getSecondary={(market) =>
                    [market.code, market.defaultCurrency].filter(Boolean).join(" · ") || undefined
                  }
                  placeholder={messages.common.searchMarkets}
                  emptyText={messages.common.noMarkets}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.sourceOffer}</Label>
              <EntityCombobox<OfferRef>
                value={form.watch("offerId") ?? null}
                onChange={(id) => form.setValue("offerId", id)}
                endpoint="/v1/transactions/offers"
                detailEndpoint="/v1/transactions/offers/:id"
                queryKey={["transactions", "offers", "picker"]}
                getLabel={(offer) => `${offer.offerNumber} - ${offer.title}`}
                getSecondary={(offer) => offer.status ?? undefined}
                placeholder={dialogMessages.placeholders.sourceOffer}
                emptyText={dialogMessages.placeholders.noOffers}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.person}</Label>
                <EntityCombobox<PersonRef>
                  value={form.watch("personId") ?? null}
                  onChange={(id) => form.setValue("personId", id)}
                  endpoint="/v1/crm/people"
                  detailEndpoint="/v1/crm/people/:id"
                  queryKey={["crm", "people", "picker"]}
                  getLabel={personLabel}
                  getSecondary={(person) => person.email ?? undefined}
                  placeholder={messages.common.searchPeople}
                  emptyText={messages.common.noPeople}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.organization}</Label>
                <EntityCombobox<OrganizationRef>
                  value={form.watch("organizationId") ?? null}
                  onChange={(id) => form.setValue("organizationId", id)}
                  endpoint="/v1/crm/organizations"
                  detailEndpoint="/v1/crm/organizations/:id"
                  queryKey={["crm", "organizations", "picker"]}
                  getLabel={(organization) => organization.name}
                  getSecondary={(organization) => organization.domain ?? undefined}
                  placeholder={messages.common.searchOrganizations}
                  emptyText={messages.common.noOrganizations}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.subtotal}</Label>
                <Input {...form.register("subtotalEuros")} type="number" min="0" step="0.01" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.tax}</Label>
                <Input {...form.register("taxEuros")} type="number" min="0" step="0.01" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.fee}</Label>
                <Input {...form.register("feeEuros")} type="number" min="0" step="0.01" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.total}</Label>
                <Input {...form.register("totalEuros")} type="number" min="0" step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.orderedAt}</Label>
                <DatePicker
                  value={form.watch("orderedAt") || null}
                  onChange={(next) =>
                    form.setValue("orderedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.orderedAt}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.confirmedAt}</Label>
                <DatePicker
                  value={form.watch("confirmedAt") || null}
                  onChange={(next) =>
                    form.setValue("confirmedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.confirmedAt}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.expiresAt}</Label>
                <DatePicker
                  value={form.watch("expiresAt") || null}
                  onChange={(next) =>
                    form.setValue("expiresAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.expiresAt}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? messages.common.saveChanges : dialogMessages.actions.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
