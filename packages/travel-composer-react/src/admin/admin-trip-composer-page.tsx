"use client"

import { useMutation } from "@tanstack/react-query"
import { useOperatorAdminMessages as useAdminMessages, useAdminNavigate } from "@voyantjs/admin"
import { emptyPersonPickerValue } from "@voyantjs/bookings-react/components/person-picker-section"
import { emptyVoucherPickerValue } from "@voyantjs/bookings-react/components/voucher-picker-section"
import {
  PersonPickerSection,
  type PersonPickerValue,
  type VoucherPickerValue,
} from "@voyantjs/bookings-react/ui"
import { usePerson } from "@voyantjs/relationships-react"
import type { Trip, TripComponent } from "@voyantjs/travel-composer"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { useEffect, useMemo, useState } from "react"
import {
  addTripComponent,
  createTrip,
  getTrip,
  previewTripCancellation,
  priceTrip,
  removeTripComponent,
  reserveTrip,
  startTripCheckout,
  updateTripComponent,
} from "../operations.js"
import { useVoyantTravelComposerContext } from "../provider.js"
import {
  type CancellationPreview,
  CancellationPreviewSection,
  CheckboxRow,
} from "./admin-trip-composer-page-controls.js"
import {
  apiError,
  assertTripCreationRequirements,
  booleanFromRecord,
  defaultPaymentCurrency,
  derivePayerEmail,
  derivePayerName,
  failuresToString,
  hydrateBilling,
  hydrateTravelers,
  hydrateVoucher,
  metadataWithComponentBookingSetup,
  pendingToAddInput,
  serializeBilling,
  stringFromRecord,
} from "./admin-trip-composer-page-model.js"
import {
  AddComponentMenu,
  CommittedComponentCard,
  type ComponentBookingSetup,
  ComponentsEmpty,
  componentTitleFor,
  Field,
  findOverlappingComponent,
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
} from "./admin-trip-composer-panels.js"

interface ComposerState {
  trip: Trip | null
  message: string | null
  error: string | null
}

export interface AdminTripComposerPageProps {
  initialTrip?: Trip | null
}

export function AdminTripComposerPage({
  initialTrip = null,
}: AdminTripComposerPageProps): React.ReactElement {
  const navigateTo = useAdminNavigate()
  const t = useAdminMessages().trips.adminComposer
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
  const [cancellationReason, setCancellationReason] = useState(t.cancellation.defaultReason)
  const [cancellationPreview, setCancellationPreview] = useState<CancellationPreview | null>(null)

  const { baseUrl, fetcher } = useVoyantTravelComposerContext()
  const client = useMemo(() => ({ baseUrl, fetcher }), [baseUrl, fetcher])
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
  const payerName = derivePayerName(billing, billingPersonQuery.data, t)
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
    setState((current) => ({ ...current, error: apiError(error, t), message: null }))
  }

  async function ensureTrip(): Promise<Trip> {
    if (state.trip) return state.trip
    assertTripCreationRequirements({ billing, travelers, payerName, payerEmail }, t)
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
      const input = pendingToAddInput(
        component,
        {
          billing,
          travelers,
          payerName,
          payerEmail,
          paymentCurrency,
        },
        t,
      )
      if (!input) throw new Error(t.errors.componentNotReady)
      await addTripComponent(client, currentTrip.envelope.id, input)
      return priceTrip(client, currentTrip.envelope.id, {
        scope: { locale: "en-US", audience: "staff", market: "default", currency: paymentCurrency },
      })
    },
    onSuccess: (result, component) => {
      setPending((current) => current.filter((p) => p.localId !== component.localId))
      setState({
        trip: { envelope: result.envelope, components: result.components },
        message: t.statusMessages.componentAddedAndPriced,
        error: failuresToString(result.failures, t),
      })
      setCancellationPreview(null)
      setCommittingLocalId(null)
    },
    onError: (error, component) => {
      const message = apiError(error, t)
      setPending((current) =>
        current.map((p) => (p.localId === component.localId ? { ...p, commitError: message } : p)),
      )
      setCommittingLocalId(null)
    },
  })

  const reserveMutation = useMutation({
    mutationFn: async () => {
      if (!envelopeId) throw new Error(t.errors.priceTripFirst)
      assertTripCreationRequirements({ billing, travelers, payerName, payerEmail }, t)
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
          ? t.statusMessages.tripReservedWithLink
          : t.statusMessages.tripReserved,
        error: failuresToString(reserved.failures, t),
      })
      // Keep operators in the trip aggregate after reserve; individual booking
      // links remain available from each component card.
      if (reserved.failures.length === 0) {
        navigateTo("trip.detail", { tripId: reserved.envelope.id })
      }
    },
    onError: (error) => showError(error),
  })

  const removeComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      if (!envelopeId) throw new Error(t.errors.noTrip)
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
      setState({ trip: updatedTrip, message: t.statusMessages.componentRemoved, error: null })
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
      if (!envelopeId) throw new Error(t.errors.noTripToCancel)
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
        message: t.statusMessages.cancellationPreviewReady,
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
        <h1 className="font-semibold text-2xl tracking-tight">{t.heading}</h1>
        <p className="text-muted-foreground text-sm">{t.subheading}</p>
      </header>

      {state.error ? (
        <StatusAlert title={t.requestFailed} message={state.error} tone="error" />
      ) : null}

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          <Section title={t.billingSectionTitle}>
            <PersonPickerSection value={billing} onChange={setBilling} />
          </Section>

          <TripTravelersSection
            value={travelers}
            onChange={setTravelers}
            billingPersonId={billing.mode === "existing" ? billing.personId || null : null}
          />

          <div className="flex flex-col gap-3">
            <h2 className="font-medium text-base">{t.itinerarySectionTitle}</h2>
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
            <CancellationPreviewSection
              messages={t}
              selectedCount={selectedCount}
              cancellationReason={cancellationReason}
              onCancellationReasonChange={setCancellationReason}
              cancellationPreview={cancellationPreview}
              paymentCurrency={paymentCurrency}
              isBusy={isBusy}
              hasEnvelope={Boolean(envelopeId)}
              isPending={cancellationMutation.isPending}
              onPreview={() => cancellationMutation.mutate()}
              onClearSelection={() => {
                setSelectedCancellationIds([])
                setCancellationPreview(null)
              }}
            />
          ) : null}

          <Section
            title={t.internalNotesSectionTitle}
            description={t.internalNotesSectionDescription}
          >
            <Field label={t.internalNotesLabel}>
              <Textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t.internalNotesPlaceholder}
              />
            </Field>
          </Section>

          <Section title={t.paymentSectionTitle}>
            <Field label={t.paymentCurrencyLabel}>
              <CurrencyCombobox
                value={paymentCurrency}
                onChange={(value) => setPaymentCurrency(value ?? defaultPaymentCurrency)}
              />
            </Field>
          </Section>

          <Section title={t.onReserveSectionTitle} description={t.onReserveSectionDescription}>
            <CheckboxRow
              id="composer-create-as-draft"
              checked={createAsDraft}
              onCheckedChange={setCreateAsDraft}
              label={t.startInDraftLabel}
              hint={t.startInDraftHint}
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
