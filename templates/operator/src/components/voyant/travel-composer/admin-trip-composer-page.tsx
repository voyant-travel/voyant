"use client"

import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  type PaymentScheduleValue,
  PersonPickerSection,
  type PersonPickerValue,
  type VoucherPickerValue,
} from "@voyantjs/bookings-ui"
import { emptyPersonPickerValue } from "@voyantjs/bookings-ui/components/person-picker-section"
import { emptyVoucherPickerValue } from "@voyantjs/bookings-ui/components/voucher-picker-section"
import { usePerson } from "@voyantjs/crm-react"
import type { Trip, TripComponent } from "@voyantjs/travel-composer"
import {
  type AddTripComponentBody,
  addTripComponent,
  createTrip,
  defaultFetcher,
  getTrip,
  previewTripCancellation,
  priceTrip,
  removeTripComponent,
  reserveTrip,
  startTripCheckout,
  updateTripComponent,
  type VoyantApiError,
} from "@voyantjs/travel-composer-react"
import { Button } from "@voyantjs/ui/components/button"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { Label } from "@voyantjs/ui/components/label"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { getApiUrl } from "@/lib/env"
import {
  AddComponentMenu,
  CommittedComponentCard,
  type ComponentBookingSetup,
  ComponentsEmpty,
  componentTitleFor,
  computePlaceholderTotals,
  Field,
  findOverlappingComponent,
  flightPricingFromPending,
  newPendingComponent,
  type PendingComponent,
  PendingComponentCard,
  type PendingVerticalKind,
  PrimaryAction,
  Section,
  StatusAlert,
  sortComponentsBySchedule,
  TripPreviewRail,
  type TripTraveler,
  TripTravelersSection,
} from "./admin-trip-composer-panels"

interface ComposerState {
  trip: Trip | null
  message: string | null
  error: string | null
}

interface CancellationPreview {
  refund: number
  penalty: number
  staffActionRequired: boolean
  warnings: string[]
}

const defaultPaymentCurrency = "EUR"

export interface AdminTripComposerPageProps {
  initialTrip?: Trip | null
}

export function AdminTripComposerPage({
  initialTrip = null,
}: AdminTripComposerPageProps): React.ReactElement {
  const navigate = useNavigate()
  const [state, setState] = useState<ComposerState>({
    trip: initialTrip,
    message: null,
    error: null,
  })
  const [billing, setBilling] = useState<PersonPickerValue>(emptyPersonPickerValue)
  const [travelers, setTravelers] = useState<TripTraveler[]>([])
  const [notes, setNotes] = useState("")
  const [pending, setPending] = useState<PendingComponent[]>([])
  const [committingLocalId, setCommittingLocalId] = useState<string | null>(null)
  const [voucher, setVoucher] = useState<VoucherPickerValue>(emptyVoucherPickerValue)
  const [createAsDraft, setCreateAsDraft] = useState(false)
  const [paymentCurrency, setPaymentCurrency] = useState(defaultPaymentCurrency)
  const [selectedCancellationIds, setSelectedCancellationIds] = useState<string[]>([])
  const [cancellationReason, setCancellationReason] = useState("Customer requested change")
  const [cancellationPreview, setCancellationPreview] = useState<CancellationPreview | null>(null)

  const client = useMemo(() => ({ baseUrl: getApiUrl(), fetcher: defaultFetcher }), [])
  const trip = state.trip
  const envelopeId = trip?.envelope.id
  const components = useMemo(
    () =>
      sortComponentsBySchedule(
        (trip?.components ?? []).filter((component) => component.status !== "removed"),
      ),
    [trip?.components],
  )
  const selectedCount = selectedCancellationIds.length
  const envelopeStatus = trip?.envelope.status
  // Once the trip is reserved or further along, removal touches real holds /
  // bookings — operators must go through cancellation preview. Before that
  // (`draft` / priced) a component is a no-op blueprint and can be deleted.
  const trapReserved =
    envelopeStatus === "reserved" ||
    envelopeStatus === "reserve_in_progress" ||
    envelopeStatus === "checkout_started" ||
    envelopeStatus === "booked"

  const billingPersonQuery = usePerson(billing.personId || undefined, {
    enabled: billing.mode === "existing" && Boolean(billing.personId),
  })
  const payerName = derivePayerName(billing, billingPersonQuery.data)
  const payerEmail = derivePayerEmail(billing, billingPersonQuery.data)

  useEffect(() => {
    setState((current) => ({ ...current, trip: initialTrip }))
    const travelerParty = initialTrip?.envelope.travelerParty
    if (!travelerParty) {
      setBilling(emptyPersonPickerValue)
      setTravelers([])
      setNotes("")
      setVoucher(emptyVoucherPickerValue)
      setCreateAsDraft(false)
      setPaymentCurrency(defaultPaymentCurrency)
      return
    }
    setBilling(hydrateBilling(travelerParty))
    setTravelers(hydrateTravelers(travelerParty))
    setNotes(initialTrip.envelope.description ?? "")
    setVoucher(hydrateVoucher(travelerParty))
    const constraints = initialTrip.envelope.constraints
    setCreateAsDraft(booleanFromRecord(constraints, "createAsDraft"))
    setPaymentCurrency(
      stringFromRecord(constraints, "paymentCurrency") ||
        initialTrip.envelope.aggregateCurrency ||
        defaultPaymentCurrency,
    )
  }, [initialTrip])

  function showError(error: unknown) {
    setState((current) => ({ ...current, error: apiError(error), message: null }))
  }

  async function ensureTrip(): Promise<Trip> {
    if (state.trip) return state.trip
    assertTripCreationRequirements({ billing, travelers, payerName, payerEmail })
    const created = await createTrip(client, {
      description: notes || undefined,
      travelerParty: {
        billing: serializeBilling(billing, payerName, payerEmail),
        travelers,
        voucher: voucher.picked
          ? {
              id: voucher.picked.id,
              code: voucher.picked.code,
              currency: voucher.picked.currency,
              remainingAmountCents: voucher.picked.remainingAmountCents,
            }
          : null,
      },
      constraints: {
        channel: "admin-composer",
        compositionMode: "cross-vertical",
        createAsDraft,
        paymentCurrency,
      },
    })
    setState((current) => ({ ...current, trip: created }))
    return created
  }

  const commitMutation = useMutation({
    mutationFn: async (component: PendingComponent) => {
      const currentTrip = await ensureTrip()
      const input = pendingToAddInput(component, {
        billing,
        travelers,
        payerName,
        payerEmail,
        paymentCurrency,
      })
      if (!input) throw new Error("This component isn't ready to add yet")
      await addTripComponent(client, currentTrip.envelope.id, input)
      return priceTrip(client, currentTrip.envelope.id, {
        scope: { locale: "en-US", audience: "staff", market: "default", currency: paymentCurrency },
      })
    },
    onSuccess: (result, component) => {
      setPending((current) => current.filter((p) => p.localId !== component.localId))
      setState({
        trip: { envelope: result.envelope, components: result.components },
        message: "Component added · trip priced",
        error: failuresToString(result.failures),
      })
      setCancellationPreview(null)
      setCommittingLocalId(null)
    },
    onError: (error, component) => {
      const message = apiError(error)
      setPending((current) =>
        current.map((p) => (p.localId === component.localId ? { ...p, commitError: message } : p)),
      )
      setCommittingLocalId(null)
    },
  })

  const reserveMutation = useMutation({
    mutationFn: async () => {
      if (!envelopeId) throw new Error("Price the trip first")
      assertTripCreationRequirements({ billing, travelers, payerName, payerEmail })
      const reserved = await reserveTrip(client, envelopeId, {
        idempotencyKey: `admin-reserve-${envelopeId}`,
        refreshScope: {
          locale: "en-US",
          audience: "staff",
          market: "default",
          currency: paymentCurrency,
        },
      })
      if (reserved.failures.length > 0) return { reserved, checkout: null }
      const checkout = await startTripCheckout(client, envelopeId, {
        idempotencyKey: `admin-checkout-${envelopeId}`,
        intent: "card",
        request: { initiatedBy: "admin-trip-composer", collectionCurrency: paymentCurrency },
      })
      return { reserved, checkout }
    },
    onSuccess: ({ reserved, checkout }) => {
      const trip = checkout
        ? { envelope: checkout.envelope, components: checkout.components }
        : { envelope: reserved.envelope, components: reserved.components }
      setState({
        trip,
        message: checkout?.target.paymentSessionId
          ? "Trip reserved · payment link ready"
          : "Trip reserved",
        error: failuresToString(reserved.failures),
      })
      // Keep operators in the trip aggregate after reserve; individual booking
      // links remain available from each component card.
      if (reserved.failures.length === 0) {
        navigate({ to: "/trips/$id", params: { id: reserved.envelope.id } })
      }
    },
    onError: (error) => showError(error),
  })

  const removeComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      if (!envelopeId) throw new Error("No trip")
      await removeTripComponent(client, componentId)
      return getTrip(client, envelopeId)
    },
    onMutate: (componentId) => {
      const previousTrip = state.trip
      // Optimistically mark the component as removed so the card disappears
      // immediately. Aggregate totals re-derive from the visible components.
      if (previousTrip) {
        setState((current) => ({
          ...current,
          trip: {
            ...previousTrip,
            components: previousTrip.components.map((component) =>
              component.id === componentId
                ? { ...component, status: "removed" as const }
                : component,
            ),
          },
        }))
      }
      setSelectedCancellationIds((current) => current.filter((id) => id !== componentId))
      setCancellationPreview(null)
      return { previousTrip }
    },
    onSuccess: (updatedTrip) => {
      setState({ trip: updatedTrip, message: "Component removed", error: null })
    },
    onError: (error, _componentId, context) => {
      if (context?.previousTrip) {
        setState((current) => ({ ...current, trip: context.previousTrip }))
      }
      showError(error)
    },
  })

  const updateComponentSetupMutation = useMutation({
    mutationFn: async ({
      componentId,
      metadata,
    }: {
      componentId: string
      metadata: Record<string, unknown>
    }) => updateTripComponent(client, componentId, { metadata }),
    onMutate: ({ componentId, metadata }) => {
      const previousTrip = state.trip
      if (previousTrip) {
        setState((current) => ({
          ...current,
          trip: {
            ...previousTrip,
            components: previousTrip.components.map((component) =>
              component.id === componentId ? { ...component, metadata } : component,
            ),
          },
        }))
      }
      return { previousTrip }
    },
    onSuccess: (updatedComponent) => {
      setState((current) =>
        current.trip
          ? {
              ...current,
              trip: {
                ...current.trip,
                components: current.trip.components.map((component) =>
                  component.id === updatedComponent.id ? updatedComponent : component,
                ),
              },
            }
          : current,
      )
    },
    onError: (error, _input, context) => {
      if (context?.previousTrip) {
        setState((current) => ({ ...current, trip: context.previousTrip }))
      }
      showError(error)
    },
  })

  const cancellationMutation = useMutation({
    mutationFn: async () => {
      if (!envelopeId) throw new Error("No trip to cancel")
      return previewTripCancellation(client, envelopeId, {
        componentIds: selectedCancellationIds,
        reason: cancellationReason,
        request: { initiatedBy: "admin" },
      })
    },
    onSuccess: (result) => {
      setCancellationPreview({
        refund: result.preview.estimatedRefundAmountCents,
        penalty: result.preview.estimatedPenaltyAmountCents,
        staffActionRequired: result.preview.staffActionRequired,
        warnings: result.preview.warnings,
      })
      setState({
        trip: { envelope: result.envelope, components: result.components },
        message: "Cancellation preview ready",
        error: null,
      })
    },
    onError: (error) => showError(error),
  })

  const isBusy =
    commitMutation.isPending ||
    reserveMutation.isPending ||
    cancellationMutation.isPending ||
    removeComponentMutation.isPending ||
    updateComponentSetupMutation.isPending

  function handleAddVertical(kind: PendingVerticalKind) {
    setPending((current) => [...current, newPendingComponent(kind)])
  }

  function updatePending(next: PendingComponent) {
    setPending((current) => current.map((p) => (p.localId === next.localId ? next : p)))
  }

  function removePending(localId: string) {
    setPending((current) => current.filter((p) => p.localId !== localId))
  }

  function toggleCancellationSelection(componentId: string, checked: boolean) {
    setCancellationPreview(null)
    setSelectedCancellationIds((current) =>
      checked
        ? [...new Set([...current, componentId])]
        : current.filter((id) => id !== componentId),
    )
  }

  function updateComponentBookingSetup(component: TripComponent, setup: ComponentBookingSetup) {
    const metadata = metadataWithComponentBookingSetup(component, setup)
    updateComponentSetupMutation.mutate({ componentId: component.id, metadata })
  }

  function commitPending(component: PendingComponent) {
    const overlap = findOverlappingComponent(component, components)
    if (overlap) {
      setPending((current) =>
        current.map((p) =>
          p.localId === component.localId
            ? {
                ...p,
                commitError: `These dates overlap with "${componentTitleFor(overlap)}". Adjust the schedule before adding to the trip.`,
              }
            : p,
        ),
      )
      return
    }
    setCommittingLocalId(component.localId)
    setPending((current) =>
      current.map((p) => (p.localId === component.localId ? { ...p, commitError: null } : p)),
    )
    commitMutation.mutate(component)
  }

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">Trip composer</h1>
        <p className="text-muted-foreground text-sm">
          Build one customer-facing itinerary while each vertical keeps its own booking or order.
        </p>
      </header>

      {state.error ? (
        <StatusAlert title="Request failed" message={state.error} tone="error" />
      ) : null}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          <Section title="Billing">
            <PersonPickerSection value={billing} onChange={setBilling} />
          </Section>

          <TripTravelersSection
            value={travelers}
            onChange={setTravelers}
            billingPersonId={billing.mode === "existing" ? billing.personId || null : null}
          />

          <div className="flex flex-col gap-3">
            <h2 className="font-medium text-base">Itinerary</h2>
            {components.length === 0 && pending.length === 0 ? <ComponentsEmpty /> : null}
            {components.map((component, index) => (
              <CommittedComponentCard
                key={component.id}
                component={component}
                index={index}
                selectable={trapReserved}
                selected={selectedCancellationIds.includes(component.id)}
                onSelectedChange={(checked) => toggleCancellationSelection(component.id, checked)}
                onRemove={
                  trapReserved ? undefined : () => removeComponentMutation.mutate(component.id)
                }
                removePending={
                  removeComponentMutation.isPending &&
                  removeComponentMutation.variables === component.id
                }
                bookingSetupEditable={!trapReserved}
                bookingSetupSaving={
                  updateComponentSetupMutation.isPending &&
                  updateComponentSetupMutation.variables?.componentId === component.id
                }
                onBookingSetupChange={updateComponentBookingSetup}
              />
            ))}
            {pending.map((entry) => (
              <PendingComponentCard
                key={entry.localId}
                pending={entry}
                onChange={updatePending}
                onRemove={() => removePending(entry.localId)}
                onCommit={() => commitPending(entry)}
                committing={committingLocalId === entry.localId && commitMutation.isPending}
                travelers={travelers}
              />
            ))}
            <AddComponentMenu onAdd={handleAddVertical} disabled={isBusy} />
          </div>

          {trapReserved && selectedCount > 0 ? (
            <Section
              title={`Cancel ${selectedCount} component${selectedCount === 1 ? "" : "s"}`}
              description="Preview the refund / penalty before confirming."
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCancellationIds([])
                    setCancellationPreview(null)
                  }}
                >
                  Clear selection
                </Button>
              }
            >
              <Field label="Reason">
                <Textarea
                  rows={2}
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                />
              </Field>
              <Button
                variant="outline"
                onClick={() => cancellationMutation.mutate()}
                disabled={isBusy || !envelopeId}
              >
                {cancellationMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                Preview cancellation
              </Button>
              {cancellationPreview ? (
                <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
                  <CancellationRow
                    label="Estimated refund"
                    value={formatMoney(cancellationPreview.refund, paymentCurrency)}
                  />
                  <CancellationRow
                    label="Estimated penalty"
                    value={formatMoney(cancellationPreview.penalty, paymentCurrency)}
                  />
                  <CancellationRow
                    label="Staff action"
                    value={cancellationPreview.staffActionRequired ? "required" : "not required"}
                  />
                  {cancellationPreview.warnings.length > 0 ? (
                    <p className="text-amber-600 text-xs">
                      {cancellationPreview.warnings.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Section>
          ) : null}

          <Section title="Internal notes" description="Visible to staff only.">
            <Field label="Notes">
              <Textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything the operator should know about this trip"
              />
            </Field>
          </Section>

          <Section title="Payment">
            <Field label="Payment currency">
              <CurrencyCombobox
                value={paymentCurrency}
                onChange={(value) => setPaymentCurrency(value ?? defaultPaymentCurrency)}
              />
            </Field>
          </Section>

          <Section title="On reserve" description="Status applied to each underlying booking.">
            <CheckboxRow
              id="composer-create-as-draft"
              checked={createAsDraft}
              onCheckedChange={setCreateAsDraft}
              label="Start bookings in draft status"
              hint="Otherwise the booking lands in Awaiting payment based on whether any payment is already marked paid."
            />
          </Section>

          <PrimaryAction
            status={trip?.envelope.status}
            componentCount={components.length}
            isBusy={isBusy}
            pricePending={commitMutation.isPending}
            reservePending={reserveMutation.isPending}
            onReserve={() => reserveMutation.mutate()}
          />
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4">
          <TripPreviewRail
            trip={trip}
            pendingCount={pending.length}
            travelers={travelers}
            billing={billing}
            billingPersonId={billing.mode === "existing" ? billing.personId || null : null}
            voucher={voucher}
            onVoucherChange={setVoucher}
            paymentCurrency={paymentCurrency}
          />
        </aside>
      </div>
    </main>
  )
}

function CheckboxRow({
  id,
  checked,
  onCheckedChange,
  label,
  hint,
}: {
  id: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="cursor-pointer text-sm">
          {label}
        </Label>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
    </div>
  )
}

function CancellationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function formatMoney(amountCents: number | null | undefined, currency: string) {
  if (amountCents == null) return "-"
  return (amountCents / 100).toLocaleString(undefined, { style: "currency", currency })
}

type ComponentPaymentScheduleRow = {
  scheduleType: "deposit" | "installment" | "balance" | "hold" | "other"
  status: "pending" | "due" | "paid" | "waived" | "cancelled" | "expired"
  dueDate: string
  currency: string
  amountCents: number
  notes?: string | null
}

function metadataWithComponentBookingSetup(
  component: TripComponent,
  setup: ComponentBookingSetup,
): Record<string, unknown> {
  const metadata = { ...(readRecord(component.metadata) ?? {}) }
  const bookingDraft = { ...(readRecord(metadata.bookingDraftV1) ?? {}) }
  const documentGeneration = {
    contractDocument: setup.generateContractDocument,
    invoiceDocument: setup.generateInvoiceDocument,
  }
  metadata.bookingSetup = {
    paymentSchedule: setup.paymentSchedule,
    documentGeneration,
  }
  metadata.bookingDraftV1 = {
    ...bookingDraft,
    paymentSchedules: paymentScheduleToRows(
      setup.paymentSchedule,
      component.componentCurrency || defaultPaymentCurrency,
      component.componentTotalAmountCents ?? null,
    ),
    documentGeneration,
  }
  return metadata
}

function paymentScheduleToRows(
  value: PaymentScheduleValue,
  scheduleCurrency: string,
  totalAmountCents: number | null,
): ComponentPaymentScheduleRow[] {
  if (value.mode === "full") {
    if (!value.fullDueDate || totalAmountCents === null) return []
    return [
      {
        scheduleType: "balance",
        status: value.fullAlreadyPaid ? "paid" : "due",
        dueDate: value.fullDueDate,
        currency: scheduleCurrency,
        amountCents: totalAmountCents,
        notes: paidScheduleNotes(
          value.fullAlreadyPaid,
          value.fullPaymentDate,
          value.fullPaymentMethod,
          value.fullPaymentReference,
        ),
      },
    ]
  }

  const rows: ComponentPaymentScheduleRow[] = []
  if (value.splitFirstDueDate && value.splitFirstAmountCents != null) {
    rows.push({
      scheduleType: "installment",
      status: value.splitFirstAlreadyPaid ? "paid" : "due",
      dueDate: value.splitFirstDueDate,
      currency: scheduleCurrency,
      amountCents: value.splitFirstAmountCents,
      notes: paidScheduleNotes(
        value.splitFirstAlreadyPaid,
        value.splitFirstPaymentDate,
        value.splitFirstPaymentMethod,
        value.splitFirstPaymentReference,
      ),
    })
  }
  if (value.splitSecondDueDate && value.splitSecondAmountCents != null) {
    rows.push({
      scheduleType: "installment",
      status: value.splitSecondAlreadyPaid ? "paid" : "due",
      dueDate: value.splitSecondDueDate,
      currency: scheduleCurrency,
      amountCents: value.splitSecondAmountCents,
      notes: paidScheduleNotes(
        value.splitSecondAlreadyPaid,
        value.splitSecondPaymentDate,
        value.splitSecondPaymentMethod,
        value.splitSecondPaymentReference,
      ),
    })
  }
  return rows
}

function paidScheduleNotes(
  alreadyPaid: boolean,
  paymentDate: string | null,
  paymentMethod: string,
  paymentReference: string,
): string | null {
  if (!alreadyPaid) return null
  return [
    "Marked paid in trip composer",
    paymentDate ? `date: ${paymentDate}` : null,
    paymentMethod ? `method: ${paymentMethod}` : null,
    paymentReference.trim() ? `reference: ${paymentReference.trim()}` : null,
  ]
    .filter(Boolean)
    .join("; ")
}

function pendingToAddInput(
  pending: PendingComponent,
  ctx: {
    billing: PersonPickerValue
    travelers: TripTraveler[]
    payerName: string
    payerEmail: string
    paymentCurrency: string
  },
): AddTripComponentBody | null {
  const billingPayload = serializeBilling(ctx.billing, ctx.payerName, ctx.payerEmail)
  const travelersPayload = serializeTravelersForBookingDraft(ctx.travelers)
  const paxAdult = countAdults(ctx.travelers) || 1

  if (pending.kind === "product" || pending.kind === "stay") {
    if (!pending.catalogEntityId || !pending.catalogSourceKind) return null
    const vertical = pending.kind === "stay" ? "hospitality" : "products"
    const draft = pending.bookingDraft
    const configure = {
      ...(draft?.configure ?? {}),
      pax: {
        ...(draft?.configure.pax ?? {}),
        adult: paxAdult,
      },
    }
    if (pending.startsAt) {
      configure.departureDate = pending.startsAt.slice(0, 10)
    }
    if (pending.startsAt && pending.endsAt) {
      configure.dateRange = {
        checkIn: pending.startsAt.slice(0, 10),
        checkOut: pending.endsAt.slice(0, 10),
      }
    }
    return {
      kind: "catalog_booking",
      catalogRef: {
        entityModule: vertical,
        entityId: pending.catalogEntityId,
        sourceKind: pending.catalogSourceKind,
        ...(pending.catalogSourceConnectionId
          ? { sourceConnectionId: pending.catalogSourceConnectionId }
          : {}),
        ...(pending.catalogSourceRef ? { sourceRef: pending.catalogSourceRef } : {}),
      },
      metadata: {
        scheduledStartsAt: pending.startsAt || null,
        scheduledEndsAt: pending.endsAt || null,
        catalogItem: {
          vertical,
          name: pending.catalogEntityName,
          thumbnailUrl: pending.catalogThumbnailUrl,
          sourceKind: pending.catalogSourceKind,
          sourceConnectionId: pending.catalogSourceConnectionId,
          sourceRef: pending.catalogSourceRef,
        },
        bookingDraftV1: {
          ...(draft ?? {}),
          entity: draft?.entity ?? {
            module: vertical,
            id: pending.catalogEntityId,
            sourceKind: pending.catalogSourceKind,
            ...(pending.catalogSourceConnectionId
              ? { sourceConnectionId: pending.catalogSourceConnectionId }
              : {}),
            ...(pending.catalogSourceRef ? { sourceRef: pending.catalogSourceRef } : {}),
          },
          configure,
          billing: billingPayload,
          travelers: travelersPayload,
          payment: draft?.payment ?? { intent: "hold" },
        },
      },
    }
  }

  if (pending.kind === "flight") {
    const pricing = flightPricingFromPending(pending)
    const firstItinerary = pending.selectedOffer?.itineraries[0]
    const lastItinerary =
      pending.selectedOffer?.itineraries[pending.selectedOffer.itineraries.length - 1]
    const firstSegment = firstItinerary?.segments[0]
    const lastSegment = lastItinerary?.segments[lastItinerary.segments.length - 1]
    return {
      kind: "flight_placeholder",
      description: undefined,
      estimatedPricing: {
        currency: pricing.currency,
        subtotalAmountCents: pricing.subtotalAmountCents,
        taxAmountCents: pricing.taxAmountCents,
        totalAmountCents: pricing.totalAmountCents,
      },
      metadata: {
        scheduledStartsAt: firstSegment?.departure.at ?? pending.departDate ?? null,
        scheduledEndsAt: lastSegment?.arrival.at ?? pending.returnDate ?? null,
        flightDraft: {
          origin: pending.origin,
          destination: pending.destination,
          departDate: pending.departDate,
          returnDate: pending.returnDate || null,
          tripType: pending.tripType,
          cabin: pending.cabin,
          offerId: pending.selectedOffer?.offerId ?? null,
          source: pending.selectedOffer?.source ?? null,
          selectedOffer: pending.selectedOffer,
          ancillaries: {
            fareBundle: pending.fareBundlePicks,
            baggage: pending.baggagePicks,
            assistance: pending.assistancePicks,
            extras: pending.extrasPicks,
          },
          pricing,
        },
      },
    }
  }

  if (pending.kind === "cruise") {
    const amountCents = parseAmountCents(pending.estimatedAmount)
    return {
      kind: "manual_placeholder",
      description: pending.description || undefined,
      estimatedPricing: pricingFromAmount(amountCents, ctx.paymentCurrency),
      metadata: {
        scheduledStartsAt: pending.embarkationDate || null,
        scheduledEndsAt: null,
        cruiseDraft: {
          cabin: pending.cabin || null,
          embarkationDate: pending.embarkationDate || null,
        },
      },
    }
  }

  const totals = computePlaceholderTotals(pending.subtotalCents, pending.taxRatePct)
  return {
    kind: "manual_placeholder",
    description: pending.description || undefined,
    estimatedPricing: {
      currency: pending.currency,
      subtotalAmountCents: totals.subtotal,
      taxAmountCents: totals.tax,
      totalAmountCents: totals.total,
    },
    metadata: {
      scheduledStartsAt: pending.startsAt || null,
      scheduledEndsAt: pending.endsAt || null,
      manualService: {
        name: pending.name,
      },
      taxRatePct: pending.taxRatePct || null,
      template: pending.kind,
    },
  }
}

function pricingFromAmount(amountCents: number, pricingCurrency: string) {
  return {
    currency: pricingCurrency,
    subtotalAmountCents: amountCents,
    taxAmountCents: 0,
    totalAmountCents: amountCents,
  }
}

function parseAmountCents(raw: string): number {
  const parsed = Number.parseFloat(raw || "0")
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0
}

function countAdults(travelers: TripTraveler[]): number {
  return travelers.filter((t) => t.role === "lead" || t.role === "adult").length
}

function serializeBilling(
  billing: PersonPickerValue,
  payerNameFallback?: string,
  payerEmailFallback?: string,
) {
  if (billing.mode === "new") {
    return {
      buyerType: billing.billTo === "organization" ? "B2B" : "B2C",
      contact: {
        firstName: billing.newPerson.firstName.trim(),
        lastName: billing.newPerson.lastName.trim(),
        email: billing.newPerson.email.trim(),
        phone: billing.newPerson.phone || undefined,
      },
      address: {},
    }
  }
  // For an existing person we still need a contact block — the booking engine
  // validates `billing.contact` even when an id is present. Names/emails come
  // from the resolved person (payerName / payerEmail).
  const [firstName, ...rest] = (payerNameFallback ?? "").trim().split(/\s+/)
  return {
    buyerType: billing.billTo === "organization" ? "B2B" : "B2C",
    ...(billing.personId ? { personId: billing.personId } : {}),
    ...(billing.organizationId ? { organizationId: billing.organizationId } : {}),
    contact: {
      firstName: firstName || "",
      lastName: rest.join(" ") || "",
      email: payerEmailFallback || "",
    },
    address: {},
  }
}

function assertTripCreationRequirements(ctx: {
  billing: PersonPickerValue
  travelers: TripTraveler[]
  payerName: string
  payerEmail: string
}) {
  const errors: string[] = []
  if (ctx.billing.mode === "new") {
    if (!ctx.billing.newPerson.firstName.trim() || !ctx.billing.newPerson.lastName.trim()) {
      errors.push("billing contact name")
    }
    if (!isRealTripEmail(ctx.billing.newPerson.email)) {
      errors.push("billing email")
    }
  } else {
    const hasBillingRecord =
      ctx.billing.billTo === "organization"
        ? Boolean(ctx.billing.organizationId)
        : Boolean(ctx.billing.personId)
    if (!hasBillingRecord) errors.push("billing person or organization")
    if (!ctx.payerName.trim()) errors.push("billing contact name")
    if (!isRealTripEmail(ctx.payerEmail)) errors.push("billing email")
  }

  if (ctx.travelers.length === 0) {
    errors.push("at least one traveler")
  }
  ctx.travelers.forEach((traveler, index) => {
    if (!traveler.personId && (!traveler.firstName.trim() || !traveler.lastName.trim())) {
      errors.push(`traveler ${index + 1} name`)
    }
    if (traveler.email && !isRealTripEmail(traveler.email)) {
      errors.push(`traveler ${index + 1} email`)
    }
  })

  if (errors.length > 0) {
    throw new Error(`Complete ${errors.join(", ")} before creating the trip.`)
  }
}

function isRealTripEmail(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false
  return !["noreply@example.com", "tbd@example.com", "traveler@example.com"].includes(normalized)
}

function hydrateBilling(travelerParty: Record<string, unknown>): PersonPickerValue {
  const billing = readRecord(travelerParty.billing)
  if (!billing) return emptyPersonPickerValue
  const contact = readRecord(billing.contact)
  const personId = stringFromRecord(billing, "personId") ?? ""
  const organizationId = stringFromRecord(billing, "organizationId") ?? null
  const billTo =
    organizationId || stringFromRecord(billing, "buyerType") === "B2B" ? "organization" : "person"
  if (personId || organizationId) {
    return {
      billTo,
      mode: "existing",
      personId,
      organizationId,
      newPerson: emptyPersonPickerValue.newPerson,
    }
  }
  return {
    billTo,
    mode: "new",
    personId: "",
    organizationId,
    newPerson: {
      firstName: stringFromRecord(contact, "firstName") ?? "",
      lastName: stringFromRecord(contact, "lastName") ?? "",
      email: stringFromRecord(contact, "email") ?? "",
      phone: stringFromRecord(contact, "phone") ?? "",
    },
  }
}

function hydrateTravelers(travelerParty: Record<string, unknown>): TripTraveler[] {
  const travelers = travelerParty.travelers
  if (!Array.isArray(travelers)) return []
  return travelers.filter(readRecord).map((traveler, index) => ({
    localId: stringFromRecord(traveler, "localId") ?? `tt_existing_${index}`,
    personId: stringFromRecord(traveler, "personId") ?? null,
    firstName: stringFromRecord(traveler, "firstName") ?? "",
    lastName: stringFromRecord(traveler, "lastName") ?? "",
    email: stringFromRecord(traveler, "email") ?? "",
    dateOfBirth: stringFromRecord(traveler, "dateOfBirth") ?? null,
    role: tripTravelerRoleFromStored(stringFromRecord(traveler, "role"), index),
  }))
}

function hydrateVoucher(travelerParty: Record<string, unknown>): VoucherPickerValue {
  const voucher = readRecord(travelerParty.voucher)
  if (!voucher) return emptyVoucherPickerValue
  const id = stringFromRecord(voucher, "id")
  const code = stringFromRecord(voucher, "code")
  const currencyCode = stringFromRecord(voucher, "currency")
  const remainingAmountCents = numberFromRecord(voucher, "remainingAmountCents")
  if (!id || !code || !currencyCode || remainingAmountCents == null) return emptyVoucherPickerValue
  return {
    code,
    picked: {
      id,
      code,
      label: null,
      currency: currencyCode,
      remainingAmountCents,
      expiresAt: null,
    },
    error: null,
  }
}

function tripTravelerRoleFromStored(
  value: string | undefined,
  index: number,
): TripTraveler["role"] {
  if (value === "lead" || value === "adult" || value === "child" || value === "infant") {
    return value
  }
  return index === 0 ? "lead" : "adult"
}

// Map our roster shape onto the catalog booking engine's `travelerEntryV1`:
// drop empty/null fields it can't validate, translate `role` (lead/adult/...)
// into `band` (adult/child/infant) + `isPrimary`.
function serializeTravelersForBookingDraft(travelers: TripTraveler[]) {
  return travelers.map((traveler) => {
    const band: "adult" | "child" | "infant" =
      traveler.role === "child" ? "child" : traveler.role === "infant" ? "infant" : "adult"
    const firstName = traveler.firstName.trim()
    const lastName = traveler.lastName.trim()
    const email = traveler.email.trim()
    const dateOfBirth = traveler.dateOfBirth?.trim() || ""
    const entry: Record<string, unknown> = {
      firstName: firstName || "Traveler",
      lastName: lastName || "Guest",
      band,
    }
    if (email) entry.email = email
    if (dateOfBirth) entry.dateOfBirth = dateOfBirth
    if (traveler.role === "lead") entry.isPrimary = true
    return entry
  })
}

function failuresToString(
  failures:
    | { reason: string; code?: string; details?: Record<string, unknown> | undefined }[]
    | undefined,
) {
  if (!failures || failures.length === 0) return null
  if (failures.some((failure) => failure.code === "price_changed")) {
    return "Prices changed. Review the updated totals, then reserve again."
  }
  if (failures.some((failure) => failure.code === "expired")) {
    return "One or more offers expired. Refresh the component and choose a current option."
  }
  if (failures.some((failure) => failure.code === "unavailable")) {
    return "One or more components are no longer available. Review the itinerary before reserving."
  }
  return failures.map((failure) => failure.reason).join(", ")
}

function apiError(error: unknown): string {
  const candidate = error as Partial<VoyantApiError>
  if (typeof candidate.message === "string") return candidate.message
  return error instanceof Error ? error.message : "Request failed"
}

function derivePayerName(
  billing: PersonPickerValue,
  person:
    | { firstName?: string | null; lastName?: string | null; email?: string | null }
    | undefined,
): string {
  if (billing.mode === "new") {
    const name = [billing.newPerson.firstName, billing.newPerson.lastName]
      .filter((part) => part.trim().length > 0)
      .join(" ")
      .trim()
    return name || billing.newPerson.email.trim() || "Traveler"
  }
  if (person) {
    const name = [person.firstName, person.lastName]
      .filter((part) => (part ?? "").trim().length > 0)
      .join(" ")
      .trim()
    return name || (person.email ?? "") || "Traveler"
  }
  return "Traveler"
}

function derivePayerEmail(
  billing: PersonPickerValue,
  person: { email?: string | null } | undefined,
): string {
  if (billing.mode === "new") {
    return billing.newPerson.email.trim()
  }
  return person?.email ?? ""
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function stringFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = record?.[key]
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function numberFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
): number | undefined {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function booleanFromRecord(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true
}
