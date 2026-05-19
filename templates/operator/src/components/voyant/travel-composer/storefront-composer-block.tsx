"use client"

import { useMutation } from "@tanstack/react-query"
import type { Trip, TripComponent } from "@voyantjs/travel-composer"
import {
  addTripComponent,
  createTrip,
  defaultFetcher,
  getTrip,
  priceTrip,
  reserveTrip,
  startTripCheckout,
  type VoyantApiError,
} from "@voyantjs/travel-composer-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Separator } from "@voyantjs/ui/components/separator"
import { Textarea } from "@voyantjs/ui/components/textarea"
import {
  BedDouble,
  CalendarClock,
  Check,
  CircleAlert,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  Route,
  Sparkles,
} from "lucide-react"
import { useMemo, useState } from "react"

import { getApiUrl } from "@/lib/env"

type ComponentTemplate = "product" | "stay" | "transfer"
type CheckoutIntent = "card" | "bank_transfer" | "hold" | "inquiry"

interface ComposerTripState {
  trip: Trip | null
  message: string | null
  error: string | null
}

const currency = "EUR"
const referenceTravelerParty = {
  billing: {
    buyerType: "B2C",
    contact: {
      firstName: "Mira",
      lastName: "Ionescu",
      email: "mira.ionescu@pixelmakers.com",
    },
    address: {},
  },
  travelers: [
    {
      localId: "traveler_1",
      firstName: "Mira",
      lastName: "Ionescu",
      email: "mira.ionescu@pixelmakers.com",
      role: "lead",
    },
  ],
}

export function StorefrontComposerBlock(): React.ReactElement {
  const [state, setState] = useState<ComposerTripState>({
    trip: null,
    message: null,
    error: null,
  })
  const [template, setTemplate] = useState<ComponentTemplate>("product")
  const [componentTitle, setComponentTitle] = useState("Bucharest to Istanbul")
  const [entityId, setEntityId] = useState("")
  const [sourceKind, setSourceKind] = useState("owned")
  const [manualAmount, setManualAmount] = useState("95")
  const [notes, setNotes] = useState("5 days, 2 travelers")
  const [checkoutIntent, setCheckoutIntent] = useState<CheckoutIntent>("card")

  const client = useMemo(
    () => ({
      baseUrl: getApiUrl(),
      fetcher: defaultFetcher,
      surface: "public" as const,
    }),
    [],
  )
  const envelopeId = state.trip?.envelope.id

  const createMutation = useMutation({
    mutationFn: () =>
      createTrip(client, {
        title: "Composed trip",
        description: notes,
        travelerParty: referenceTravelerParty,
        constraints: { channel: "storefront-reference" },
      }),
    onSuccess: (trip) => setState({ trip, message: "Trip created", error: null }),
    onError: (error) => setState((current) => ({ ...current, error: apiError(error) })),
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const trip =
        state.trip ??
        (await createTrip(client, {
          title: "Composed trip",
          travelerParty: referenceTravelerParty,
          constraints: { channel: "storefront-reference" },
        }))
      const component = await addTripComponent(client, trip.envelope.id, componentInput())
      const refreshed = await getTrip(client, trip.envelope.id)
      return { component, trip: refreshed }
    },
    onSuccess: ({ trip }) => setState({ trip, message: "Component added", error: null }),
    onError: (error) => setState((current) => ({ ...current, error: apiError(error) })),
  })

  const priceMutation = useMutation({
    mutationFn: async () => {
      if (!envelopeId) throw new Error("Create a trip first")
      return priceTrip(client, envelopeId, {
        scope: { locale: "en-GB", audience: "customer", market: "default", currency },
      })
    },
    onSuccess: (result) =>
      setState({
        trip: { envelope: result.envelope, components: result.components },
        message: "Trip priced",
        error: result.failures.length > 0 ? result.failures.map((f) => f.reason).join(", ") : null,
      }),
    onError: (error) => setState((current) => ({ ...current, error: apiError(error) })),
  })

  const reserveMutation = useMutation({
    mutationFn: async () => {
      if (!envelopeId) throw new Error("Price the trip first")
      return reserveTrip(client, envelopeId, {
        idempotencyKey: `reserve-${envelopeId}`,
      })
    },
    onSuccess: (result) =>
      setState({
        trip: { envelope: result.envelope, components: result.components },
        message: "Trip reserved",
        error: result.failures.length > 0 ? result.failures.map((f) => f.reason).join(", ") : null,
      }),
    onError: (error) => setState((current) => ({ ...current, error: apiError(error) })),
  })

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!envelopeId) throw new Error("Reserve the trip first")
      return startTripCheckout(client, envelopeId, {
        intent: checkoutIntent,
        idempotencyKey: `checkout-${envelopeId}-${checkoutIntent}`,
        request: {
          returnOrigin: window.location.origin,
        },
      })
    },
    onSuccess: (result) => {
      setState({
        trip: { envelope: result.envelope, components: result.components },
        message: handoffMessage(result.target.checkoutUrl, result.target.paymentSessionId),
        error: result.failures.length > 0 ? result.failures.map((f) => f.reason).join(", ") : null,
      })
      if (result.target.checkoutUrl) {
        window.location.assign(result.target.checkoutUrl)
      }
    },
    onError: (error) => setState((current) => ({ ...current, error: apiError(error) })),
  })

  const trip = state.trip
  const components = trip?.components ?? []
  const aggregate = trip?.envelope.aggregatePricingSnapshot
  const isBusy =
    createMutation.isPending ||
    addMutation.isPending ||
    priceMutation.isPending ||
    reserveMutation.isPending ||
    checkoutMutation.isPending

  function componentInput() {
    const amountCents = Math.max(0, Math.round(Number.parseFloat(manualAmount || "0") * 100))
    if (template === "transfer") {
      return {
        kind: "manual_placeholder" as const,
        description: "Staff-confirmed ground transfer",
        estimatedPricing: {
          currency,
          subtotalAmountCents: amountCents,
          taxAmountCents: 0,
          totalAmountCents: amountCents,
        },
        metadata: { manualService: { name: componentTitle || "Transfer" }, template: "manual" },
      }
    }

    return {
      kind: "catalog_booking" as const,
      description: template === "stay" ? "Catalog-backed stay component" : "Catalog-backed tour",
      catalogRef: {
        entityModule: template === "stay" ? "hospitality" : "products",
        entityId,
        sourceKind: sourceKind || "owned",
      },
      metadata: {
        bookingDraftV1: {
          entity: {
            module: template === "stay" ? "hospitality" : "products",
            id: entityId,
            sourceKind: sourceKind || "owned",
          },
          configure:
            template === "stay"
              ? {
                  pax: { adult: 2 },
                  dateRange: { checkIn: "2026-06-05", checkOut: "2026-06-08" },
                }
              : { pax: { adult: 2 } },
          billing: {
            buyerType: "B2C",
            contact: {
              firstName: "Mira",
              lastName: "Ionescu",
              email: "mira.ionescu@pixelmakers.com",
            },
            address: {},
          },
          travelers: referenceTravelerParty.travelers,
          payment: { intent: checkoutIntent },
        },
      },
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Route className="size-6 text-primary" aria-hidden="true" />
            <h1 className="font-semibold text-3xl tracking-tight">Build a trip</h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            Bundle tours, stays, and staff-confirmed services into one checkout.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => createMutation.mutate()} disabled={isBusy || Boolean(trip)}>
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            New trip
          </Button>
          <Button
            variant="outline"
            onClick={() => priceMutation.mutate()}
            disabled={isBusy || components.length === 0}
          >
            <CalendarClock className="size-4" aria-hidden="true" />
            Price
          </Button>
          <Button
            variant="outline"
            onClick={() => reserveMutation.mutate()}
            disabled={isBusy || trip?.envelope.status !== "priced"}
          >
            <Check className="size-4" aria-hidden="true" />
            Reserve
          </Button>
          <Button
            onClick={() => checkoutMutation.mutate()}
            disabled={isBusy || trip?.envelope.status !== "reserved"}
          >
            <CreditCard className="size-4" aria-hidden="true" />
            Checkout
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <ComposerForm
            template={template}
            setTemplate={setTemplate}
            componentTitle={componentTitle}
            setComponentTitle={setComponentTitle}
            entityId={entityId}
            setEntityId={setEntityId}
            sourceKind={sourceKind}
            setSourceKind={setSourceKind}
            manualAmount={manualAmount}
            setManualAmount={setManualAmount}
            notes={notes}
            setNotes={setNotes}
            checkoutIntent={checkoutIntent}
            setCheckoutIntent={setCheckoutIntent}
            onAdd={() => addMutation.mutate()}
            addDisabled={isBusy || (template !== "transfer" && !entityId)}
            addPending={addMutation.isPending}
          />

          <div className="space-y-3">
            {components.length === 0 ? (
              <EmptyTimeline />
            ) : (
              components.map((component, index) => (
                <ComponentCard key={component.id} component={component} index={index} />
              ))
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trip summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <SummaryCell label="Status" value={trip?.envelope.status ?? "not started"} />
                <SummaryCell label="Items" value={String(components.length)} />
                <SummaryCell
                  label="Subtotal"
                  value={formatMoney(aggregate?.subtotalAmountCents, aggregate?.currency)}
                />
                <SummaryCell
                  label="Tax"
                  value={formatMoney(aggregate?.taxAmountCents, aggregate?.currency)}
                />
              </div>
              <Separator />
              <div className="flex items-end justify-between gap-3">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="font-semibold text-2xl">
                  {formatMoney(aggregate?.totalAmountCents, aggregate?.currency)}
                </span>
              </div>
              {state.message ? (
                <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-emerald-700 text-sm dark:text-emerald-300">
                  {state.message}
                </p>
              ) : null}
              {state.error ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
                  {state.error}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function ComposerForm({
  template,
  setTemplate,
  componentTitle,
  setComponentTitle,
  entityId,
  setEntityId,
  sourceKind,
  setSourceKind,
  manualAmount,
  setManualAmount,
  notes,
  setNotes,
  checkoutIntent,
  setCheckoutIntent,
  onAdd,
  addDisabled,
  addPending,
}: {
  template: ComponentTemplate
  setTemplate(value: ComponentTemplate): void
  componentTitle: string
  setComponentTitle(value: string): void
  entityId: string
  setEntityId(value: string): void
  sourceKind: string
  setSourceKind(value: string): void
  manualAmount: string
  setManualAmount(value: string): void
  notes: string
  setNotes(value: string): void
  checkoutIntent: CheckoutIntent
  setCheckoutIntent(value: CheckoutIntent): void
  onAdd(): void
  addDisabled: boolean
  addPending: boolean
}): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add component</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={template} onValueChange={(value) => setTemplate(value as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Tour product</SelectItem>
                <SelectItem value="stay">Stay</SelectItem>
                <SelectItem value="transfer">Manual transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Title</Label>
            <Input
              value={componentTitle}
              onChange={(event) => setComponentTitle(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {template === "transfer" ? (
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                inputMode="decimal"
                value={manualAmount}
                onChange={(event) => setManualAmount(event.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label>Catalog ID</Label>
                <Input value={entityId} onChange={(event) => setEntityId(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={sourceKind} onChange={(event) => setSourceKind(event.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Payment</Label>
            <Select
              value={checkoutIntent}
              onValueChange={(value) => setCheckoutIntent(value as never)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
                <SelectItem value="inquiry">Inquiry</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Trip notes</Label>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        <Button onClick={onAdd} disabled={addDisabled}>
          {addPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          Add to trip
        </Button>
      </CardContent>
    </Card>
  )
}

function EmptyTimeline(): React.ReactElement {
  return (
    <div className="rounded-lg border border-dashed px-6 py-12 text-center">
      <Route className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">No trip components yet</p>
    </div>
  )
}

function ComponentCard({
  component,
  index,
}: {
  component: TripComponent
  index: number
}): React.ReactElement {
  const Icon =
    component.kind === "manual_placeholder"
      ? Landmark
      : component.entityModule === "hospitality"
        ? BedDouble
        : Route
  return (
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-[48px_minmax(0,1fr)_auto] md:items-center">
        <div className="flex size-12 items-center justify-center rounded-md bg-muted">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{componentDisplayName(component, index)}</span>
            <Badge variant={component.status === "failed" ? "destructive" : "secondary"}>
              {component.status}
            </Badge>
          </div>
          <p className="truncate text-muted-foreground text-sm">
            {component.entityModule
              ? `${component.entityModule} · ${component.entityId}`
              : (component.description ?? component.kind)}
          </p>
          {component.warningCodes.length > 0 ? (
            <p className="flex items-center gap-1 text-amber-600 text-xs">
              <CircleAlert className="size-3" aria-hidden="true" />
              {component.warningCodes.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="text-left md:text-right">
          <p className="font-semibold">
            {formatMoney(component.componentTotalAmountCents, component.componentCurrency)}
          </p>
          <p className="text-muted-foreground text-xs">
            tax {formatMoney(component.componentTaxAmountCents, component.componentCurrency)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function componentDisplayName(component: TripComponent, index: number): string {
  const metadata = component.metadata as
    | {
        manualService?: { name?: string | null }
        flightDraft?: { origin?: string | null; destination?: string | null }
      }
    | undefined
  const manualName = metadata?.manualService?.name?.trim()
  if (manualName) return manualName
  const origin = metadata?.flightDraft?.origin?.trim()
  const destination = metadata?.flightDraft?.destination?.trim()
  if (origin && destination) return `${origin} → ${destination}`
  if (component.entityId) return component.entityId
  return `Component ${index + 1}`
}

function SummaryCell({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function handoffMessage(checkoutUrl: string | null, paymentSessionId: string | null): string {
  if (checkoutUrl) return "Redirecting to payment"
  if (paymentSessionId) return "Payment session started"
  return "Checkout handoff started"
}

function apiError(error: unknown): string {
  const candidate = error as Partial<VoyantApiError>
  if (typeof candidate.message === "string") return candidate.message
  return error instanceof Error ? error.message : "Request failed"
}

function formatMoney(
  amountCents: number | null | undefined,
  currencyCode: string | null | undefined,
) {
  if (amountCents == null) return "-"
  return (amountCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: currencyCode ?? currency,
  })
}
