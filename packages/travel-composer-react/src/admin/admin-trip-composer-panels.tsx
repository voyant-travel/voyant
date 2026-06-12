"use client"

import { useQuery } from "@tanstack/react-query"
import { useOperatorAdminMessages as useAdminMessages } from "@voyantjs/admin"
import { emptyPaymentScheduleValue } from "@voyantjs/bookings-react/components/payment-schedule-section"
import { deriveTravelerRoleFromDob } from "@voyantjs/bookings-react/components/travelers-section"
import {
  type Draft,
  emptyDraft,
  setAccommodation,
  setAddons,
} from "@voyantjs/bookings-react/journey"
import {
  PaymentScheduleSection,
  type PaymentScheduleValue,
  type PersonPickerValue,
  VoucherPickerSection,
  type VoucherPickerValue,
} from "@voyantjs/bookings-react/ui"
import type { BookingDraftShape } from "@voyantjs/catalog/booking-engine"
import { type CatalogSearchHit, useCatalogSearch } from "@voyantjs/catalog-react"
import { useBookingQuote } from "@voyantjs/catalog-react/booking-engine"
import { useOrganization, usePerson, usePersonRelationships } from "@voyantjs/crm-react"
import { PersonCombobox, PersonForm } from "@voyantjs/crm-react/ui"
import type {
  AncillaryCatalog,
  AncillarySelection,
  CabinClass,
  FlightOffer,
  FlightPassenger,
  PassengerCounts,
} from "@voyantjs/flights/contract/types"
import { useFlightAncillaries, useFlightSearch } from "@voyantjs/flights-react"
import {
  AirportCombobox,
  FlightBaggageStep,
  FlightFareUpsellStep,
  FlightOfferRow,
  FlightServicesStep,
} from "@voyantjs/flights-react/ui"
import { formatMessage } from "@voyantjs/i18n"
import type { Trip, TripComponent } from "@voyantjs/travel-composer"
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@voyantjs/ui/components"
import { Alert, AlertDescription, AlertTitle } from "@voyantjs/ui/components/alert"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { CurrencyInput } from "@voyantjs/ui/components/currency-input"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { DateTimeField } from "@voyantjs/ui/components/date-time-field"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@voyantjs/ui/components/empty"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@voyantjs/ui/components/tooltip"
import {
  AlertTriangle,
  BedDouble,
  CalendarClock,
  Check,
  CircleAlert,
  ExternalLink,
  Info,
  Landmark,
  Loader2,
  Minus,
  Pencil,
  Plane,
  Plus,
  Route as RouteIcon,
  Sailboat,
  Trash2,
  UserPlus,
  Wrench,
  X,
} from "lucide-react"
import * as React from "react"

import { useVoyantTravelComposerContext } from "../provider.js"

type CatalogVertical = "products" | "accommodations" | "cruises" | "extras" | "flights"
export type PendingVerticalKind = "product" | "stay" | "flight" | "cruise" | "manual"

type PanelsMessages = ReturnType<typeof useAdminMessages>["trips"]["adminComposer"]["panels"]

interface AvailabilitySlot {
  id: string
  dateLocal: string
  startsAt: string
  endsAt?: string | null
  timezone: string
  status: string
  unlimited: boolean
  remainingPax?: number | null
  initialPax?: number | null
  nights?: number | null
  days?: number | null
}

// Shared shape for the catalog-backed kinds. The vertical isn't stored on
// the pending component itself — it's implied by `kind` (`product` →
// products, `stay` → accommodations). That keeps the menu single-step (no
// secondary picker) and the per-kind catalog query well-scoped.
type CatalogPendingFields = {
  localId: string
  catalogEntityId: string | null
  catalogEntityName: string | null
  catalogSourceKind: string | null
  catalogSourceConnectionId: string | null
  catalogSourceRef: string | null
  catalogThumbnailUrl: string | null
  bookingDraft: Draft | null
  startsAt: string
  endsAt: string
  commitError: string | null
}

export type PendingComponent =
  | ({ kind: "product" } & CatalogPendingFields)
  | ({ kind: "stay" } & CatalogPendingFields)
  | {
      kind: "flight"
      localId: string
      tripType: "one_way" | "round_trip"
      origin: string | null
      destination: string | null
      departDate: string
      returnDate: string
      cabin: CabinClass
      selectedOffer: FlightOffer | null
      ancillaryCatalog: AncillaryCatalog | null
      fareBundlePicks: NonNullable<AncillarySelection["fareBundle"]>
      baggagePicks: NonNullable<AncillarySelection["baggage"]>
      assistancePicks: NonNullable<AncillarySelection["assistance"]>
      extrasPicks: NonNullable<AncillarySelection["extras"]>
      sameFareForAllPassengers: boolean
      sameBaggageBothDirections: boolean
      commitError: string | null
    }
  | {
      kind: "cruise"
      localId: string
      description: string
      cabin: string
      embarkationDate: string
      estimatedAmount: string
      commitError: string | null
    }
  | {
      kind: "manual"
      localId: string
      name: string
      description: string
      currency: string
      subtotalCents: number | null
      taxRatePct: string
      startsAt: string
      endsAt: string
      commitError: string | null
    }

function verticalsFor(messages: PanelsMessages): Array<{
  kind: PendingVerticalKind
  label: string
  description: string
}> {
  const v = messages.verticals
  return [
    { kind: "product", label: v.productLabel, description: v.productDescription },
    { kind: "stay", label: v.stayLabel, description: v.stayDescription },
    { kind: "flight", label: v.flightLabel, description: v.flightDescription },
    { kind: "cruise", label: v.cruiseLabel, description: v.cruiseDescription },
    { kind: "manual", label: v.manualLabel, description: v.manualDescription },
  ]
}

function verticalForKind(kind: "product" | "stay"): CatalogVertical {
  return kind === "stay" ? "accommodations" : "products"
}

function genLocalId() {
  return `pc_${Math.random().toString(36).slice(2, 10)}`
}

function catalogHitLabel(hit: CatalogSearchHit): string {
  return (
    catalogHitStringField(hit, "name") ??
    catalogHitStringField(hit, "title") ??
    catalogHitStringField(hit, "hotel.name") ??
    hit.id
  )
}

function catalogHitSourceKind(hit: CatalogSearchHit): string | null {
  return catalogHitStringField(hit, "source.kind")
}

function catalogHitThumbnailUrl(hit: CatalogSearchHit): string | null {
  return (
    catalogHitStringField(hit, "thumbnailUrl") ??
    catalogHitStringField(hit, "hero_image_url") ??
    catalogHitStringField(hit, "imageUrl")
  )
}

function catalogHitSourceConnectionId(hit: CatalogSearchHit): string | null {
  return (
    catalogHitStringField(hit, "source.connectionId") ??
    catalogHitStringField(hit, "source_connection_id")
  )
}

function catalogHitSourceRef(hit: CatalogSearchHit): string | null {
  return catalogHitStringField(hit, "source.ref") ?? catalogHitStringField(hit, "source_ref")
}

function catalogHitStringField(hit: CatalogSearchHit, field: string): string | null {
  const value = hit.document.fields[field]
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

export function newPendingComponent(kind: PendingVerticalKind): PendingComponent {
  const localId = genLocalId()
  switch (kind) {
    case "product":
    case "stay":
      return {
        kind,
        localId,
        catalogEntityId: null,
        catalogEntityName: null,
        catalogSourceKind: null,
        catalogSourceConnectionId: null,
        catalogSourceRef: null,
        catalogThumbnailUrl: null,
        bookingDraft: null,
        startsAt: "",
        endsAt: "",
        commitError: null,
      }
    case "flight":
      return {
        kind,
        localId,
        tripType: "one_way",
        origin: null,
        destination: null,
        departDate: "",
        returnDate: "",
        cabin: "economy",
        selectedOffer: null,
        ancillaryCatalog: null,
        fareBundlePicks: [],
        baggagePicks: [],
        assistancePicks: [],
        extrasPicks: [],
        sameFareForAllPassengers: true,
        sameBaggageBothDirections: true,
        commitError: null,
      }
    case "cruise":
      return {
        kind,
        localId,
        description: "",
        cabin: "",
        embarkationDate: "",
        estimatedAmount: "",
        commitError: null,
      }
    default:
      return {
        kind,
        localId,
        name: "",
        description: "",
        currency: "EUR",
        subtotalCents: null,
        taxRatePct: "",
        startsAt: "",
        endsAt: "",
        commitError: null,
      }
  }
}

export function computePlaceholderTotals(
  subtotalCents: number | null,
  taxRatePct: string,
): { subtotal: number; tax: number; total: number } {
  const subtotal = subtotalCents ?? 0
  const rate = Number.parseFloat(taxRatePct || "0") / 100
  const validRate = Number.isFinite(rate) && rate >= 0 ? rate : 0
  const tax = Math.round(subtotal * validRate)
  return { subtotal, tax, total: subtotal + tax }
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`flex flex-col gap-4 rounded-md border bg-card p-5 ${className ?? ""}`}>
      {title || description || action ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="font-medium text-base">{title}</h2> : null}
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className ? `flex flex-col gap-1.5 ${className}` : "flex flex-col gap-1.5"}>
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  )
}

export function StatusAlert({
  title,
  message,
  tone,
}: {
  title: string
  message: string
  tone?: "error"
}) {
  return (
    <Alert variant={tone === "error" ? "destructive" : "default"}>
      {tone === "error" ? <CircleAlert className="size-4" /> : <Check className="size-4" />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export function AddComponentMenu({
  onAdd,
  disabled,
}: {
  onAdd(kind: PendingVerticalKind): void
  disabled?: boolean
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const verticals = verticalsFor(t)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" disabled={disabled} className="w-full">
            <Plus className="size-4" />
            {t.addComponentMenu}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        {verticals.map((vertical) => {
          const Icon = verticalIconFor(vertical.kind)
          return (
            <DropdownMenuItem
              key={vertical.kind}
              onClick={() => onAdd(vertical.kind)}
              className="flex items-start gap-3 py-2"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-sm">{vertical.label}</span>
                <span className="text-muted-foreground text-xs">{vertical.description}</span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PendingComponentCard({
  pending,
  onChange,
  onRemove,
  onCommit,
  committing,
  travelers,
}: {
  pending: PendingComponent
  onChange(next: PendingComponent): void
  onRemove(): void
  onCommit(): void
  committing: boolean
  travelers: TripTraveler[]
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const Icon = verticalIconFor(pending.kind)
  const label = verticalLabelFor(pending.kind, t)
  const valid = pendingComponentIsValid(pending)

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4" />
          </span>
          <div>
            <h3 className="font-medium text-base">{label}</h3>
            <p className="text-muted-foreground text-xs">{t.configureHint}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label={t.removeComponent}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <PendingBody pending={pending} onChange={onChange} travelers={travelers} />

      {pending.commitError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {pending.commitError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={onCommit} disabled={!valid || committing}>
          {committing ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add to trip
        </Button>
      </div>
    </div>
  )
}

function PendingBody({
  pending,
  onChange,
  travelers,
}: {
  pending: PendingComponent
  onChange(next: PendingComponent): void
  travelers: TripTraveler[]
}) {
  const passengerCounts = passengerCountsFromTripTravelers(travelers)
  if (pending.kind === "product" || pending.kind === "stay") {
    return (
      <CatalogConfigurator
        pending={pending}
        onChange={onChange}
        paxAdult={passengerCounts.adults}
      />
    )
  }
  if (pending.kind === "flight") {
    return <FlightConfigurator pending={pending} travelers={travelers} onChange={onChange} />
  }
  if (pending.kind === "cruise") {
    return <CruiseConfigurator pending={pending} onChange={onChange} />
  }
  return <PlaceholderConfigurator pending={pending} onChange={onChange} />
}

function CatalogConfigurator({
  pending,
  onChange,
  paxAdult,
}: {
  pending: Extract<PendingComponent, { kind: "product" | "stay" }>
  onChange(next: PendingComponent): void
  paxAdult: number
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const vertical = verticalForKind(pending.kind)
  const [catalogSearch, setCatalogSearch] = React.useState("")
  const [selectedCatalogHit, setSelectedCatalogHit] = React.useState<CatalogSearchHit | null>(null)

  const catalogQuery = useCatalogSearch({
    vertical,
    query: catalogSearch,
    mode: "keyword",
    pagination: { limit: 20 },
    enabled: true,
  })
  const catalogHits = React.useMemo(() => {
    return catalogQuery.data?.hits ?? []
  }, [catalogQuery.data?.hits])
  const selectedCatalog =
    catalogHits.find((hit) => hit.id === pending.catalogEntityId) ?? selectedCatalogHit
  const departureQuery = useProductDepartures(
    pending.kind === "product" ? pending.catalogEntityId : null,
  )
  const selectedDeparture = React.useMemo(
    () =>
      departureQuery.data?.rows.find(
        (slot) => slot.id === pending.bookingDraft?.configure.departureSlotId,
      ) ?? null,
    [departureQuery.data?.rows, pending.bookingDraft?.configure.departureSlotId],
  )
  const quoteDraft =
    pending.bookingDraft && (pending.bookingDraft.configure.pax?.adult ?? 0) !== paxAdult
      ? updateDraftPax(pending.bookingDraft, paxAdult)
      : pending.bookingDraft
  const quote = useBookingQuote({
    surface: "admin",
    draft: quoteDraft,
    scope: { locale: "en-GB", audience: "staff", market: "default" },
    enabled: Boolean(pending.bookingDraft),
  })
  const shape = quote.data?.shape ?? null

  React.useEffect(() => {
    if (!pending.bookingDraft) return
    const currentAdult = pending.bookingDraft.configure.pax?.adult ?? 0
    if (currentAdult === paxAdult) return
    onChange({ ...pending, bookingDraft: updateDraftPax(pending.bookingDraft, paxAdult) })
  }, [onChange, paxAdult, pending])

  const fieldLabel =
    pending.kind === "stay" ? t.catalogSearch.hotelLabel : t.catalogSearch.productLabel
  const placeholder =
    pending.kind === "stay"
      ? t.catalogSearch.hotelSearchPlaceholder
      : t.catalogSearch.productSearchPlaceholder
  const emptyText =
    pending.kind === "stay" ? t.catalogSearch.hotelEmpty : t.catalogSearch.productEmpty

  return (
    <div className="flex flex-col gap-4">
      <Field label={fieldLabel}>
        <AsyncCombobox<CatalogSearchHit>
          value={pending.catalogEntityId}
          onChange={(value) => {
            const hit = value ? catalogHits.find((item) => item.id === value) : null
            setSelectedCatalogHit(hit ?? null)
            const nextEntityId = value
            const nextSourceKind = hit ? catalogHitSourceKind(hit) : null
            const nextSourceConnectionId = hit ? catalogHitSourceConnectionId(hit) : null
            const nextSourceRef = hit ? catalogHitSourceRef(hit) : null
            onChange({
              ...pending,
              catalogEntityId: nextEntityId,
              catalogEntityName: hit ? catalogHitLabel(hit) : null,
              catalogSourceKind: nextSourceKind,
              catalogSourceConnectionId: nextSourceConnectionId,
              catalogSourceRef: nextSourceRef,
              catalogThumbnailUrl: hit ? catalogHitThumbnailUrl(hit) : null,
              bookingDraft:
                nextEntityId && nextSourceKind
                  ? createCatalogBookingDraft({
                      vertical,
                      entityId: nextEntityId,
                      sourceKind: nextSourceKind,
                      sourceConnectionId: nextSourceConnectionId,
                      sourceRef: nextSourceRef,
                      paxAdult,
                      startsAt: pending.startsAt,
                      endsAt: pending.endsAt,
                    })
                  : null,
            })
          }}
          items={catalogHits}
          selectedItem={selectedCatalog}
          getKey={(hit) => hit.id}
          getLabel={catalogHitLabel}
          getSecondary={(hit) => catalogHitStringField(hit, "source.kind") ?? undefined}
          onSearchChange={setCatalogSearch}
          placeholder={placeholder}
          emptyText={emptyText}
          triggerClassName="w-full"
          clearable
        />
      </Field>

      {pending.kind === "product" ? (
        <ProductDeparturePicker
          slots={departureQuery.data?.rows ?? []}
          isLoading={departureQuery.isLoading}
          isError={departureQuery.isError}
          value={selectedDeparture?.id ?? ""}
          disabled={!pending.catalogEntityId}
          onChange={(slotId) => {
            const slot = departureQuery.data?.rows.find((candidate) => candidate.id === slotId)
            if (!slot) return
            onChange({
              ...pending,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt ?? "",
              bookingDraft: pending.bookingDraft
                ? updateDraftDeparture(pending.bookingDraft, slot)
                : null,
            })
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.fromLabel}>
            <DateTimeField
              value={pending.startsAt}
              onChange={(value) => {
                const startsAt = value ?? ""
                onChange({
                  ...pending,
                  startsAt,
                  bookingDraft: pending.bookingDraft
                    ? updateDraftSchedule(pending.bookingDraft, startsAt, pending.endsAt)
                    : null,
                })
              }}
            />
          </Field>
          <Field label={t.toLabel}>
            <DateTimeField
              value={pending.endsAt}
              onChange={(value) => {
                const endsAt = value ?? ""
                onChange({
                  ...pending,
                  endsAt,
                  bookingDraft: pending.bookingDraft
                    ? updateDraftSchedule(pending.bookingDraft, pending.startsAt, endsAt)
                    : null,
                })
              }}
            />
          </Field>
        </div>
      )}

      {shape ? (
        <CatalogComponentOptions
          draft={pending.bookingDraft}
          shape={shape}
          onDraftChange={(bookingDraft) => onChange({ ...pending, bookingDraft })}
        />
      ) : pending.bookingDraft && quote.isQuoting ? (
        <p className="text-muted-foreground text-sm">{t.loadingOptions}</p>
      ) : null}
    </div>
  )
}

function createCatalogBookingDraft({
  vertical,
  entityId,
  sourceKind,
  sourceConnectionId,
  sourceRef,
  paxAdult,
  startsAt,
  endsAt,
}: {
  vertical: CatalogVertical
  entityId: string
  sourceKind: string
  sourceConnectionId: string | null
  sourceRef: string | null
  paxAdult: number
  startsAt: string
  endsAt: string
}): Draft {
  const draft = emptyDraft(
    {
      module: vertical,
      id: entityId,
      sourceKind,
      ...(sourceConnectionId ? { sourceConnectionId } : {}),
      ...(sourceRef ? { sourceRef } : {}),
    },
    { buyerType: "B2C" },
  )
  return updateDraftSchedule(
    {
      ...draft,
      configure: { ...draft.configure, pax: { adult: paxAdult } },
    },
    startsAt,
    endsAt,
  )
}

function useProductDepartures(productId: string | null) {
  const { baseUrl, fetcher } = useVoyantTravelComposerContext()
  return useQuery({
    queryKey: ["admin-trip-composer-product-departures", productId],
    queryFn: async (): Promise<{ rows: AvailabilitySlot[] }> => {
      if (!productId) return { rows: [] }
      const res = await fetcher(
        `${baseUrl}/v1/admin/catalog/slots?entityModule=products&entityId=${encodeURIComponent(productId)}`,
      )
      if (!res.ok) throw new Error(`Departures request failed: ${res.status}`)
      return res.json()
    },
    enabled: Boolean(productId),
    staleTime: 30_000,
  })
}

function ProductDeparturePicker({
  slots,
  isLoading,
  isError,
  value,
  disabled,
  onChange,
}: {
  slots: ReadonlyArray<AvailabilitySlot>
  isLoading: boolean
  isError: boolean
  value: string
  disabled: boolean
  onChange(slotId: string): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const [search, setSearch] = React.useState("")
  const filteredSlots = React.useMemo(() => {
    const trimmed = search.trim().toLowerCase()
    if (!trimmed) return slots
    return slots.filter((slot) => formatDepartureLabel(slot).toLowerCase().includes(trimmed))
  }, [search, slots])
  const selectedSlot = slots.find((slot) => slot.id === value) ?? null

  return (
    <Field label={t.departureLabel}>
      {isLoading ? (
        <div className="h-10 rounded-md border bg-muted/40" />
      ) : isError ? (
        <p className="text-destructive text-sm">{t.departuresUnavailable}</p>
      ) : slots.length === 0 && !disabled ? (
        <p className="text-muted-foreground text-sm">{t.noUpcomingDepartures}</p>
      ) : (
        <AsyncCombobox<AvailabilitySlot>
          value={value || null}
          onChange={(slotId) => {
            if (slotId) onChange(slotId)
          }}
          items={filteredSlots}
          selectedItem={selectedSlot}
          getKey={(slot) => slot.id}
          getLabel={formatDepartureLabel}
          getSecondary={(slot) => slot.timezone}
          onSearchChange={setSearch}
          placeholder={t.searchDeparturesPlaceholder}
          emptyText={t.noDeparturesFound}
          triggerClassName="w-full"
          disabled={disabled || slots.length === 0}
          clearable={false}
        />
      )}
    </Field>
  )
}

function updateDraftSchedule(draft: Draft, startsAt: string, endsAt: string): Draft {
  const departureDate = startsAt ? startsAt.slice(0, 10) : undefined
  const departureTime = startsAt?.includes("T") ? startsAt.slice(11, 16) : undefined
  const dateRange =
    startsAt && endsAt
      ? {
          checkIn: startsAt.slice(0, 10),
          checkOut: endsAt.slice(0, 10),
        }
      : undefined
  return {
    ...draft,
    configure: {
      ...draft.configure,
      departureDate,
      departureTime,
      dateRange,
    },
  }
}

function updateDraftDeparture(draft: Draft, slot: AvailabilitySlot): Draft {
  const scheduledDraft = updateDraftSchedule(draft, slot.startsAt, slot.endsAt ?? "")
  return {
    ...scheduledDraft,
    configure: {
      ...scheduledDraft.configure,
      departureSlotId: slot.id,
    },
  }
}

function updateDraftPax(draft: Draft, paxAdult: number): Draft {
  return {
    ...draft,
    configure: {
      ...draft.configure,
      pax: {
        ...draft.configure.pax,
        adult: paxAdult,
      },
    },
  }
}

function CatalogComponentOptions({
  draft,
  shape,
  onDraftChange,
}: {
  draft: Draft | null
  shape: BookingDraftShape
  onDraftChange(draft: Draft): void
}) {
  if (!draft) return null
  const hasAccommodation =
    shape.showsAccommodation &&
    ((shape.accommodation?.roomOptions?.length ?? 0) > 0 ||
      (shape.accommodation?.subSteps?.length ?? 0) > 0)
  const productOptionStep = shape.configureSubSteps?.find((step) => step.kind === "product-option")
  const hasAddons =
    shape.showsAddons &&
    ((shape.addons?.catalog?.length ?? 0) > 0 || (shape.addons?.groups?.length ?? 0) > 0)
  if (!productOptionStep && !hasAccommodation && !hasAddons) return null
  return (
    <div className="flex flex-col gap-5 border-t pt-4">
      {productOptionStep ? (
        <CatalogProductOptionOptions
          draft={draft}
          options={productOptionStep.options}
          onDraftChange={onDraftChange}
        />
      ) : null}
      {hasAccommodation ? (
        <CatalogAccommodationOptions draft={draft} shape={shape} onDraftChange={onDraftChange} />
      ) : null}
      {hasAddons ? (
        <CatalogExtrasOptions draft={draft} shape={shape} onDraftChange={onDraftChange} />
      ) : null}
    </div>
  )
}

function CatalogProductOptionOptions({
  draft,
  options,
  onDraftChange,
}: {
  draft: Draft
  options: ReadonlyArray<{
    id: string
    code?: string | null
    name: string
    description?: string | null
    isDefault?: boolean
    units?: ReadonlyArray<{
      id: string
      name: string
      description?: string | null
      unitType?: string | null
      minQuantity?: number | null
      maxQuantity?: number | null
    }>
  }>
  onDraftChange(draft: Draft): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const selections = draft.configure.optionSelections ?? []
  if (options.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="font-medium text-sm">{t.optionsHeading}</h4>
        <p className="text-muted-foreground text-xs">{t.optionsHint}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const unit = option.units?.[0]
          const selected = selections.find((selection) => selection.optionId === option.id)
          const quantity = selected?.quantity ?? 0
          const maxQuantity = unit?.maxQuantity ?? 99
          return (
            <div
              key={option.id}
              className={`rounded-md border p-3 text-left text-sm transition-colors ${
                quantity > 0 ? "border-primary bg-primary/10" : "bg-background"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{option.name}</span>
                    {option.code ? (
                      <span className="text-muted-foreground text-xs uppercase">{option.code}</span>
                    ) : null}
                    {option.isDefault ? <Badge variant="secondary">{t.defaultOption}</Badge> : null}
                  </span>
                  {option.description ? (
                    <span className="mt-1 block text-muted-foreground text-xs">
                      {option.description}
                    </span>
                  ) : null}
                  {unit ? (
                    <span className="mt-1 block text-muted-foreground text-xs">{unit.name}</span>
                  ) : null}
                </span>
                <QuantityStepper
                  value={quantity}
                  onDecrement={() => {
                    const nextQuantity = Math.max(0, quantity - 1)
                    onDraftChange(setDraftOptionQuantity(draft, option, unit ?? null, nextQuantity))
                  }}
                  onIncrement={() => {
                    const nextQuantity = Math.min(maxQuantity, quantity + 1)
                    onDraftChange(setDraftOptionQuantity(draft, option, unit ?? null, nextQuantity))
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function setDraftOptionQuantity(
  draft: Draft,
  option: {
    id: string
    name: string
  },
  unit: {
    id: string
    name: string
  } | null,
  quantity: number,
): Draft {
  const existingSelections = draft.configure.optionSelections ?? []
  const nextSelections = existingSelections.filter((selection) => selection.optionId !== option.id)
  if (quantity > 0) {
    nextSelections.push({
      optionId: option.id,
      optionName: option.name,
      ...(unit ? { optionUnitId: unit.id, optionUnitName: unit.name } : {}),
      quantity,
    })
  }
  const firstSelection = nextSelections[0]
  return {
    ...draft,
    configure: {
      ...draft.configure,
      variantId: firstSelection?.optionId,
      optionSelections: nextSelections,
    },
  }
}

function CatalogAccommodationOptions({
  draft,
  shape,
  onDraftChange,
}: {
  draft: Draft
  shape: BookingDraftShape
  onDraftChange(draft: Draft): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const rooms = shape.accommodation?.roomOptions ?? []
  const accommodation = draft.accommodation ?? { rooms: [], travelerAssignments: {} }
  if (rooms.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="font-medium text-sm">{t.roomsHeading}</h4>
        <p className="text-muted-foreground text-xs">{t.roomsHint}</p>
      </div>
      <div className="flex flex-col gap-2">
        {rooms.map((room) => {
          const current = accommodation.rooms.find((entry) => entry.optionUnitId === room.id)
          const ratePlans = room.ratePlans ?? []
          const quantity = current?.quantity ?? 0
          return (
            <div key={room.id} className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{room.name}</div>
                  {room.description ? (
                    <p className="text-muted-foreground text-xs">{room.description}</p>
                  ) : null}
                </div>
                <QuantityStepper
                  value={quantity}
                  onDecrement={() => {
                    const nextRooms = accommodation.rooms.filter(
                      (entry) => entry.optionUnitId !== room.id,
                    )
                    const nextQuantity = quantity - 1
                    if (nextQuantity > 0) {
                      nextRooms.push({
                        optionUnitId: room.id,
                        quantity: nextQuantity,
                        ratePlanId: current?.ratePlanId,
                      })
                    }
                    onDraftChange(setAccommodation(draft, { ...accommodation, rooms: nextRooms }))
                  }}
                  onIncrement={() => {
                    const nextRooms = accommodation.rooms.filter(
                      (entry) => entry.optionUnitId !== room.id,
                    )
                    const ratePlanId =
                      current?.ratePlanId ?? (ratePlans.length === 1 ? ratePlans[0]?.id : undefined)
                    nextRooms.push({ optionUnitId: room.id, quantity: quantity + 1, ratePlanId })
                    onDraftChange(setAccommodation(draft, { ...accommodation, rooms: nextRooms }))
                  }}
                />
              </div>
              {quantity > 0 && ratePlans.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {ratePlans.map((plan) => {
                    const selected = current?.ratePlanId === plan.id
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          const nextRooms = accommodation.rooms.map((entry) =>
                            entry.optionUnitId === room.id
                              ? { ...entry, ratePlanId: plan.id }
                              : entry,
                          )
                          onDraftChange(
                            setAccommodation(draft, { ...accommodation, rooms: nextRooms }),
                          )
                        }}
                        className={`rounded-md border p-3 text-left text-sm transition-colors ${
                          selected ? "border-primary bg-primary/10" : "bg-background"
                        }`}
                      >
                        <span className="font-medium">{plan.name}</span>
                        {plan.description ? (
                          <span className="mt-1 block text-muted-foreground text-xs">
                            {plan.description}
                          </span>
                        ) : null}
                        {plan.inclusions && plan.inclusions.length > 0 ? (
                          <span className="mt-1 block text-muted-foreground text-xs">
                            Includes {plan.inclusions.join(", ")}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CatalogExtrasOptions({
  draft,
  shape,
  onDraftChange,
}: {
  draft: Draft
  shape: BookingDraftShape
  onDraftChange(draft: Draft): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const flat = shape.addons?.catalog ?? []
  const groups = shape.addons?.groups ?? []
  const hasGroupedExtras = groups.some((group) => group.items.length > 0)
  if (flat.length === 0 && !hasGroupedExtras) return null
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="font-medium text-sm">{t.optionsAndExtras}</h4>
        <p className="text-muted-foreground text-xs">{t.optionsAndExtrasHint}</p>
      </div>
      <div className="flex flex-col gap-3">
        {groups.map((group) =>
          group.items.length > 0 ? (
            <div key={group.label} className="flex flex-col gap-2">
              <div className="text-muted-foreground text-xs uppercase">{group.label}</div>
              {group.items.map((item) => (
                <CatalogExtraRow
                  key={item.id}
                  draft={draft}
                  item={item}
                  onDraftChange={onDraftChange}
                />
              ))}
            </div>
          ) : null,
        )}
        {flat.map((item) => (
          <CatalogExtraRow key={item.id} draft={draft} item={item} onDraftChange={onDraftChange} />
        ))}
      </div>
    </div>
  )
}

function CatalogExtraRow({
  draft,
  item,
  onDraftChange,
}: {
  draft: Draft
  item: { id: string; name: string; description?: string | null }
  onDraftChange(draft: Draft): void
}) {
  const current = draft.addons.find((entry) => entry.extraId === item.id)
  const quantity = current?.quantity ?? 0
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
      <div className="min-w-0">
        <div className="font-medium text-sm">{item.name}</div>
        {item.description ? (
          <p className="text-muted-foreground text-xs">{item.description}</p>
        ) : null}
      </div>
      <QuantityStepper
        value={quantity}
        onDecrement={() => {
          const nextAddons = draft.addons.filter((entry) => entry.extraId !== item.id)
          const nextQuantity = quantity - 1
          if (nextQuantity > 0) nextAddons.push({ extraId: item.id, quantity: nextQuantity })
          onDraftChange(setAddons(draft, nextAddons))
        }}
        onIncrement={() => {
          const nextAddons = draft.addons.filter((entry) => entry.extraId !== item.id)
          nextAddons.push({ extraId: item.id, quantity: quantity + 1 })
          onDraftChange(setAddons(draft, nextAddons))
        }}
      />
    </div>
  )
}

function QuantityStepper({
  value,
  onDecrement,
  onIncrement,
}: {
  value: number
  onDecrement(): void
  onIncrement(): void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="outline" size="sm" type="button" onClick={onDecrement} disabled={value <= 0}>
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-6 text-center text-sm">{value}</span>
      <Button variant="outline" size="sm" type="button" onClick={onIncrement}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}

function FlightConfigurator({
  pending,
  travelers,
  onChange,
}: {
  pending: Extract<PendingComponent, { kind: "flight" }>
  travelers: TripTraveler[]
  onChange(next: PendingComponent): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const passengers = React.useMemo(() => flightPassengersFromTripTravelers(travelers), [travelers])
  const passengerCounts = React.useMemo(
    () => passengerCountsFromTripTravelers(travelers),
    [travelers],
  )
  const isRoundTrip = pending.tripType === "round_trip"
  const ready = Boolean(
    pending.origin &&
      pending.destination &&
      pending.departDate &&
      (!isRoundTrip || pending.returnDate),
  )
  const slices = React.useMemo(() => {
    if (!pending.origin || !pending.destination || !pending.departDate) return []
    const next = [
      {
        origin: pending.origin,
        destination: pending.destination,
        departureDate: pending.departDate,
      },
    ]
    if (pending.tripType === "round_trip" && pending.returnDate) {
      next.push({
        origin: pending.destination,
        destination: pending.origin,
        departureDate: pending.returnDate,
      })
    }
    return next
  }, [
    pending.departDate,
    pending.destination,
    pending.origin,
    pending.returnDate,
    pending.tripType,
  ])
  const search = useFlightSearch(
    {
      slices,
      passengers: passengerCounts,
      cabin: pending.cabin,
    },
    { enabled: ready },
  )
  const offers = search.data?.offers ?? []
  const selectedOffer =
    pending.selectedOffer &&
    offers.some((offer) => offer.offerId === pending.selectedOffer?.offerId)
      ? pending.selectedOffer
      : pending.selectedOffer
  const ancillaryQuery = useFlightAncillaries(
    selectedOffer ? { offerId: selectedOffer.offerId, offer: selectedOffer } : null,
    { enabled: Boolean(selectedOffer) },
  )
  const ancillaryCatalog = ancillaryQuery.data?.catalog ?? pending.ancillaryCatalog
  const priced = flightPricingFromPending({
    ...pending,
    selectedOffer,
    ancillaryCatalog,
  })

  const patch = (next: Partial<Extract<PendingComponent, { kind: "flight" }>>) => {
    onChange({ ...pending, ...next })
  }

  const resetSelection = (next: Partial<Extract<PendingComponent, { kind: "flight" }>>) => {
    patch({
      selectedOffer: null,
      ancillaryCatalog: null,
      fareBundlePicks: [],
      baggagePicks: [],
      assistancePicks: [],
      extrasPicks: [],
      ...next,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isRoundTrip ? "default" : "outline"}
          onClick={() => resetSelection({ tripType: "one_way", returnDate: "" })}
        >
          {t.flightOneWay}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isRoundTrip ? "default" : "outline"}
          onClick={() => resetSelection({ tripType: "round_trip" })}
        >
          {t.flightRoundTrip}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.flightOrigin}>
          <AirportCombobox
            value={pending.origin}
            placeholder={t.fromPlaceholder}
            onChange={(code) => resetSelection({ origin: code })}
            className="w-full"
          />
        </Field>
        <Field label={t.flightDestination}>
          <AirportCombobox
            value={pending.destination}
            placeholder={t.toPlaceholder}
            onChange={(code) => resetSelection({ destination: code })}
            className="w-full"
          />
        </Field>
        <Field label={t.flightDepart}>
          <DatePicker
            value={pending.departDate}
            onChange={(departDate) => resetSelection({ departDate: departDate ?? "" })}
            placeholder={t.pickDate}
          />
        </Field>
        {isRoundTrip ? (
          <Field label={t.flightReturn}>
            <div className="flex gap-2">
              <DatePicker
                value={pending.returnDate}
                onChange={(returnDate) => resetSelection({ returnDate: returnDate ?? "" })}
                placeholder={t.pickDate}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t.clearReturnDate}
                onClick={() => resetSelection({ returnDate: "" })}
              >
                <X className="size-4" />
              </Button>
            </div>
          </Field>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="font-medium">{t.travelersWord}</span>
          <span className="text-muted-foreground text-xs">
            {passengerCounts.adults === 1
              ? t.travelerCountAdultSingular
              : formatMessage(t.travelerCountAdultPlural, { count: passengerCounts.adults })}
            {passengerCounts.children
              ? formatMessage(
                  passengerCounts.children === 1 ? t.travelerCountChild : t.travelerCountChildren,
                  { count: passengerCounts.children },
                )
              : ""}
            {passengerCounts.infants
              ? formatMessage(
                  passengerCounts.infants === 1 ? t.travelerCountInfant : t.travelerCountInfants,
                  { count: passengerCounts.infants },
                )
              : ""}
          </span>
        </div>
        <CabinSelector value={pending.cabin} onChange={(cabin) => resetSelection({ cabin })} />
      </div>

      {ready ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-medium text-sm">{t.flightOptionsHeading}</h4>
            {search.isFetching ? (
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                <Loader2 className="size-3 animate-spin" />
                {t.flightSearching}
              </span>
            ) : offers.length > 0 ? (
              <span className="text-muted-foreground text-xs">
                {formatMessage(t.flightOptionsCount, { count: offers.length })}
              </span>
            ) : null}
          </div>
          {search.isError ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
              {t.flightSearchFailed}
            </p>
          ) : null}
          {!search.isFetching && offers.length === 0 && !search.isError ? (
            <p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
              {t.flightNoOptions}
            </p>
          ) : null}
          {offers.slice(0, 5).map((offer) => (
            <FlightOfferRow
              key={offer.offerId}
              offer={offer}
              selected={selectedOffer?.offerId === offer.offerId}
              selectLabel={
                selectedOffer?.offerId === offer.offerId ? t.flightSelected : t.flightSelect
              }
              onSelect={(nextOffer) =>
                patch({
                  selectedOffer: nextOffer,
                  ancillaryCatalog: null,
                  fareBundlePicks: [],
                  baggagePicks: [],
                  assistancePicks: [],
                  extrasPicks: [],
                })
              }
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
          {t.flightSelectSearchHint}
        </p>
      )}

      {selectedOffer ? (
        <div className="flex flex-col gap-5 border-t pt-4">
          <FlightFareUpsellStep
            outboundOffer={legOffer(selectedOffer, 0)}
            returnOffer={selectedOffer.itineraries[1] ? legOffer(selectedOffer, 1) : undefined}
            passengers={passengers}
            passengerCounts={passengerCounts}
            value={pending.fareBundlePicks}
            onChange={(fareBundlePicks) => patch({ fareBundlePicks })}
            sameForAllPassengers={pending.sameFareForAllPassengers}
            onSameForAllPassengersChange={(sameFareForAllPassengers) =>
              patch({ sameFareForAllPassengers })
            }
          />

          {ancillaryQuery.isError ? (
            <p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
              {t.flightAncillariesUnavailable}
            </p>
          ) : (
            <FlightBaggageStep
              outboundCatalog={ancillaryCatalog}
              returnCatalog={selectedOffer.itineraries[1] ? ancillaryCatalog : null}
              outboundOffer={legOffer(selectedOffer, 0)}
              returnOffer={selectedOffer.itineraries[1] ? legOffer(selectedOffer, 1) : undefined}
              passengers={passengers}
              passengerCounts={passengerCounts}
              value={pending.baggagePicks}
              onChange={(baggagePicks) =>
                patch({ baggagePicks, ancillaryCatalog: ancillaryCatalog ?? null })
              }
              sameForBothDirections={pending.sameBaggageBothDirections}
              onSameForBothDirectionsChange={(sameBaggageBothDirections) =>
                patch({ sameBaggageBothDirections })
              }
              loading={ancillaryQuery.isFetching}
            />
          )}

          {ancillaryCatalog ? (
            <FlightServicesStep
              outboundCatalog={ancillaryCatalog}
              returnCatalog={selectedOffer.itineraries[1] ? ancillaryCatalog : null}
              outboundOffer={legOffer(selectedOffer, 0)}
              returnOffer={selectedOffer.itineraries[1] ? legOffer(selectedOffer, 1) : undefined}
              passengers={passengers}
              passengerCounts={passengerCounts}
              assistance={pending.assistancePicks}
              extras={pending.extrasPicks}
              onAssistanceChange={(assistancePicks) => patch({ assistancePicks })}
              onExtrasChange={(extrasPicks) => patch({ extrasPicks })}
              loading={ancillaryQuery.isFetching}
            />
          ) : null}

          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <span className="text-muted-foreground text-sm">{t.flightTotal}</span>
            <span className="font-semibold text-base">
              {formatMoney(priced.totalAmountCents, priced.currency)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CabinSelector({
  value,
  onChange,
}: {
  value: CabinClass
  onChange(next: CabinClass): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const cabins: Array<{ value: CabinClass; label: string }> = [
    { value: "economy", label: t.cabinClasses.economy },
    { value: "premium_economy", label: t.cabinClasses.premium_economy },
    { value: "business", label: t.cabinClasses.business },
    { value: "first", label: t.cabinClasses.first },
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {cabins.map((cabin) => (
        <Button
          key={cabin.value}
          type="button"
          size="sm"
          variant={value === cabin.value ? "default" : "outline"}
          onClick={() => onChange(cabin.value)}
        >
          {cabin.label}
        </Button>
      ))}
    </div>
  )
}

interface FlightPricingBreakdown {
  currency: string
  subtotalAmountCents: number
  taxAmountCents: number
  ancillaryAmountCents: number
  totalAmountCents: number
}

export function flightPricingFromPending(
  pending: Extract<PendingComponent, { kind: "flight" }>,
): FlightPricingBreakdown {
  const offer = pending.selectedOffer
  if (!offer) {
    return {
      currency: "EUR",
      subtotalAmountCents: 0,
      taxAmountCents: 0,
      ancillaryAmountCents: 0,
      totalAmountCents: 0,
    }
  }
  const currencyCode = offer.totalPrice.currency
  const offerTotal = moneyToCents(offer.totalPrice.amount)
  const fareTax = offer.fareBreakdowns.reduce(
    (sum, line) => sum + moneyToCents(line.taxes.amount),
    0,
  )
  const ancillaryAmount = flightAncillaryAmountCents(pending, currencyCode)
  return {
    currency: currencyCode,
    subtotalAmountCents: Math.max(0, offerTotal - fareTax) + ancillaryAmount,
    taxAmountCents: fareTax,
    ancillaryAmountCents: ancillaryAmount,
    totalAmountCents: offerTotal + ancillaryAmount,
  }
}

function flightAncillaryAmountCents(
  pending: Extract<PendingComponent, { kind: "flight" }>,
  currencyCode: string,
): number {
  const offer = pending.selectedOffer
  const catalog = pending.ancillaryCatalog
  if (!offer) return 0

  const fareBundles = offer.fareBundles ?? []
  const fareBundleTotal = pending.fareBundlePicks.reduce((sum, pick) => {
    const bundle = fareBundles.find((candidate) => candidate.id === pick.bundleId)
    if (!bundle || bundle.priceDelta.currency !== currencyCode) return sum
    return sum + moneyToCents(bundle.priceDelta.amount)
  }, 0)

  if (!catalog) return fareBundleTotal

  const baggageTotal = pending.baggagePicks.reduce((sum, pick) => {
    const option = catalog.baggage.find((candidate) => candidate.id === pick.optionId)
    if (!option || option.price.currency !== currencyCode) return sum
    return sum + moneyToCents(option.price.amount) * (pick.quantity ?? 1)
  }, 0)

  const assistanceTotal = pending.assistancePicks.reduce((sum, pick) => {
    const option = catalog.assistance.find((candidate) => candidate.id === pick.optionId)
    if (!option?.price || option.price.currency !== currencyCode) return sum
    return sum + moneyToCents(option.price.amount)
  }, 0)

  const extrasTotal = pending.extrasPicks.reduce((sum, pick) => {
    const option = catalog.extras.find((candidate) => candidate.id === pick.optionId)
    if (!option || option.price.currency !== currencyCode) return sum
    return sum + moneyToCents(option.price.amount) * (pick.quantity ?? 1)
  }, 0)

  return fareBundleTotal + baggageTotal + assistanceTotal + extrasTotal
}

function legOffer(offer: FlightOffer, index: number): FlightOffer {
  const itinerary = offer.itineraries[index]
  return itinerary ? { ...offer, itineraries: [itinerary] } : offer
}

function moneyToCents(amount: string): number {
  const parsed = Number.parseFloat(amount)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function passengerCountsFromTripTravelers(travelers: TripTraveler[]): PassengerCounts {
  const counts = travelers.reduce(
    (acc, traveler) => {
      if (traveler.role === "child") acc.children += 1
      else if (traveler.role === "infant") acc.infants += 1
      else acc.adults += 1
      return acc
    },
    { adults: 0, children: 0, infants: 0 },
  )
  return {
    adults: Math.max(1, counts.adults),
    children: counts.children,
    infants: counts.infants,
  }
}

function flightPassengersFromTripTravelers(travelers: TripTraveler[]): FlightPassenger[] {
  return travelers.map((traveler, index) => {
    const type =
      traveler.role === "child" ? "child" : traveler.role === "infant" ? "infant" : "adult"
    return {
      passengerId: traveler.localId || `traveler_${index + 1}`,
      type,
      // fallback names sent verbatim to the flight provider's API as ASCII
      // passenger placeholders when the operator hasn't yet filled in the
      // real traveler.
      firstName:
        // i18n-literal-ok
        traveler.firstName || (type === "adult" ? "Adult" : type === "child" ? "Child" : "Infant"),
      lastName: traveler.lastName || `${index + 1}`,
      dateOfBirth: traveler.dateOfBirth || fallbackDobForPassengerType(type),
      ...(traveler.email ? { email: traveler.email } : {}),
    }
  })
}

function fallbackDobForPassengerType(type: FlightPassenger["type"]): string {
  if (type === "child") return "2016-01-01"
  if (type === "infant") return "2025-01-01"
  return "1990-01-01"
}

function flightSelectionLabels(
  offer: FlightOffer | null,
  ancillaries: AncillarySelection | null,
): string[] {
  if (!offer || !ancillaries) return []
  const labels: string[] = []
  const bundles = offer.fareBundles ?? []
  const bundleCounts = countById(ancillaries.fareBundle?.map((pick) => pick.bundleId) ?? [])
  for (const [bundleId, quantity] of bundleCounts) {
    const bundle = bundles.find((candidate) => candidate.id === bundleId)
    labels.push(`${quantity} × ${bundle?.label ?? bundleId}`)
  }
  const baggageCount =
    ancillaries.baggage?.reduce((sum, pick) => sum + (pick.quantity ?? 1), 0) ?? 0
  if (baggageCount > 0) labels.push(`${baggageCount} bag${baggageCount === 1 ? "" : "s"}`)
  const assistanceCount = ancillaries.assistance?.length ?? 0
  if (assistanceCount > 0) {
    labels.push(`${assistanceCount} assistance request${assistanceCount === 1 ? "" : "s"}`)
  }
  const extrasCount = ancillaries.extras?.reduce((sum, pick) => sum + (pick.quantity ?? 1), 0) ?? 0
  if (extrasCount > 0) labels.push(`${extrasCount} extra${extrasCount === 1 ? "" : "s"}`)
  return labels
}

function countById(values: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return counts
}

function CruiseConfigurator({
  pending,
  onChange,
}: {
  pending: Extract<PendingComponent, { kind: "cruise" }>
  onChange(next: PendingComponent): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.cruisePlaceholder.embarkationDate}>
          <Input
            type="date"
            value={pending.embarkationDate}
            onChange={(event) => onChange({ ...pending, embarkationDate: event.target.value })}
          />
        </Field>
        <Field label={t.cruisePlaceholder.cabin}>
          <Input
            value={pending.cabin}
            placeholder={t.cabinPlaceholder}
            onChange={(event) => onChange({ ...pending, cabin: event.target.value })}
          />
        </Field>
      </div>
      <Field label={t.cruisePlaceholder.description}>
        <Textarea
          rows={2}
          value={pending.description}
          onChange={(event) => onChange({ ...pending, description: event.target.value })}
        />
      </Field>
      <Field label={t.cruisePlaceholder.estimatedAmount}>
        <Input
          inputMode="decimal"
          value={pending.estimatedAmount}
          placeholder="0.00"
          onChange={(event) => onChange({ ...pending, estimatedAmount: event.target.value })}
        />
      </Field>
    </div>
  )
}

function PlaceholderConfigurator({
  pending,
  onChange,
}: {
  pending: Extract<PendingComponent, { kind: "manual" }>
  onChange(next: PendingComponent): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const totals = computePlaceholderTotals(pending.subtotalCents, pending.taxRatePct)
  return (
    <div className="flex flex-col gap-4">
      <Field label={t.manualPlaceholder.nameLabel}>
        <Input
          value={pending.name}
          placeholder={t.manualPlaceholder.namePlaceholder}
          onChange={(event) => onChange({ ...pending, name: event.target.value })}
        />
      </Field>
      <Field label={t.manualPlaceholder.descriptionLabel}>
        <Textarea
          rows={2}
          value={pending.description}
          placeholder={t.notesPlaceholder}
          onChange={(event) => onChange({ ...pending, description: event.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.fromLabel}>
          <DateTimeField
            value={pending.startsAt}
            onChange={(value) => onChange({ ...pending, startsAt: value ?? "" })}
          />
        </Field>
        <Field label={t.toLabel}>
          <DateTimeField
            value={pending.endsAt}
            onChange={(value) => onChange({ ...pending, endsAt: value ?? "" })}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)_140px]">
        <Field label={t.manualPlaceholder.currencyLabel}>
          <CurrencyCombobox
            value={pending.currency}
            onChange={(value) => onChange({ ...pending, currency: value ?? "EUR" })}
          />
        </Field>
        <Field label={t.manualPlaceholder.subtotalLabel}>
          <CurrencyInput
            value={pending.subtotalCents}
            onChange={(value) => onChange({ ...pending, subtotalCents: value })}
            currency={pending.currency}
            placeholder="0.00"
          />
        </Field>
        <Field label={t.manualPlaceholder.taxRateLabel}>
          <div className="relative">
            <Input
              inputMode="decimal"
              value={pending.taxRatePct}
              placeholder="0"
              onChange={(event) => onChange({ ...pending, taxRatePct: event.target.value })}
              className="pr-8"
            />
            <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground text-xs">
              %
            </span>
          </div>
        </Field>
      </div>
      <div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>{t.tax}</span>
          <span>{formatMoney(totals.tax, pending.currency)}</span>
        </div>
        <div className="flex items-center justify-between font-semibold">
          <span>{t.total}</span>
          <span>{formatMoney(totals.total, pending.currency)}</span>
        </div>
      </div>
    </div>
  )
}

export function pendingComponentIsValid(pending: PendingComponent): boolean {
  switch (pending.kind) {
    case "product":
      return Boolean(
        pending.catalogEntityId &&
          pending.catalogSourceKind &&
          pending.bookingDraft?.configure.departureSlotId,
      )
    case "stay":
      return Boolean(pending.catalogEntityId && pending.catalogSourceKind && pending.bookingDraft)
    case "flight":
      return Boolean(
        pending.origin && pending.destination && pending.departDate && pending.selectedOffer,
      )
    case "cruise":
      return Boolean(pending.embarkationDate)
    case "manual":
      return Boolean(pending.name && pending.subtotalCents && pending.subtotalCents > 0)
  }
}

export function ComponentsEmpty() {
  const t = useAdminMessages().trips.adminComposer.panels
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RouteIcon />
        </EmptyMedia>
        <EmptyTitle>{t.emptyTimeline}</EmptyTitle>
        <EmptyDescription>{t.emptyTimelineHint}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export type TravelerCategory = "adult" | "child" | "infant"
export type TripTravelerRole = "lead" | TravelerCategory

export interface TripTraveler {
  localId: string
  personId: string | null
  firstName: string
  lastName: string
  email: string
  dateOfBirth: string | null
  role: TripTravelerRole
}

export function newTripTraveler(): TripTraveler {
  return {
    localId: `tt_${Math.random().toString(36).slice(2, 10)}`,
    personId: null,
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: null,
    role: "adult",
  }
}

export function TripTravelersSection({
  value,
  onChange,
  billingPersonId,
}: {
  value: TripTraveler[]
  onChange(next: TripTraveler[]): void
  billingPersonId?: string | null
}) {
  function patchAt(localId: string, patch: Partial<TripTraveler>) {
    onChange(
      value.map((traveler) =>
        traveler.localId === localId ? { ...traveler, ...patch } : traveler,
      ),
    )
  }
  function removeAt(localId: string) {
    onChange(value.filter((traveler) => traveler.localId !== localId))
  }
  function addTravelerByPersonId(personId: string) {
    if (value.some((traveler) => traveler.personId === personId)) return
    onChange([...value, { ...newTripTraveler(), personId }])
  }

  const existingPersonIds = new Set(value.map((traveler) => traveler.personId).filter(Boolean))

  // Lead = billing person when they're on the roster; otherwise the first
  // traveler. Keeps the "who is the primary traveler" intent natural without
  // forcing operators to reorder the list.
  const leadLocalId =
    (billingPersonId && value.find((t) => t.personId === billingPersonId)?.localId) ||
    value[0]?.localId ||
    null

  const t = useAdminMessages().trips.adminComposer.panels

  return (
    <section className="flex flex-col gap-3 rounded-md border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-base">{t.travelersSectionTitle}</h2>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, newTripTraveler()])}>
          <UserPlus className="size-3.5" />
          {t.addTravelerLabel}
        </Button>
      </div>

      {billingPersonId ? (
        <BillingQuickAdd
          billingPersonId={billingPersonId}
          existingPersonIds={existingPersonIds}
          onAdd={addTravelerByPersonId}
        />
      ) : null}

      {value.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t.noTravelersPrefix}
          <span className="font-medium">{t.addTravelerLabel}</span>.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((traveler) => (
            <TripTravelerRow
              key={traveler.localId}
              traveler={traveler}
              isLead={traveler.localId === leadLocalId}
              onPatch={(patch) => patchAt(traveler.localId, patch)}
              onRemove={() => removeAt(traveler.localId)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BillingQuickAdd({
  billingPersonId,
  existingPersonIds,
  onAdd,
}: {
  billingPersonId: string
  existingPersonIds: Set<string | null>
  onAdd(personId: string): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const billingPersonQuery = usePerson(billingPersonId)
  const relationshipsQuery = usePersonRelationships(billingPersonId)
  const billingPerson = billingPersonQuery.data
  const billingAlreadyAdded = existingPersonIds.has(billingPersonId)

  const relatedPersonIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const relationship of relationshipsQuery.data?.data ?? []) {
      const otherId =
        relationship.fromPersonId === billingPersonId
          ? relationship.toPersonId
          : relationship.fromPersonId
      if (otherId && otherId !== billingPersonId) ids.add(otherId)
    }
    return [...ids]
  }, [relationshipsQuery.data?.data, billingPersonId])

  const hasRelationships = relatedPersonIds.length > 0
  if (billingAlreadyAdded && !hasRelationships) return null

  const billingName = formatPersonName(billingPerson) ?? t.travelersAddRow.billingPersonFallback

  return (
    <div className="flex flex-col gap-2">
      {!billingAlreadyAdded ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onAdd(billingPersonId)}
        >
          <UserPlus className="size-3.5" />
          {t.travelersAddRow.addBillingPersonPrefix}
          {billingName}
          {t.travelersAddRow.addBillingPersonSuffix}
        </Button>
      ) : null}
      {hasRelationships ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">
            {t.travelersAddRow.fromRelationshipsPrefix}
            {billingName}
            {t.travelersAddRow.fromRelationshipsSuffix}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {relatedPersonIds.map((personId) => (
              <RelatedPersonChip
                key={personId}
                personId={personId}
                billingPersonId={billingPersonId}
                relationships={relationshipsQuery.data?.data ?? []}
                disabled={existingPersonIds.has(personId)}
                onAdd={() => onAdd(personId)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function RelatedPersonChip({
  personId,
  billingPersonId,
  relationships,
  disabled,
  onAdd,
}: {
  personId: string
  billingPersonId: string
  relationships: Array<{
    fromPersonId: string
    toPersonId: string
    kind: string
    inverseKind: string | null
  }>
  disabled: boolean
  onAdd(): void
}) {
  const personQuery = usePerson(personId)
  const name = formatPersonName(personQuery.data) ?? "—"
  const relation = relationships.find(
    (relationship) =>
      (relationship.fromPersonId === billingPersonId && relationship.toPersonId === personId) ||
      (relationship.toPersonId === billingPersonId && relationship.fromPersonId === personId),
  )
  const kindLabel = relation
    ? formatRelationshipKind(
        relation.toPersonId === billingPersonId && relation.inverseKind
          ? relation.inverseKind
          : relation.kind,
      )
    : null
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onAdd}
      className="h-auto py-1.5"
    >
      <UserPlus className="size-3.5" />
      <span>{name}</span>
      {kindLabel ? (
        <Badge variant="secondary" className="ml-1 text-[10px] capitalize">
          {kindLabel}
        </Badge>
      ) : null}
    </Button>
  )
}

function formatPersonName(
  person:
    | {
        firstName?: string | null
        lastName?: string | null
        email?: string | null
      }
    | undefined
    | null,
): string | null {
  if (!person) return null
  const name = [person.firstName, person.lastName]
    .filter((part) => (part ?? "").trim().length > 0)
    .join(" ")
    .trim()
  return name || person.email || null
}

function formatRelationshipKind(kind: string): string {
  return kind.replaceAll("_", " ")
}

function TripTravelerRow({
  traveler,
  isLead,
  onPatch,
  onRemove,
}: {
  traveler: TripTraveler
  isLead: boolean
  onPatch(patch: Partial<TripTraveler>): void
  onRemove(): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const personQuery = usePerson(traveler.personId ?? undefined, {
    enabled: Boolean(traveler.personId),
  })

  React.useEffect(() => {
    const person = personQuery.data
    if (!person) return
    const nextDob = person.dateOfBirth ?? null
    const derivedCategory = deriveTravelerRoleFromDob(nextDob)
    const nextRole: TripTravelerRole = isLead
      ? "lead"
      : nextDob
        ? (derivedCategory as TravelerCategory)
        : traveler.role === "lead"
          ? "adult"
          : traveler.role
    const patch: Partial<TripTraveler> = {}
    if ((person.firstName ?? "") !== traveler.firstName) patch.firstName = person.firstName ?? ""
    if ((person.lastName ?? "") !== traveler.lastName) patch.lastName = person.lastName ?? ""
    if ((person.email ?? "") !== traveler.email) patch.email = person.email ?? ""
    if (nextDob !== traveler.dateOfBirth) patch.dateOfBirth = nextDob
    if (nextRole !== traveler.role) patch.role = nextRole
    if (Object.keys(patch).length > 0) onPatch(patch)
  }, [
    personQuery.data,
    isLead,
    onPatch,
    traveler.dateOfBirth,
    traveler.email,
    traveler.firstName,
    traveler.lastName,
    traveler.role,
  ])

  React.useEffect(() => {
    if (isLead && traveler.role !== "lead") onPatch({ role: "lead" })
    if (!isLead && traveler.role === "lead") {
      const derived = deriveTravelerRoleFromDob(traveler.dateOfBirth) as TravelerCategory
      onPatch({ role: derived })
    }
  }, [isLead, onPatch, traveler.dateOfBirth, traveler.role])

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [sheetMode, setSheetMode] = React.useState<"create" | "edit">("create")
  const lockedByDob = Boolean(traveler.dateOfBirth)
  const displayCategory: TravelerCategory = lockedByDob
    ? (deriveTravelerRoleFromDob(traveler.dateOfBirth) as TravelerCategory)
    : traveler.role === "lead"
      ? "adult"
      : traveler.role

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PersonCombobox
            value={traveler.personId}
            onChange={(personId) => onPatch({ personId })}
            placeholder={t.personPickerPlaceholder}
          />
        </div>
        {traveler.personId && personQuery.data ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSheetMode("edit")
              setSheetOpen(true)
            }}
          >
            <Pencil className="size-3.5" />
            {t.travelerRow.editAction}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSheetMode("create")
            setSheetOpen(true)
          }}
        >
          <UserPlus className="size-3.5" />
          {t.travelerRow.newAction}
        </Button>
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === "edit" ? t.travelerRow.editPerson : t.travelerRow.createPerson}
            </SheetTitle>
          </SheetHeader>
          <SheetBody>
            <PersonForm
              mode={
                sheetMode === "edit" && personQuery.data
                  ? { kind: "edit", person: personQuery.data }
                  : { kind: "create" }
              }
              onCancel={() => setSheetOpen(false)}
              onSuccess={(person) => {
                onPatch({ personId: person.id })
                setSheetOpen(false)
              }}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>
      <div className="flex flex-wrap items-center gap-2">
        {isLead ? (
          <Badge>{t.leadBadge}</Badge>
        ) : (
          <>
            <CategoryToggle
              value={displayCategory}
              onChange={(role) => onPatch({ role })}
              disabled={lockedByDob}
            />
            {lockedByDob ? (
              <span className="text-muted-foreground text-xs">
                Auto from DOB ({formatDateOnly(traveler.dateOfBirth)})
              </span>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={t.categoryManualAria}
                      className="text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{t.travelerRow.manualCategoryHint}</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={onRemove}
          aria-label={t.removeTraveler}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function CategoryToggle({
  value,
  onChange,
  disabled,
}: {
  value: TravelerCategory
  onChange(value: TravelerCategory): void
  disabled?: boolean
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const options: Array<{ value: TravelerCategory; label: string }> = [
    { value: "adult", label: t.travelerRow.categoryAdult },
    { value: "child", label: t.travelerRow.categoryChild },
    { value: "infant", label: t.travelerRow.categoryInfant },
  ]
  return (
    <div className="flex gap-1">
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          onClick={() => onChange(option.value)}
          disabled={disabled}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return ""
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed)
}

export function CommittedComponentCard({
  component,
  selectable = false,
  selected = false,
  onSelectedChange,
  onRemove,
  removePending = false,
  bookingSetupEditable = false,
  bookingSetupSaving = false,
  onBookingSetupChange,
}: {
  component: TripComponent
  index: number
  selectable?: boolean
  selected?: boolean
  onSelectedChange?: (checked: boolean) => void
  onRemove?: () => void
  removePending?: boolean
  bookingSetupEditable?: boolean
  bookingSetupSaving?: boolean
  onBookingSetupChange?: (component: TripComponent, setup: ComponentBookingSetup) => void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const Icon = componentIcon(component)
  const coverUrl = componentThumbnailFor(component)
  const componentName = componentTitleFor(component)
  const optionSummary = componentOptionSummaryFor(component)
  const bookingSetup = componentBookingSetupFor(component)
  const canEditBookingSetup =
    bookingSetupEditable && component.kind === "catalog_booking" && !component.bookingId

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border bg-card p-4 ${
        selected ? "ring-2 ring-destructive/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {selectable ? (
          <Checkbox
            className="mt-1"
            checked={selected}
            onCheckedChange={(value) => onSelectedChange?.(Boolean(value))}
            aria-label={`Select ${componentName} for cancellation`}
          />
        ) : null}
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="size-12 shrink-0 rounded-md object-cover ring-1 ring-border"
            loading="lazy"
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{componentName}</span>
            {component.status === "failed" ? (
              <Badge variant="destructive">{t.committedCard.statusFailed}</Badge>
            ) : component.status === "cancelled" ? (
              <Badge variant="secondary">{t.committedCard.statusCancelled}</Badge>
            ) : null}
          </div>
          {(() => {
            const label = formatScheduleLabel(component)
            return label ? (
              <p className="flex items-center gap-1 text-muted-foreground text-sm">
                <CalendarClock className="size-3.5" />
                {label}
              </p>
            ) : null
          })()}
          {component.description ? (
            <p className="truncate text-muted-foreground text-sm">{component.description}</p>
          ) : null}
          {optionSummary ? (
            <p className="truncate text-muted-foreground text-sm">{optionSummary}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
            <Reference
              label={t.committedCard.bookingLabel}
              value={component.bookingId}
              href={component.bookingId ? `/bookings/${component.bookingId}` : undefined}
            />
            <Reference label={t.committedCard.orderLabel} value={component.orderId} />
            <Reference label={t.committedCard.paymentLabel} value={component.paymentSessionId} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <p className="font-semibold">
            {formatMoney(component.componentTotalAmountCents, component.componentCurrency)}
          </p>
          {component.componentTaxAmountCents != null && component.componentTaxAmountCents > 0 ? (
            <p className="text-muted-foreground text-xs">
              tax {formatMoney(component.componentTaxAmountCents, component.componentCurrency)}
            </p>
          ) : null}
          {onRemove ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={removePending}
              aria-label={t.removeComponent}
              className="text-muted-foreground hover:text-destructive"
            >
              {removePending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
      {canEditBookingSetup ? (
        <div className="flex flex-col gap-3 border-t pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">{t.bookingSetupHeading}</p>
              <p className="text-muted-foreground text-xs">{t.committedCard.bookingSetupHint}</p>
            </div>
            {bookingSetupSaving ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <PaymentScheduleSection
            value={bookingSetup.paymentSchedule}
            onChange={(paymentSchedule) =>
              onBookingSetupChange?.(component, { ...bookingSetup, paymentSchedule })
            }
            currency={component.componentCurrency ?? undefined}
            totalAmountCents={component.componentTotalAmountCents ?? undefined}
            labels={{ heading: t.committedCard.paymentScheduleHeading }}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <ComponentSetupCheckbox
              id={`${component.id}-contract-document`}
              checked={bookingSetup.generateContractDocument}
              label={t.committedCard.generateContract}
              onCheckedChange={(generateContractDocument) =>
                onBookingSetupChange?.(component, { ...bookingSetup, generateContractDocument })
              }
            />
            <ComponentSetupCheckbox
              id={`${component.id}-invoice-document`}
              checked={bookingSetup.generateInvoiceDocument}
              label={t.committedCard.generateInvoice}
              onCheckedChange={(generateInvoiceDocument) =>
                onBookingSetupChange?.(component, { ...bookingSetup, generateInvoiceDocument })
              }
            />
          </div>
        </div>
      ) : component.bookingId ? (
        <p className="border-t pt-3 text-muted-foreground text-xs">
          {t.committedCard.committedFooter}
        </p>
      ) : null}
      {(() => {
        const visibleCodes = component.warningCodes.filter(isUserVisibleWarning)
        if (visibleCodes.length === 0) return null
        return (
          <p className="flex items-center gap-1 text-amber-600 text-xs">
            <CircleAlert className="size-3" />
            {visibleCodes.join(", ")}
          </p>
        )
      })()}
    </div>
  )
}

function ComponentSetupCheckbox({
  id,
  checked,
  label,
  onCheckedChange,
}: {
  id: string
  checked: boolean
  label: string
  onCheckedChange(value: boolean): void
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor={id} className="cursor-pointer text-sm">
        {label}
      </Label>
    </div>
  )
}

export interface ComponentBookingSetup {
  paymentSchedule: PaymentScheduleValue
  generateContractDocument: boolean
  generateInvoiceDocument: boolean
}

export function componentBookingSetupFor(component: TripComponent): ComponentBookingSetup {
  const metadata = recordFromUnknown(component.metadata)
  const bookingSetup = recordFromUnknown(metadata?.bookingSetup)
  const draft = recordFromUnknown(metadata?.bookingDraftV1)
  const draftDocumentGeneration = recordFromUnknown(draft?.documentGeneration)
  const setupDocumentGeneration = recordFromUnknown(bookingSetup?.documentGeneration)
  const documentGeneration = setupDocumentGeneration ?? draftDocumentGeneration

  return {
    paymentSchedule: paymentScheduleValueFromUnknown(bookingSetup?.paymentSchedule),
    generateContractDocument: documentGeneration?.contractDocument === true,
    generateInvoiceDocument: documentGeneration?.invoiceDocument === true,
  }
}

export function TripPreviewRail({
  trip,
  pendingCount,
  travelers,
  billing,
  billingPersonId,
  voucher,
  onVoucherChange,
  paymentCurrency,
}: {
  trip: Trip | null
  pendingCount: number
  travelers: TripTraveler[]
  billing: PersonPickerValue
  billingPersonId?: string | null
  voucher: VoucherPickerValue
  onVoucherChange(value: VoucherPickerValue): void
  paymentCurrency: string
}) {
  const envelope = trip?.envelope
  const aggregate = envelope?.aggregatePricingSnapshot
  const components = React.useMemo(
    () =>
      sortComponentsBySchedule(
        (trip?.components ?? []).filter((component) => component.status !== "removed"),
      ),
    [trip?.components],
  )
  const status = envelope?.status
  const t = useAdminMessages().trips.adminComposer.panels

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/10 p-4">
      <div className="flex items-center justify-between">
        <PreviewLabel>{t.tripPreviewLabel}</PreviewLabel>
        <Badge variant="outline" className="text-[10px] capitalize">
          {status ?? "draft"}
        </Badge>
      </div>

      {components.length === 0 && pendingCount === 0 ? (
        <p className="text-muted-foreground text-xs">{t.previewRail.empty}</p>
      ) : null}

      {components.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {components.map((component) => (
            <li key={component.id}>
              <PreviewComponentRow component={component} />
            </li>
          ))}
        </ul>
      ) : null}

      {pendingCount > 0 ? (
        <p className="text-muted-foreground text-xs">
          {pendingCount === 1
            ? t.previewRail.pendingComponentsSingular
            : formatMessage(t.previewRail.pendingComponentsPlural, { count: pendingCount })}
        </p>
      ) : null}

      {components.length > 0 ? <CurrencyTotals components={components} /> : null}

      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <PreviewLabel>{t.paymentCurrencyLabel}</PreviewLabel>
        <span className="font-medium">{paymentCurrency}</span>
      </div>

      <BillingPreview billing={billing} />
      <TravelersPreview travelers={travelers} billingPersonId={billingPersonId ?? null} />

      {(() => {
        const warnings = (aggregate?.warnings ?? []).filter(isUserVisibleWarning)
        if (warnings.length === 0) return null
        return (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>{t.pricingWarningsTitle}</AlertTitle>
            <AlertDescription>{warnings.join(", ")}</AlertDescription>
          </Alert>
        )
      })()}

      {components.length > 0 ? (
        <div className="flex flex-col gap-4 border-t pt-3">
          <VoucherPickerSection
            value={voucher}
            onChange={onVoucherChange}
            currency={paymentCurrency}
            amountCents={aggregate?.totalAmountCents ?? undefined}
          />
        </div>
      ) : null}
    </div>
  )
}

function PreviewComponentRow({ component }: { component: TripComponent }) {
  const Icon = componentIcon(component)
  const coverUrl = componentThumbnailFor(component)
  const name = componentTitleFor(component)
  const optionSummary = componentOptionSummaryFor(component)

  return (
    <div className="flex items-start gap-3">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="size-12 shrink-0 rounded-md object-cover ring-1 ring-border"
          loading="lazy"
        />
      ) : (
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-sm">{name}</span>
        {(() => {
          const label = formatScheduleLabel(component)
          return label ? (
            <span className="truncate text-muted-foreground text-xs">{label}</span>
          ) : null
        })()}
        {optionSummary ? (
          <span className="truncate text-muted-foreground text-xs">{optionSummary}</span>
        ) : null}
      </div>
      <span className="shrink-0 font-medium text-sm">
        {formatMoney(component.componentTotalAmountCents, component.componentCurrency)}
      </span>
    </div>
  )
}

function BillingPreview({ billing }: { billing: PersonPickerValue }) {
  const t = useAdminMessages().trips.adminComposer.panels
  const personQuery = usePerson(billing.personId || undefined, {
    enabled: billing.mode === "existing" && Boolean(billing.personId),
  })
  const orgQuery = useOrganization(billing.organizationId ?? undefined, {
    enabled: billing.billTo === "organization" && Boolean(billing.organizationId),
  })
  const display = resolveBillingDisplay(billing, personQuery.data, orgQuery.data, t)
  if (!display.primary && !display.secondary) return null
  return (
    <div className="flex flex-col gap-0.5 border-t pt-3">
      <PreviewLabel>{t.billingLabel}</PreviewLabel>
      <span className="truncate text-sm">{display.primary || "—"}</span>
      {display.secondary ? (
        <span className="truncate text-muted-foreground text-xs">{display.secondary}</span>
      ) : null}
    </div>
  )
}

function TravelersPreview({
  travelers,
  billingPersonId,
}: {
  travelers: TripTraveler[]
  billingPersonId: string | null
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  if (travelers.length === 0) return null
  const leadLocalId =
    (billingPersonId &&
      travelers.find((traveler) => traveler.personId === billingPersonId)?.localId) ||
    travelers[0]?.localId ||
    null
  return (
    <div className="flex flex-col gap-1 border-t pt-3">
      <PreviewLabel>
        {formatMessage(t.travelersWithCount, { count: travelers.length })}
      </PreviewLabel>
      <ul className="flex flex-col gap-0.5 text-sm">
        {travelers.map((traveler, idx) => (
          <TravelerPreviewRow
            key={traveler.localId}
            traveler={traveler}
            index={idx}
            isLead={traveler.localId === leadLocalId}
          />
        ))}
      </ul>
    </div>
  )
}

function TravelerPreviewRow({
  traveler,
  index,
  isLead,
}: {
  traveler: TripTraveler
  index: number
  isLead: boolean
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  const personQuery = usePerson(traveler.personId || undefined, {
    enabled: Boolean(traveler.personId),
  })
  const inlineName = [traveler.firstName, traveler.lastName]
    .filter((part) => part.trim().length > 0)
    .join(" ")
    .trim()
  const name =
    inlineName ||
    formatPersonName(personQuery.data) ||
    formatMessage(t.travelerNumberedFallback, { number: index + 1 })
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="truncate">{name}</span>
      <span className="shrink-0 text-muted-foreground text-xs capitalize">
        {isLead ? t.leadBadge : traveler.role}
      </span>
    </li>
  )
}

function CurrencyTotals({ components }: { components: TripComponent[] }) {
  const t = useAdminMessages().trips.adminComposer.panels
  const buckets = React.useMemo(() => aggregateByCurrency(components), [components])
  if (buckets.length === 0) return null
  return (
    <div className="flex flex-col gap-4 border-t pt-3 text-sm">
      {buckets.map((bucket) => (
        <div key={bucket.currency} className="flex flex-col gap-1">
          {buckets.length > 1 ? <PreviewLabel>{bucket.currency}</PreviewLabel> : null}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t.subtotal}</span>
            <span>{formatMoney(bucket.subtotal, bucket.currency)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t.tax}</span>
            <span>{formatMoney(bucket.tax, bucket.currency)}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between font-semibold">
            <span>{t.total}</span>
            <span className="text-lg">{formatMoney(bucket.total, bucket.currency)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

interface CurrencyBucket {
  currency: string
  subtotal: number
  tax: number
  total: number
}

function aggregateByCurrency(components: TripComponent[]): CurrencyBucket[] {
  const map = new Map<string, CurrencyBucket>()
  for (const component of components) {
    const code = component.componentCurrency
    if (!code) continue
    const entry = map.get(code) ?? { currency: code, subtotal: 0, tax: 0, total: 0 }
    entry.subtotal += component.componentSubtotalAmountCents ?? 0
    entry.tax += component.componentTaxAmountCents ?? 0
    entry.total += component.componentTotalAmountCents ?? 0
    map.set(code, entry)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export function PrimaryAction({
  status,
  componentCount,
  isBusy,
  pricePending,
  reservePending,
  onReserve,
}: {
  status: string | undefined
  componentCount: number
  isBusy: boolean
  pricePending: boolean
  reservePending: boolean
  onReserve(): void
}) {
  const t = useAdminMessages().trips.adminComposer.panels
  if (status === "checkout_started" || status === "booked") {
    return (
      <div className="rounded-md border bg-card p-3 text-center text-muted-foreground text-sm">
        {status === "booked" ? t.primaryAction.tripBooked : t.primaryAction.tripCheckoutInProgress}
      </div>
    )
  }

  if (status === "reserved") {
    return (
      <div className="rounded-md border bg-card p-3 text-center text-muted-foreground text-sm">
        {t.primaryAction.tripReserved}
      </div>
    )
  }

  if (componentCount === 0) {
    return null
  }

  if (pricePending) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="size-4 animate-spin" />
        {t.primaryAction.pricingTrip}
      </Button>
    )
  }

  if (status === "reserve_in_progress" || reservePending) {
    return (
      <Button disabled className="w-full">
        <Loader2 className="size-4 animate-spin" />
        {t.primaryAction.reservingTrip}
      </Button>
    )
  }

  // `failed` lands here after a reserve attempt errored — allow retry. `priced`
  // is the happy-path entry into reserve. Any other status (e.g. `draft`)
  // means pricing hasn't run yet — gate the button until that catches up.
  const canReserve = status === "priced" || status === "failed"
  return (
    <Button onClick={onReserve} disabled={isBusy || !canReserve} className="w-full">
      <Check className="size-4" />
      {status === "failed" ? t.primaryAction.retryReserve : t.primaryAction.reserveAndCreateLink}
    </Button>
  )
}

function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
      {children}
    </span>
  )
}

interface BillingDisplay {
  primary: string
  secondary: string
}

function resolveBillingDisplay(
  billing: PersonPickerValue,
  person:
    | { firstName?: string | null; lastName?: string | null; email?: string | null }
    | undefined,
  org: { name?: string | null } | undefined,
  messages: PanelsMessages,
): BillingDisplay {
  if (billing.billTo === "organization" && org?.name) {
    return { primary: org.name, secondary: messages.billingPreview.organizationSecondary }
  }
  if (billing.mode === "new") {
    const name = [billing.newPerson.firstName, billing.newPerson.lastName]
      .filter((part) => part.trim().length > 0)
      .join(" ")
      .trim()
    return {
      primary: name || billing.newPerson.email.trim(),
      secondary: name ? billing.newPerson.email.trim() : "",
    }
  }
  if (person) {
    const name = [person.firstName, person.lastName]
      .filter((part) => (part ?? "").trim().length > 0)
      .join(" ")
      .trim()
    return { primary: name || (person.email ?? ""), secondary: name ? (person.email ?? "") : "" }
  }
  return { primary: "", secondary: "" }
}

function Reference({
  label,
  value,
  href,
}: {
  label: string
  value: string | null | undefined
  href?: string
}) {
  if (!value) return null
  if (!href)
    return (
      <span>
        {label}: <span className="font-mono">{value.slice(0, 12)}…</span>
      </span>
    )
  return (
    <a className="inline-flex items-center gap-1 text-primary" href={href}>
      {label}: <span className="font-mono">{value.slice(0, 12)}…</span>
      <ExternalLink className="size-3" />
    </a>
  )
}

function componentIcon(component: TripComponent) {
  if (component.kind === "flight_placeholder" || component.kind === "flight_order") return Plane
  if (component.entityModule === "accommodations") return BedDouble
  if (component.kind === "manual_placeholder" || component.kind === "external_order")
    return Landmark
  return RouteIcon
}

function verticalIconFor(kind: PendingVerticalKind) {
  if (kind === "product") return RouteIcon
  if (kind === "stay") return BedDouble
  if (kind === "flight") return Plane
  if (kind === "cruise") return Sailboat
  return Wrench
}

function verticalLabelFor(kind: PendingVerticalKind, messages: PanelsMessages) {
  const found = verticalsFor(messages).find((vertical) => vertical.kind === kind)
  return found?.label ?? kind
}

export function readComponentSchedule(component: TripComponent): {
  start: string | null
  end: string | null
} {
  const md = component.metadata as
    | {
        scheduledStartsAt?: string | null
        scheduledEndsAt?: string | null
        bookingDraftV1?: {
          configure?: {
            dateRange?: { checkIn?: string | null; checkOut?: string | null }
          }
        }
        flightDraft?: { departDate?: string | null; returnDate?: string | null }
        cruiseDraft?: { embarkationDate?: string | null }
      }
    | undefined
  if (md?.scheduledStartsAt) {
    return { start: md.scheduledStartsAt, end: md.scheduledEndsAt ?? null }
  }
  const dateRange = md?.bookingDraftV1?.configure?.dateRange
  if (dateRange?.checkIn) {
    return { start: dateRange.checkIn, end: dateRange.checkOut ?? null }
  }
  const flight = md?.flightDraft
  if (flight?.departDate) {
    return { start: flight.departDate, end: flight.returnDate ?? null }
  }
  const cruise = md?.cruiseDraft
  if (cruise?.embarkationDate) {
    return { start: cruise.embarkationDate, end: null }
  }
  return { start: null, end: null }
}

export function formatScheduleLabel(component: TripComponent): string | null {
  const { start, end } = readComponentSchedule(component)
  if (!start) return null
  const startLabel = formatDateTime(start)
  if (!end || end === start) return startLabel
  return `${startLabel} → ${formatDateTime(end)}`
}

export function sortComponentsBySchedule(components: TripComponent[]): TripComponent[] {
  return [...components].sort((a, b) => {
    const aStart = readComponentSchedule(a).start
    const bStart = readComponentSchedule(b).start
    const aMs = aStart ? new Date(aStart).getTime() : Number.NaN
    const bMs = bStart ? new Date(bStart).getTime() : Number.NaN
    // Components without a schedule fall to the bottom, then ordered by sequence.
    const aMissing = Number.isNaN(aMs)
    const bMissing = Number.isNaN(bMs)
    if (aMissing && bMissing) return a.sequence - b.sequence
    if (aMissing) return 1
    if (bMissing) return -1
    if (aMs !== bMs) return aMs - bMs
    return a.sequence - b.sequence
  })
}

export function readPendingSchedule(pending: PendingComponent): {
  start: string | null
  end: string | null
} {
  if (pending.kind === "product" || pending.kind === "stay") {
    return { start: pending.startsAt || null, end: pending.endsAt || null }
  }
  if (pending.kind === "flight") {
    const offerSchedule = readFlightOfferSchedule(pending.selectedOffer)
    if (offerSchedule.start) return offerSchedule
    return { start: pending.departDate || null, end: pending.returnDate || null }
  }
  if (pending.kind === "cruise") {
    return { start: pending.embarkationDate || null, end: null }
  }
  return { start: pending.startsAt || null, end: pending.endsAt || null }
}

function readFlightOfferSchedule(offer: FlightOffer | null): {
  start: string | null
  end: string | null
} {
  if (!offer) return { start: null, end: null }
  const firstItinerary = offer.itineraries[0]
  const lastItinerary = offer.itineraries[offer.itineraries.length - 1]
  const firstSegment = firstItinerary?.segments[0]
  const lastSegment = lastItinerary?.segments[lastItinerary.segments.length - 1]
  return {
    start: firstSegment?.departure.at ?? null,
    end: lastSegment?.arrival.at ?? null,
  }
}

function toRange(start: string | null, end: string | null): [number, number] | null {
  if (!start) return null
  const startMs = new Date(start).getTime()
  if (Number.isNaN(startMs)) return null
  const endMs = end ? new Date(end).getTime() : startMs
  if (Number.isNaN(endMs)) return [startMs, startMs]
  return [startMs, Math.max(endMs, startMs)]
}

export function findOverlappingComponent(
  pending: PendingComponent,
  committed: TripComponent[],
): TripComponent | null {
  const { start: pStart, end: pEnd } = readPendingSchedule(pending)
  const pendingRange = toRange(pStart, pEnd)
  if (!pendingRange) return null
  for (const component of committed) {
    const { start, end } = readComponentSchedule(component)
    const range = toRange(start, end)
    if (!range) continue
    // Half-open overlap: [a1, a2) ∩ [b1, b2) ≠ ∅ iff a1 < b2 ∧ b1 < a2.
    if (pendingRange[0] < range[1] && range[0] < pendingRange[1]) return component
  }
  return null
}

export function componentTitleFor(
  component: TripComponent,
  resolvedEntityName?: string | null,
): string {
  const metadata = component.metadata as
    | {
        flightDraft?: {
          origin?: string | null
          destination?: string | null
        }
        cruiseDraft?: {
          cabin?: string | null
        }
        manualService?: {
          name?: string | null
        }
        catalogItem?: {
          name?: string | null
          thumbnailUrl?: string | null
        }
        accommodation?: {
          name?: string | null
          propertyName?: string | null
          roomTypeName?: string | null
        }
      }
    | undefined
  const entityName = cleanDisplayLabel(resolvedEntityName)
  if (entityName) return entityName

  const catalogName = cleanDisplayLabel(metadata?.catalogItem?.name)
  if (catalogName) return catalogName

  if (component.kind === "flight_placeholder" || component.kind === "flight_order") {
    const origin = cleanDisplayLabel(metadata?.flightDraft?.origin)
    const destination = cleanDisplayLabel(metadata?.flightDraft?.destination)
    if (origin && destination) return `${origin} → ${destination}`
  }

  if (component.entityModule === "cruises") {
    const cabin = cleanDisplayLabel(metadata?.cruiseDraft?.cabin)
    if (cabin) return `Cabin ${cabin}`
  }

  if (component.entityModule === "accommodations") {
    const accommodationName =
      cleanDisplayLabel(metadata?.accommodation?.propertyName) ??
      cleanDisplayLabel(metadata?.accommodation?.name) ??
      cleanDisplayLabel(metadata?.accommodation?.roomTypeName)
    if (accommodationName) return accommodationName
  }

  if (metadata?.cruiseDraft) {
    const cabin = cleanDisplayLabel(metadata.cruiseDraft.cabin)
    if (cabin) return `Cabin ${cabin}`
  }

  if (component.kind === "manual_placeholder") {
    const serviceName = cleanDisplayLabel(metadata?.manualService?.name)
    if (serviceName) return serviceName
    const title = cleanDisplayLabel(component.title)
    if (title) return title
    const description = cleanDisplayLabel(component.description)
    if (description) return description
  }

  return componentReferenceLabelFor(component)
}

export function componentOptionSummaryFor(component: TripComponent): string | null {
  const metadata = component.metadata as
    | {
        flightDraft?: {
          selectedOffer?: FlightOffer | null
          ancillaries?: AncillarySelection | null
        }
        bookingDraftV1?: {
          configure?: {
            optionSelections?: Array<{
              optionId?: string
              optionName?: string
              optionUnitId?: string
              optionUnitName?: string
              quantity?: number
            }>
          }
        }
      }
    | undefined
  if (metadata?.flightDraft) {
    const flightLabels = flightSelectionLabels(
      metadata.flightDraft.selectedOffer ?? null,
      metadata.flightDraft.ancillaries ?? null,
    )
    if (flightLabels.length > 0) return flightLabels.join(", ")
  }
  const selections = metadata?.bookingDraftV1?.configure?.optionSelections ?? []
  const labels = selections.flatMap((selection) => {
    const quantity =
      typeof selection.quantity === "number" && Number.isFinite(selection.quantity)
        ? selection.quantity
        : 0
    if (quantity <= 0) return []
    const name =
      cleanDisplayLabel(selection.optionName) ??
      cleanDisplayLabel(selection.optionUnitName) ??
      cleanDisplayLabel(selection.optionId) ??
      cleanDisplayLabel(selection.optionUnitId)
    if (!name) return []
    return [`${quantity} × ${name}`]
  })
  return labels.length > 0 ? labels.join(", ") : null
}

export function componentThumbnailFor(component: TripComponent): string | null {
  const metadata = component.metadata as
    | {
        catalogItem?: { thumbnailUrl?: string | null }
      }
    | undefined
  return cleanDisplayLabel(metadata?.catalogItem?.thumbnailUrl)
}

export function componentReferenceLabelFor(component: TripComponent): string {
  const reference =
    component.providerRef ??
    component.supplierRef ??
    component.bookingId ??
    component.orderId ??
    component.paymentSessionId ??
    component.sourceRef ??
    component.entityId ??
    component.id
  return reference.length > 18 ? reference.slice(0, 18) : reference
}

function cleanDisplayLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase()
  if (
    normalized === "untitled trip" ||
    normalized === "untitled component" ||
    normalized === "flight placeholder" ||
    normalized.startsWith("flight placeholder ") ||
    normalized === "manual placeholder" ||
    normalized === "cruise" ||
    normalized === "cruise placeholder" ||
    normalized === "catalog booking" ||
    normalized === "product booking" ||
    normalized === "stay booking" ||
    normalized === "cruise booking" ||
    normalized === "external order" ||
    normalized === "flight order" ||
    /^component \d+$/.test(normalized)
  ) {
    return null
  }
  return trimmed
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function paymentScheduleValueFromUnknown(value: unknown): PaymentScheduleValue {
  const record = recordFromUnknown(value)
  const mode = record?.mode === "split" ? "split" : record?.mode === "full" ? "full" : null
  if (!mode) return { ...emptyPaymentScheduleValue }
  return {
    ...emptyPaymentScheduleValue,
    ...record,
    mode,
  } as PaymentScheduleValue
}

// Backend-emitted noise codes that just acknowledge how the price was set —
// staff-built trips always carry `manual_placeholder_price` for manual /
// external / flight placeholders. `currency_mismatch:*` is also noise here
// because the rail already breaks totals out per currency.
function isUserVisibleWarning(code: string): boolean {
  if (code === "manual_placeholder_price") return false
  if (code.startsWith("currency_mismatch")) return false
  return true
}

export function formatDateTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  const hasTime = iso.includes("T") || iso.includes(" ")
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(parsed)
}

function formatDepartureLabel(slot: AvailabilitySlot): string {
  const date = formatDateTime(slot.startsAt)
  const duration = slot.nights ? ` · ${slot.nights}n` : slot.days ? ` · ${slot.days}d` : ""
  const capacity = slot.unlimited
    ? ""
    : slot.remainingPax != null
      ? ` · ${slot.remainingPax} left`
      : ""
  return `${date}${duration}${capacity}`
}

export function formatMoney(
  amountCents: number | null | undefined,
  currencyCode: string | null | undefined,
) {
  if (amountCents == null) return "-"
  return (amountCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: currencyCode ?? "EUR",
  })
}
