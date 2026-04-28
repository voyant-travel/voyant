"use client"

import {
  type CreateOfferInput,
  type OfferRecord,
  type UpdateOfferInput,
  useOfferMutation,
} from "@voyantjs/transactions-react"
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
} from "@voyantjs/ui/components"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { EntityCombobox } from "@/components/ui/entity-combobox"
import { zodResolver } from "@/lib/zod-resolver"

type PersonRef = {
  id: string
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}
type OrganizationRef = { id: string; name: string; domain?: string | null }
type MarketRef = { id: string; name: string; code?: string | null; defaultCurrency?: string | null }

function personLabel(person: PersonRef): string {
  if (person.displayName) return person.displayName
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ")
  return full || person.email || person.id
}

const OFFER_STATUSES = [
  "draft",
  "published",
  "sent",
  "accepted",
  "expired",
  "withdrawn",
  "converted",
] as const

type OfferStatus = (typeof OFFER_STATUSES)[number]

const moneyEuros = z.coerce.number().min(0)
const storefrontDiscountTypes = ["percentage", "fixed_amount"] as const

function parseIdList(value: string | null | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function formatIdList(values: string[] | null | undefined) {
  return (values ?? []).join("\n")
}

const formSchema = z.object({
  offerNumber: z.string().min(1, "Offer number is required").max(50),
  title: z.string().min(1, "Title is required").max(255),
  status: z.enum(OFFER_STATUSES),
  currency: z.string().length(3, "Currency must be 3 chars"),
  personId: z.string().optional().nullable(),
  organizationId: z.string().optional().nullable(),
  marketId: z.string().optional().nullable(),
  subtotalEuros: moneyEuros,
  taxEuros: moneyEuros,
  feeEuros: moneyEuros,
  totalEuros: moneyEuros,
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  storefrontPromotionalOfferEnabled: z.boolean().default(false),
  storefrontPromotionalOfferLocale: z.string().optional().nullable(),
  storefrontPromotionalOfferSlug: z.string().optional().nullable(),
  storefrontPromotionalOfferDescription: z.string().optional().nullable(),
  storefrontPromotionalOfferDiscountType: z.enum(storefrontDiscountTypes).default("percentage"),
  storefrontPromotionalOfferDiscountValue: z.string().optional().nullable(),
  storefrontPromotionalOfferCurrency: z.string().optional().nullable(),
  storefrontPromotionalOfferValidFrom: z.string().optional().nullable(),
  storefrontPromotionalOfferValidTo: z.string().optional().nullable(),
  storefrontPromotionalOfferMinTravelers: z.coerce.number().int().min(1).optional().nullable(),
  storefrontPromotionalOfferImageMobileUrl: z.string().optional().nullable(),
  storefrontPromotionalOfferImageDesktopUrl: z.string().optional().nullable(),
  storefrontPromotionalOfferStackable: z.boolean().default(false),
  storefrontPromotionalOfferApplicableProductIds: z.string().optional().nullable(),
  storefrontPromotionalOfferApplicableDepartureIds: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface OfferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  offer?: OfferRecord
  onSuccess?: (offer: OfferRecord) => void
}

export function OfferDialog({ open, onOpenChange, offer, onSuccess }: OfferDialogProps) {
  const isEditing = Boolean(offer)
  const { create, update } = useOfferMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      offerNumber: "",
      title: "",
      status: "draft",
      currency: "EUR",
      personId: "",
      organizationId: "",
      marketId: "",
      subtotalEuros: 0,
      taxEuros: 0,
      feeEuros: 0,
      totalEuros: 0,
      validFrom: "",
      validUntil: "",
      notes: "",
      storefrontPromotionalOfferEnabled: false,
      storefrontPromotionalOfferLocale: "",
      storefrontPromotionalOfferSlug: "",
      storefrontPromotionalOfferDescription: "",
      storefrontPromotionalOfferDiscountType: "percentage",
      storefrontPromotionalOfferDiscountValue: "",
      storefrontPromotionalOfferCurrency: "",
      storefrontPromotionalOfferValidFrom: "",
      storefrontPromotionalOfferValidTo: "",
      storefrontPromotionalOfferMinTravelers: null,
      storefrontPromotionalOfferImageMobileUrl: "",
      storefrontPromotionalOfferImageDesktopUrl: "",
      storefrontPromotionalOfferStackable: false,
      storefrontPromotionalOfferApplicableProductIds: "",
      storefrontPromotionalOfferApplicableDepartureIds: "",
    },
  })

  useEffect(() => {
    if (open && offer) {
      const storefrontPromotionalOffer = offer.metadata?.storefrontPromotionalOffer
      form.reset({
        offerNumber: offer.offerNumber,
        title: offer.title,
        status: offer.status as OfferStatus,
        currency: offer.currency,
        personId: offer.personId ?? "",
        organizationId: offer.organizationId ?? "",
        marketId: offer.marketId ?? "",
        subtotalEuros: offer.subtotalAmountCents / 100,
        taxEuros: offer.taxAmountCents / 100,
        feeEuros: offer.feeAmountCents / 100,
        totalEuros: offer.totalAmountCents / 100,
        validFrom: offer.validFrom ? offer.validFrom.slice(0, 10) : "",
        validUntil: offer.validUntil ? offer.validUntil.slice(0, 10) : "",
        notes: offer.notes ?? "",
        storefrontPromotionalOfferEnabled: Boolean(storefrontPromotionalOffer),
        storefrontPromotionalOfferLocale: storefrontPromotionalOffer?.locale ?? "",
        storefrontPromotionalOfferSlug: storefrontPromotionalOffer?.slug ?? "",
        storefrontPromotionalOfferDescription: storefrontPromotionalOffer?.description ?? "",
        storefrontPromotionalOfferDiscountType:
          storefrontPromotionalOffer?.discountType ?? "percentage",
        storefrontPromotionalOfferDiscountValue: storefrontPromotionalOffer?.discountValue ?? "",
        storefrontPromotionalOfferCurrency: storefrontPromotionalOffer?.currency ?? "",
        storefrontPromotionalOfferValidFrom: storefrontPromotionalOffer?.validFrom ?? "",
        storefrontPromotionalOfferValidTo: storefrontPromotionalOffer?.validTo ?? "",
        storefrontPromotionalOfferMinTravelers: storefrontPromotionalOffer?.minTravelers ?? null,
        storefrontPromotionalOfferImageMobileUrl: storefrontPromotionalOffer?.imageMobileUrl ?? "",
        storefrontPromotionalOfferImageDesktopUrl:
          storefrontPromotionalOffer?.imageDesktopUrl ?? "",
        storefrontPromotionalOfferStackable: storefrontPromotionalOffer?.stackable ?? false,
        storefrontPromotionalOfferApplicableProductIds: formatIdList(
          storefrontPromotionalOffer?.applicableProductIds,
        ),
        storefrontPromotionalOfferApplicableDepartureIds: formatIdList(
          storefrontPromotionalOffer?.applicableDepartureIds,
        ),
      })
      return
    }
    if (open) {
      form.reset({
        offerNumber: "",
        title: "",
        status: "draft",
        currency: "EUR",
        personId: "",
        organizationId: "",
        marketId: "",
        subtotalEuros: 0,
        taxEuros: 0,
        feeEuros: 0,
        totalEuros: 0,
        validFrom: "",
        validUntil: "",
        notes: "",
        storefrontPromotionalOfferEnabled: false,
        storefrontPromotionalOfferLocale: "",
        storefrontPromotionalOfferSlug: "",
        storefrontPromotionalOfferDescription: "",
        storefrontPromotionalOfferDiscountType: "percentage",
        storefrontPromotionalOfferDiscountValue: "",
        storefrontPromotionalOfferCurrency: "",
        storefrontPromotionalOfferValidFrom: "",
        storefrontPromotionalOfferValidTo: "",
        storefrontPromotionalOfferMinTravelers: null,
        storefrontPromotionalOfferImageMobileUrl: "",
        storefrontPromotionalOfferImageDesktopUrl: "",
        storefrontPromotionalOfferStackable: false,
        storefrontPromotionalOfferApplicableProductIds: "",
        storefrontPromotionalOfferApplicableDepartureIds: "",
      })
    }
  }, [form, offer, open])

  const onSubmit = async (values: FormOutput) => {
    const promotionalOfferMetadata = values.storefrontPromotionalOfferEnabled
      ? {
          enabled: true,
          locale: values.storefrontPromotionalOfferLocale || null,
          slug: values.storefrontPromotionalOfferSlug || null,
          description: values.storefrontPromotionalOfferDescription || null,
          discountType: values.storefrontPromotionalOfferDiscountType,
          discountValue: values.storefrontPromotionalOfferDiscountValue || "0",
          currency: values.storefrontPromotionalOfferCurrency
            ? values.storefrontPromotionalOfferCurrency.toUpperCase()
            : null,
          applicableProductIds: parseIdList(values.storefrontPromotionalOfferApplicableProductIds),
          applicableDepartureIds: parseIdList(
            values.storefrontPromotionalOfferApplicableDepartureIds,
          ),
          validFrom: values.storefrontPromotionalOfferValidFrom || null,
          validTo: values.storefrontPromotionalOfferValidTo || null,
          minTravelers: values.storefrontPromotionalOfferMinTravelers ?? null,
          imageMobileUrl: values.storefrontPromotionalOfferImageMobileUrl || null,
          imageDesktopUrl: values.storefrontPromotionalOfferImageDesktopUrl || null,
          stackable: values.storefrontPromotionalOfferStackable,
        }
      : undefined

    const payload: CreateOfferInput | UpdateOfferInput = {
      offerNumber: values.offerNumber,
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
      validFrom: values.validFrom || null,
      validUntil: values.validUntil || null,
      notes: values.notes || null,
      metadata: promotionalOfferMetadata
        ? {
            ...(offer?.metadata ?? {}),
            storefrontPromotionalOffer: promotionalOfferMetadata,
          }
        : offer?.metadata
          ? {
              ...offer.metadata,
              storefrontPromotionalOffer: undefined,
            }
          : null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: offer!.id, input: payload })
      : await create.mutateAsync(payload as CreateOfferInput)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending
  const storefrontPromoEnabled = form.watch("storefrontPromotionalOfferEnabled")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Offer" : "Add Offer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Offer number</Label>
                <Input {...form.register("offerNumber")} placeholder="OFF-2026-0001" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Title</Label>
                <Input {...form.register("title")} placeholder="Istanbul 5-day tour" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={OFFER_STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as OfferStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Currency</Label>
                <CurrencyCombobox
                  value={form.watch("currency") || null}
                  onChange={(next) =>
                    form.setValue("currency", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Market</Label>
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
                  placeholder="Search markets..."
                  emptyText="No markets found."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Person</Label>
                <EntityCombobox<PersonRef>
                  value={form.watch("personId") ?? null}
                  onChange={(id) => form.setValue("personId", id)}
                  endpoint="/v1/crm/people"
                  detailEndpoint="/v1/crm/people/:id"
                  queryKey={["crm", "people", "picker"]}
                  getLabel={personLabel}
                  getSecondary={(person) => person.email ?? undefined}
                  placeholder="Search people..."
                  emptyText="No people found."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Organization</Label>
                <EntityCombobox<OrganizationRef>
                  value={form.watch("organizationId") ?? null}
                  onChange={(id) => form.setValue("organizationId", id)}
                  endpoint="/v1/crm/organizations"
                  detailEndpoint="/v1/crm/organizations/:id"
                  queryKey={["crm", "organizations", "picker"]}
                  getLabel={(organization) => organization.name}
                  getSecondary={(organization) => organization.domain ?? undefined}
                  placeholder="Search organizations..."
                  emptyText="No organizations found."
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Subtotal</Label>
                <Input {...form.register("subtotalEuros")} type="number" min="0" step="0.01" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Tax</Label>
                <Input {...form.register("taxEuros")} type="number" min="0" step="0.01" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Fee</Label>
                <Input {...form.register("feeEuros")} type="number" min="0" step="0.01" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Total</Label>
                <Input {...form.register("totalEuros")} type="number" min="0" step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Valid from</Label>
                <DatePicker
                  value={form.watch("validFrom") || null}
                  onChange={(next) =>
                    form.setValue("validFrom", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select start date"
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Valid until</Label>
                <DatePicker
                  value={form.watch("validUntil") || null}
                  onChange={(next) =>
                    form.setValue("validUntil", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select end date"
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label>Storefront promotional offer</Label>
                  <p className="text-sm text-muted-foreground">
                    Publish editorial promo fields on this offer for storefront pages.
                  </p>
                </div>
                <Switch
                  checked={storefrontPromoEnabled}
                  onCheckedChange={(value) =>
                    form.setValue("storefrontPromotionalOfferEnabled", value)
                  }
                />
              </div>

              {storefrontPromoEnabled ? (
                <div className="mt-4 grid gap-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Locale</Label>
                      <Input
                        {...form.register("storefrontPromotionalOfferLocale")}
                        placeholder="ro"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Slug</Label>
                      <Input
                        {...form.register("storefrontPromotionalOfferSlug")}
                        placeholder="early-booking-budapest"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Minimum travelers</Label>
                      <Input
                        {...form.register("storefrontPromotionalOfferMinTravelers")}
                        type="number"
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Discount type</Label>
                      <Select
                        items={[
                          { label: "Percentage", value: "percentage" },
                          { label: "Fixed amount", value: "fixed_amount" },
                        ]}
                        value={form.watch("storefrontPromotionalOfferDiscountType")}
                        onValueChange={(value) =>
                          form.setValue(
                            "storefrontPromotionalOfferDiscountType",
                            value as (typeof storefrontDiscountTypes)[number],
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed_amount">Fixed amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Discount value</Label>
                      <Input
                        {...form.register("storefrontPromotionalOfferDiscountValue")}
                        placeholder="15"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Promo currency</Label>
                      <CurrencyCombobox
                        value={form.watch("storefrontPromotionalOfferCurrency") || null}
                        onChange={(next) =>
                          form.setValue("storefrontPromotionalOfferCurrency", next ?? "EUR", {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Promo valid from</Label>
                      <DatePicker
                        value={form.watch("storefrontPromotionalOfferValidFrom") || null}
                        onChange={(next) =>
                          form.setValue("storefrontPromotionalOfferValidFrom", next ?? "", {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        placeholder="Select promo start"
                        className="w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Promo valid to</Label>
                      <DatePicker
                        value={form.watch("storefrontPromotionalOfferValidTo") || null}
                        onChange={(next) =>
                          form.setValue("storefrontPromotionalOfferValidTo", next ?? "", {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        placeholder="Select promo end"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.watch("storefrontPromotionalOfferStackable")}
                      onCheckedChange={(value) =>
                        form.setValue("storefrontPromotionalOfferStackable", value)
                      }
                    />
                    <Label>Stackable with other storefront promos</Label>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Description</Label>
                    <Textarea {...form.register("storefrontPromotionalOfferDescription")} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Mobile image URL</Label>
                      <Input
                        {...form.register("storefrontPromotionalOfferImageMobileUrl")}
                        placeholder="https://cdn.example.com/offers/mobile.jpg"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Desktop image URL</Label>
                      <Input
                        {...form.register("storefrontPromotionalOfferImageDesktopUrl")}
                        placeholder="https://cdn.example.com/offers/desktop.jpg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Applicable product IDs</Label>
                      <Textarea
                        {...form.register("storefrontPromotionalOfferApplicableProductIds")}
                        placeholder={"prod_123\nprod_456"}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Applicable departure IDs</Label>
                      <Textarea
                        {...form.register("storefrontPromotionalOfferApplicableDepartureIds")}
                        placeholder={"dep_123\ndep_456"}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Offer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
