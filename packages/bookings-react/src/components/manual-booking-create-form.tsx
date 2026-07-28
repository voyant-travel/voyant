// agent-quality: file-size exception -- owner: bookings-react; the focused manual-create form keeps its validation and durable Tool payload reviewable together.
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type PricingAssignmentUnit,
  resolveBookingDraft,
  resolveBookingExtraLines,
  travelersToRows,
} from "@voyant-travel/bookings/pricing-assignment"
import { type BookingDraftV1, bookingDraftV1 } from "@voyant-travel/catalog-contracts/booking-engine/contracts"
import { useBookingQuote } from "@voyant-travel/catalog-react/booking-engine"
import {
  useOptionUnitPriceRules,
  usePricingCategories,
} from "@voyant-travel/commerce-react/pricing"
import { useProduct } from "@voyant-travel/inventory-react"
import {
  availabilityQueryKeys,
  getSlotQueryOptions,
  type AvailabilitySlotRecord,
  useSlots,
  useSlotUnitAvailability,
  useVoyantAvailabilityContext,
} from "@voyant-travel/operations-react/availability"
import { useOrganization, usePerson } from "@voyant-travel/relationships-react"
import {
  Button,
  Checkbox,
  confirmDialog,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyant-travel/ui/components"
import { AsyncCombobox } from "@voyant-travel/ui/components/async-combobox"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { PhoneInput } from "@voyant-travel/ui/components/phone-input"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { formatMessage, useBookingsUiI18nOrDefault, type useBookingsUiMessagesOrDefault } from "../i18n/index.js"
import {
  type BookingCreateExtraLineInput,
  type BookingCreateGroupMembershipInput,
  type BookingCreateTravelCreditRedemptionInput,
  allocateManualBookingNumber,
  createManualBookingThroughTool,
  getManualBookingToolAvailability,
} from "../manual-booking-mcp-client.js"
import { useVoyantBookingsContext } from "../provider.js"
import {
  findAlreadyPaidInstallmentMissingPaymentDate,
  hasAnyPaidPayment,
  inferTravelerPricingCategoryId,
  isBookingInventoryUnit,
  mergePricingRoomMetadata,
  normalizeBookingUnit,
  type PricingCategoryLike,
  paymentScheduleToRows,
  pricingSnapshotRoomUnits,
  sameRoomUnits,
  stripOptionPrefix,
  stripUnitSuffix,
} from "./booking-create-form-utils.js"
import { BookingPreviewCard } from "./booking-create-preview-card.js"
import { ProductExtrasPickerSection } from "./booking-create-product-extras-picker.js"
import {
  getBookableDepartureSlots,
  getOverCapacityInventoryAssignments,
  getSelectedSharedRoomUnitId,
  getTravelerAssignableStepperUnits,
  isRealBookingEmail,
  itemLinesToRows,
} from "./booking-create-utils.js"
import {
  emptyOptionUnitsStepperValue,
  OptionUnitsStepperSection,
  type OptionUnitsStepperUnit,
  type OptionUnitsStepperValue,
} from "./option-units-stepper-section.js"
import {
  createPaymentScheduleValue,
  emptyPaymentScheduleValue,
  PaymentScheduleSection,
  type PaymentScheduleValue,
} from "./payment-schedule-section.js"
import {
  emptyPersonPickerValue,
  PersonPickerSection,
  type PersonPickerValue,
} from "./person-picker-section.js"
import type { PriceBreakdownValue } from "./price-breakdown-section.js"
import { ProductPickerSection, type ProductPickerValue } from "./product-picker-section.js"
import {
  emptySharedRoomValue,
  SharedRoomSection,
  type SharedRoomValue,
} from "./shared-room-section.js"
import {
  emptyTravelCreditPickerValue,
  TravelCreditPickerSection,
  type TravelCreditPickerValue,
} from "./travel-credit-picker-section.js"
import {
  createBlankTraveler,
  type RoomGroup,
  type RoomUnitOption,
  type TravelerListValue,
  type TravelerPricingCategoryOption,
  TravelersSection,
} from "./travelers-section.js"

export interface ManualBookingCreateFormProps {
  defaultProductId?: string
  defaultSlotId?: string
  onCreated: (bookingId: string) => void
  onCancel: () => void
}

export interface ManualBookingAttempt {
  fingerprint: string
  bookingNumber: string | null
  idempotencyKey: string
}

export function formatManualBookingAmount(
  amountCents: number,
  currency: string,
  formatCurrency: (
    value: number,
    currency: string,
    options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
  ) => string,
): string {
  return formatCurrency(amountCents / 100, currency, { currencyDisplay: "code" })
}

export interface ManualBookingContactSnapshot {
  contactPartyType: "individual" | "company"
  contactTaxId: string | null
  contactFirstName: string
  contactLastName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactPreferredLanguage: string | null
}

export interface ManualBookingResolvedPricing {
  catalogAmountCents: number | null
  confirmedAmountCents: number
  priceOverrideReason: string | null
  currency: string
}

export function travelerRoleToPaxBand(role: string): "adult" | "child" | "infant" {
  if (role === "child") return "child"
  if (role === "infant") return "infant"
  return "adult"
}

export function countManualBookingPaxBands(
  travelers: TravelerListValue["travelers"],
): Record<string, number> {
  return travelers.reduce<Record<string, number>>((counts, traveler) => {
    const band = travelerRoleToPaxBand(traveler.role)
    counts[band] = (counts[band] ?? 0) + 1
    return counts
  }, {})
}

export function buildManualBookingQuoteDraft(input: {
  productId: string
  optionId: string | null
  slotId: string | null
  quantities: Record<string, number>
  units: ReadonlyArray<OptionUnitsStepperUnit>
  travelers: TravelerListValue
  contact: ManualBookingContactSnapshot | null
  promotionCode: string
  paymentSchedule: PaymentScheduleValue
}): BookingDraftV1 | null {
  if (!input.productId) return null
  const unitsById = new Map(input.units.map((unit) => [unit.optionUnitId, unit]))
  return bookingDraftV1.parse({
    entity: { module: "products", id: input.productId, sourceKind: "owned" },
    configure: {
      ...(input.slotId ? { departureSlotId: input.slotId } : {}),
      pax: countManualBookingPaxBands(input.travelers.travelers),
      ...(input.optionId ? { variantId: input.optionId } : {}),
      optionSelections: Object.entries(input.quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([optionUnitId, quantity]) => {
          const unit = unitsById.get(optionUnitId)
          return {
            optionId: unit?.optionId ?? input.optionId ?? optionUnitId,
            optionName: unit ? stripUnitSuffix(unit.unitName) : undefined,
            optionUnitId,
            optionUnitName: unit?.unitName,
            quantity,
          }
        }),
    },
    billing: input.contact
      ? {
          buyerType: input.contact.contactPartyType === "company" ? "B2B" : "B2C",
          contact: {
            firstName: input.contact.contactFirstName,
            lastName: input.contact.contactLastName ?? "",
            email: input.contact.contactEmail ?? "",
            phone: input.contact.contactPhone ?? undefined,
          },
          company:
            input.contact.contactPartyType === "company"
              ? {
                  name: input.contact.contactFirstName,
                  vatId: input.contact.contactTaxId ?? undefined,
                }
              : undefined,
          address: {},
        }
      : undefined,
    travelers: input.travelers.travelers.map((traveler, index) => ({
      rowId: traveler.clientTravelerKey ?? `traveler-${index + 1}`,
      firstName: traveler.firstName.trim() || "Traveler",
      lastName: traveler.lastName.trim() || String(index + 1),
      email: traveler.email.trim() || undefined,
      phone: traveler.phone.trim() || undefined,
      personId: traveler.personId ?? undefined,
      band: travelerRoleToPaxBand(traveler.role),
      dateOfBirth: traveler.dateOfBirth ?? undefined,
      preferredLanguage: traveler.preferredLanguage.trim() || undefined,
      isPrimary: traveler.role === "lead",
    })),
    accommodation: {
      rooms: Object.entries(input.quantities)
        .filter(([optionUnitId, quantity]) => {
          const unit = unitsById.get(optionUnitId)
          return quantity > 0 && unit ? isBookingInventoryUnit(unit) : false
        })
        .map(([optionUnitId, quantity]) => ({ optionUnitId, quantity })),
      travelerAssignments: Object.fromEntries(
        input.travelers.travelers.flatMap((traveler) =>
          traveler.clientTravelerKey && traveler.inventoryUnitId
            ? [[traveler.clientTravelerKey, traveler.inventoryUnitId]]
            : [],
        ),
      ),
    },
    payment: { intent: hasAnyPaidPayment(input.paymentSchedule) ? "bank_transfer" : "hold" },
    promotionCode: input.promotionCode.trim() || undefined,
  })
}

export function resolveManualBookingPricing(input: {
  pricing: PriceBreakdownValue | null
  quoteTotalAmountCents: number | null
  productAmountCents: number | null
  currency: string
}): ManualBookingResolvedPricing | null {
  const catalogAmountCents =
    input.quoteTotalAmountCents ?? input.pricing?.catalogAmountCents ?? input.productAmountCents
  const confirmedAmountCents =
    input.pricing?.isManualOverride && input.pricing.confirmedAmountCents != null
      ? input.pricing.confirmedAmountCents
      : catalogAmountCents
  if (confirmedAmountCents == null) return null
  const priceOverrideReason =
    input.pricing?.isManualOverride && confirmedAmountCents !== catalogAmountCents
      ? input.pricing.priceOverrideReason.trim()
      : null
  return {
    catalogAmountCents,
    confirmedAmountCents,
    priceOverrideReason: priceOverrideReason || null,
    currency: input.currency,
  }
}

export function buildManualBookingContactSnapshot(input: {
  billTo: "person" | "organization"
  contact: {
    firstName: string
    lastName: string
    email: string
    phone: string
    preferredLanguage: string
    taxId?: string | null
  }
}): ManualBookingContactSnapshot {
  return {
    contactPartyType: input.billTo === "organization" ? "company" : "individual",
    contactTaxId: input.billTo === "organization" ? (input.contact.taxId ?? null) : null,
    contactFirstName: input.contact.firstName.trim(),
    contactLastName: input.contact.lastName.trim() || null,
    contactEmail: input.contact.email.trim() || null,
    contactPhone: input.contact.phone.trim() || null,
    contactPreferredLanguage: input.contact.preferredLanguage.trim() || null,
  }
}

export function validateManualBookingDraft(input: {
  productId: string
  slotId?: string | null
  hasSelectedUnits?: boolean
  billing: PersonPickerValue
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  travelers: TravelerListValue
  pricing: ManualBookingResolvedPricing | null
  manualOverrideRequiresReason?: boolean
  paymentRows: Array<{ dueDate: string; amountCents: number }>
  paymentSchedule?: PaymentScheduleValue
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>["manualBookingCreate"]
}): string | null {
  if (!input.productId) return input.messages.validation.product
  if (input.slotId === null) return input.messages.validation.departure
  if (input.hasSelectedUnits === false) return input.messages.validation.units
  const billTo = input.billing.billTo ?? "person"
  if (billTo === "person" && !input.billing.personId) return input.messages.validation.person
  if (billTo === "organization" && !input.billing.organizationId) {
    return input.messages.validation.organization
  }
  if (!input.contactFirstName.trim()) return input.messages.validation.contact
  if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    return input.messages.validation.email
  }
  if (input.travelers.travelers.length === 0) return input.messages.validation.travelers
  if (
    input.travelers.travelers.some(
      (traveler) => !traveler.firstName.trim() || !traveler.lastName.trim(),
    )
  ) {
    return input.messages.validation.travelerNames
  }
  if (input.travelers.travelers.filter((traveler) => traveler.role === "lead").length !== 1) {
    return input.messages.validation.leadTraveler
  }
  if (!input.pricing || input.pricing.confirmedAmountCents < 0) return input.messages.validation.amount
  if (input.manualOverrideRequiresReason) return input.messages.validation.overrideReason
  if (
    input.paymentSchedule &&
    findAlreadyPaidInstallmentMissingPaymentDate(input.paymentSchedule) !== null
  ) {
    return input.messages.validation.paidPaymentDate
  }
  if (
    input.paymentRows.length > 0 &&
    (input.paymentRows.some((row) => !row.dueDate) ||
      input.paymentRows.reduce((sum, row) => sum + row.amountCents, 0) !==
        input.pricing.confirmedAmountCents)
  ) {
    return input.messages.validation.payment
  }
  return null
}

export function ManualBookingCreateForm({
  defaultProductId,
  defaultSlotId,
  onCreated,
  onCancel,
}: ManualBookingCreateFormProps) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const { messages, formatDate, formatCurrency } = useBookingsUiI18nOrDefault()
  const copy = messages.manualBookingCreate
  const client = React.useMemo(() => ({ baseUrl, fetcher }), [baseUrl, fetcher])
  const [product, setProduct] = React.useState<ProductPickerValue>({
    productId: defaultProductId ?? "",
    optionId: null,
  })
  const [slotId, setSlotId] = React.useState<string | null>(defaultSlotId ?? null)
  const [billing, setBilling] = React.useState<PersonPickerValue>(emptyPersonPickerValue)
  const [travelers, setTravelers] = React.useState<TravelerListValue>({
    travelers: [createBlankTraveler("lead")],
  })
  const [status, setStatus] = React.useState("on_hold")
  const [sellAmount, setSellAmount] = React.useState("")
  const [amountTouched, setAmountTouched] = React.useState(false)
  const [notes, setNotes] = React.useState("")
  const [contact, setContact] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preferredLanguage: "",
  })
  const [contactTouched, setContactTouched] = React.useState(false)
  const [paymentEnabled, setPaymentEnabled] = React.useState(true)
  const [paymentSchedule, setPaymentSchedule] = React.useState(() =>
    createPaymentScheduleValue(null),
  )
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [permissionState, setPermissionState] = React.useState<
    "checking" | "allowed" | "denied" | "error"
  >("checking")
  const attemptRef = React.useRef<ManualBookingAttempt | null>(null)
  const submissionRef = React.useRef(false)
  const slotsFrom = React.useMemo(() => new Date().toISOString(), [])

  const productQuery = useProduct(product.productId || undefined, {
    enabled: Boolean(product.productId),
  })
  const productRecord = productQuery.data
  const billingPerson = usePerson(
    (billing.billTo ?? "person") === "person" ? billing.personId || undefined : undefined,
    { enabled: (billing.billTo ?? "person") === "person" && Boolean(billing.personId) },
  ).data
  const billingOrganization = useOrganization(
    billing.billTo === "organization" ? (billing.organizationId ?? undefined) : undefined,
    { enabled: billing.billTo === "organization" && Boolean(billing.organizationId) },
  ).data
  const slotsQuery = useSlots({
    productId: product.productId || undefined,
    status: "open",
    startsAtFrom: slotsFrom,
    limit: 100,
    enabled: Boolean(product.productId),
  })
  const slots = slotsQuery.data?.data ?? []
  const selectedSlot = slots.find((slot) => slot.id === slotId) ?? null

  React.useEffect(() => {
    let active = true
    void getManualBookingToolAvailability(client)
      .then((availability) => {
        if (active) setPermissionState(availability.canCreate ? "allowed" : "denied")
      })
      .catch(() => {
        if (active) setPermissionState("error")
      })
    return () => {
      active = false
    }
  }, [client])

  React.useEffect(() => {
    if (!amountTouched && productRecord?.sellAmountCents != null) {
      setSellAmount((productRecord.sellAmountCents / 100).toFixed(2))
    }
  }, [amountTouched, productRecord?.sellAmountCents])

  React.useEffect(() => {
    if (contactTouched) return
    if (billingPerson) {
      setContact({
        firstName: billingPerson.firstName,
        lastName: billingPerson.lastName,
        email: billingPerson.email ?? "",
        phone: billingPerson.phone ?? "",
        preferredLanguage: billingPerson.preferredLanguage ?? "",
      })
    } else if (billingOrganization) {
      setContact({
        firstName: billingOrganization.name,
        lastName: "",
        email: "",
        phone: "",
        preferredLanguage: billingOrganization.preferredLanguage ?? "",
      })
    }
  }, [billingPerson, billingOrganization, contactTouched])

  React.useEffect(() => {
    setSlotId(defaultSlotId ?? null)
  }, [defaultSlotId])

  React.useEffect(() => {
    const departureDate = selectedSlot?.startsAt.slice(0, 10) ?? productRecord?.startDate
    setPaymentSchedule(createPaymentScheduleValue(departureDate))
  }, [selectedSlot?.startsAt, productRecord?.startDate])

  const currency = productRecord?.sellCurrency ?? ""
  const amountCents = Math.round(Number(sellAmount || "0") * 100)
  const paymentRows = paymentEnabled
    ? paymentScheduleToRows(paymentSchedule, currency, amountCents)
    : []

  const handleSubmit = async () => {
    setError(null)
    const validationError = validateManualBookingDraft({
      productId: product.productId,
      billing,
      contactFirstName: contact.firstName,
      contactLastName: contact.lastName,
      contactEmail: contact.email,
      travelers,
      sellAmount,
      paymentEnabled,
      paymentRows,
      messages: copy,
    })
    if (validationError) {
      setError(validationError)
      return
    }
    const confirmed = await confirmDialog({
      title: copy.confirm.title,
      description: copy.confirm.description
        .replace("{product}", productRecord?.name ?? product.productId)
        .replace(
          "{amount}",
          formatManualBookingAmount(amountCents, currency || "EUR", formatCurrency),
        )
        .replace("{travelers}", String(travelers.travelers.length)),
      confirmLabel: copy.actions.confirmCreate,
      cancelLabel: messages.common.cancel,
    })
    if (!confirmed) return
    if (submissionRef.current) return
    submissionRef.current = true

    const billTo = billing.billTo ?? "person"
    const booking = {
      productId: product.productId,
      optionId: selectedSlot?.optionId ?? product.optionId,
      slotId,
      personId: billTo === "person" ? billing.personId : null,
      organizationId: billTo === "organization" ? billing.organizationId : null,
      pax: travelers.travelers.length,
      internalNotes: notes.trim() || null,
      catalogSellAmountCents: productRecord?.sellAmountCents ?? amountCents,
      confirmedSellAmountCents: amountCents,
      sellAmountCentsOverride: amountCents,
      priceOverrideReason:
        productRecord?.sellAmountCents != null && productRecord.sellAmountCents !== amountCents
          ? copy.priceOverrideReason
          : null,
      initialStatus: status,
      allowDuplicate: false,
      contactFirstName: contact.firstName.trim(),
      contactLastName: contact.lastName.trim() || null,
      contactEmail: contact.email.trim() || null,
      contactPhone: contact.phone.trim() || null,
      contactPreferredLanguage: contact.preferredLanguage.trim() || null,
      travelers: travelers.travelers.map((traveler) => ({
        clientTravelerKey: traveler.clientTravelerKey,
        personId: traveler.personId,
        firstName: traveler.firstName.trim(),
        lastName: traveler.lastName.trim(),
        email: traveler.email.trim() || null,
        phone: traveler.phone.trim() || null,
        preferredLanguage: traveler.preferredLanguage.trim() || null,
        participantType: "traveler",
        travelerCategory: traveler.role === "lead" ? "adult" : traveler.role,
        isPrimary: traveler.role === "lead",
      })),
      paymentSchedules: paymentRows.length > 0 ? paymentRows : undefined,
      documentGeneration: {
        contractDocument: false,
        invoiceDocument: false,
        invoiceType: "invoice",
      },
    } satisfies Record<string, unknown>
    const fingerprint = JSON.stringify(booking)
    if (!attemptRef.current || attemptRef.current.fingerprint !== fingerprint) {
      attemptRef.current = {
        fingerprint,
        bookingNumber: null,
        idempotencyKey: createIdempotencyKey(),
      }
    }

    setSubmitting(true)
    try {
      const attempt = attemptRef.current
      if (!attempt.bookingNumber) {
        attempt.bookingNumber = await allocateManualBookingNumber(client)
      }
      const result = await createManualBookingThroughTool(client, {
        booking: { ...booking, bookingNumber: attempt.bookingNumber },
        idempotencyKey: attempt.idempotencyKey,
      })
      attemptRef.current = null
      onCreated(result.bookingId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.validation.create)
    } finally {
      submissionRef.current = false
      setSubmitting(false)
    }
  }

  const updateContact = (field: keyof typeof contact, value: string) => {
    setContactTouched(true)
    setContact((current) => ({ ...current, [field]: value }))
  }

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
    >
      <FieldGroup className="gap-6">
        <FieldSet className="gap-4 rounded-lg border p-4">
          <FieldLegend className="px-1">{copy.sections.bookingItem}</FieldLegend>
          <ProductPickerSection
            value={product}
            onChange={(next) => {
              if (next.productId !== product.productId) setSlotId(null)
              setProduct(next)
            }}
            showOptionPicker
          />
          {product.productId ? (
            <Field className="gap-2">
              <FieldLabel>{copy.fields.departure}</FieldLabel>
              <AsyncCombobox<AvailabilitySlotRecord>
                value={slotId}
                onChange={setSlotId}
                items={slots}
                selectedItem={selectedSlot}
                getKey={(slot) => slot.id}
                getLabel={(slot) => formatDate(slot.startsAt)}
                placeholder={copy.placeholders.departure}
                emptyText={copy.placeholders.departureEmpty}
                triggerClassName="w-full"
                clearable
              />
              <FieldDescription>{copy.hints.departureOptional}</FieldDescription>
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field className="gap-2 sm:col-span-2">
              <FieldLabel htmlFor="manual-booking-sell-amount">{copy.fields.sellAmount}</FieldLabel>
              <Input
                id="manual-booking-sell-amount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={sellAmount}
                onChange={(event) => {
                  setAmountTouched(true)
                  setSellAmount(event.target.value)
                }}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="manual-booking-currency">{copy.fields.currency}</FieldLabel>
              <Input id="manual-booking-currency" value={currency} readOnly />
            </Field>
          </div>
          <Field className="gap-2">
            <FieldLabel htmlFor="manual-booking-status">{copy.fields.initialStatus}</FieldLabel>
            <Select
              items={[
                { value: "on_hold", label: messages.common.bookingStatusLabels.on_hold },
                {
                  value: "awaiting_payment",
                  label: messages.common.bookingStatusLabels.awaiting_payment,
                },
                { value: "confirmed", label: messages.common.bookingStatusLabels.confirmed },
                { value: "draft", label: messages.common.bookingStatusLabels.draft },
              ]}
              value={status}
              onValueChange={(value) => setStatus(value ?? "on_hold")}
            >
              <SelectTrigger id="manual-booking-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["on_hold", "awaiting_payment", "confirmed", "draft"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {
                      messages.common.bookingStatusLabels[
                        value as keyof typeof messages.common.bookingStatusLabels
                      ]
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldSet>

        <FieldSet className="gap-4 rounded-lg border p-4">
          <FieldLegend className="px-1">{copy.sections.billing}</FieldLegend>
          <PersonPickerSection value={billing} onChange={setBilling} />
          <div className="grid gap-4 sm:grid-cols-2">
            <ContactField
              id="contact-first-name"
              label={copy.fields.contactFirstName}
              value={contact.firstName}
              required
              onChange={(value) => updateContact("firstName", value)}
            />
            <ContactField
              id="contact-last-name"
              label={copy.fields.contactLastName}
              value={contact.lastName}
              onChange={(value) => updateContact("lastName", value)}
            />
            <ContactField
              id="contact-email"
              label={copy.fields.contactEmail}
              value={contact.email}
              type="email"
              onChange={(value) => updateContact("email", value)}
            />
            <ContactField
              id="contact-phone"
              label={copy.fields.contactPhone}
              value={contact.phone}
              type="tel"
              onChange={(value) => updateContact("phone", value)}
            />
          </div>
          <FieldDescription>{copy.hints.contactSnapshot}</FieldDescription>
        </FieldSet>

        <TravelersSection
          value={travelers}
          onChange={setTravelers}
          billingPersonId={(billing.billTo ?? "person") === "person" ? billing.personId : null}
        />

        <FieldSet className="gap-4 rounded-lg border p-4">
          <FieldLegend className="px-1">{copy.sections.payment}</FieldLegend>
          <div className="flex items-start gap-2">
            <Checkbox
              id="manual-booking-payment-enabled"
              checked={paymentEnabled}
              onCheckedChange={(checked) => setPaymentEnabled(checked === true)}
            />
            <div>
              <FieldLabel htmlFor="manual-booking-payment-enabled">
                {copy.fields.addPayment}
              </FieldLabel>
              <p className="text-xs text-muted-foreground">{copy.hints.payment}</p>
            </div>
          </div>
          {paymentEnabled ? (
            <PaymentScheduleSection
              value={paymentSchedule}
              onChange={setPaymentSchedule}
              totalAmountCents={amountCents}
              departureDate={selectedSlot?.startsAt.slice(0, 10) ?? productRecord?.startDate}
              currency={currency}
            />
          ) : null}
        </FieldSet>

        <Field className="gap-2">
          <FieldLabel htmlFor="manual-booking-notes">{copy.fields.notes}</FieldLabel>
          <Textarea
            id="manual-booking-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={copy.placeholders.notes}
          />
        </Field>
      </FieldGroup>

      <aside className="flex h-fit flex-col gap-4 rounded-lg border bg-muted/20 p-4 xl:sticky xl:top-4">
        <h2 className="font-medium">{copy.summary.title}</h2>
        <SummaryRow
          label={copy.summary.product}
          value={productRecord?.name || copy.summary.missing}
        />
        <SummaryRow
          label={copy.summary.departure}
          value={selectedSlot ? formatDate(selectedSlot.startsAt) : copy.summary.openDated}
        />
        <SummaryRow
          label={copy.summary.billing}
          value={
            (billing.billTo ?? "person") === "organization"
              ? billingOrganization?.name || copy.summary.missing
              : billingPerson
                ? `${billingPerson.firstName} ${billingPerson.lastName}`
                : copy.summary.missing
          }
        />
        <SummaryRow label={copy.summary.travelers} value={String(travelers.travelers.length)} />
        <SummaryRow
          label={copy.summary.total}
          value={
            currency && Number.isFinite(amountCents)
              ? formatManualBookingAmount(amountCents, currency, formatCurrency)
              : copy.summary.missing
          }
        />
        {permissionState === "denied" ? (
          <p role="alert" className="text-sm text-destructive">
            {copy.permissions.denied}
          </p>
        ) : null}
        {permissionState === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {copy.permissions.error}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 pt-2">
          <Button type="submit" disabled={submitting || permissionState !== "allowed"}>
            {submitting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
            ) : null}
            {permissionState === "checking" ? copy.permissions.checking : copy.actions.create}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            {messages.common.cancel}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{copy.hints.durableCreate}</p>
      </aside>
    </form>
  )
}

function ContactField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function createIdempotencyKey(): string {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `manual-booking:${id}`
}
