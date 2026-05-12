"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@voyantjs/ui/components/accordion"
import { Card, CardContent } from "@voyantjs/ui/components/card"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { formatMessage, useBookingsUiMessagesOrDefault } from "../../i18n/index.js"
import type { BookingEntitySummary, JourneyStep, SidePanelState } from "../types.js"

/**
 * Right-rail summary panel. Shows what's being booked, an
 * accordion-per-step recap of the user's input, and the live
 * pricing breakdown at the bottom. The current step's accordion is
 * expanded by default; users can click any step to peek at what
 * they've filled in elsewhere.
 */
export function PriceSidePanel({
  pricing,
  isQuoting,
  invalidReason,
  entitySummary,
  currentStep,
  steps,
  draft,
  className,
}: SidePanelState & { className?: string }): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <Card className={className}>
      {entitySummary ? <EntityHeader summary={entitySummary} /> : null}
      <CardContent className="space-y-4">
        {steps && steps.length > 0 && currentStep && draft ? (
          <StepRecap steps={steps} currentStep={currentStep} draft={draft} />
        ) : null}

        {isQuoting && !pricing ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : null}
        {invalidReason ? <p className="text-destructive text-sm">{invalidReason}</p> : null}
        {pricing ? (
          <div className="space-y-2 border-t pt-4">
            <ul className="space-y-1 text-sm">
              {pricing.lines.map((line) => (
                <li
                  key={`${line.kind}-${line.label}-${line.totalAmount}`}
                  className="flex justify-between"
                >
                  <span>
                    {line.label}
                    {line.quantity ? (
                      <span className="text-muted-foreground"> × {line.quantity}</span>
                    ) : null}
                  </span>
                  <span>{formatMoney(line.totalAmount, pricing.currency)}</span>
                </li>
              ))}
            </ul>
            {pricing.taxes.length > 0 ? (
              <ul className="space-y-1 border-t pt-2 text-sm text-muted-foreground">
                {pricing.taxes.map((tax) => (
                  <li key={tax.code} className="flex justify-between">
                    <span>{tax.label}</span>
                    <span>{formatMoney(tax.amount, pricing.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex justify-between border-t pt-2 font-medium">
              <span>{messages.bookingJourney.sidePanel.total}</span>
              <span>{formatMoney(pricing.total, pricing.currency)}</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function EntityHeader({ summary }: { summary: BookingEntitySummary }): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  return (
    <div className="overflow-hidden rounded-t-xl">
      {summary.heroImageUrl ? (
        <img
          src={summary.heroImageUrl}
          alt={summary.name}
          className="aspect-video w-full object-cover"
        />
      ) : null}
      <div className="space-y-1 px-6 pt-4 pb-2">
        <div className="text-muted-foreground text-xs uppercase tracking-wide">
          {messages.bookingJourney.sidePanel.youAreBooking}
        </div>
        <div className="font-semibold leading-tight">{summary.name}</div>
        {summary.subtitle ? (
          <div className="text-muted-foreground text-sm">{summary.subtitle}</div>
        ) : null}
        {summary.whenLabel || summary.locationLabel ? (
          <div className="text-muted-foreground text-xs">
            {[summary.whenLabel, summary.locationLabel].filter(Boolean).join(" · ")}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function StepRecap({
  steps,
  currentStep,
  draft,
}: {
  steps: ReadonlyArray<JourneyStep>
  currentStep: JourneyStep
  draft: SidePanelState["draft"]
}): React.ReactElement | null {
  const messages = useBookingsUiMessagesOrDefault()
  if (!draft) return null
  // Default-open the current step. Uncontrolled — users can toggle
  // freely. Re-mounts when currentStep changes (key) so the
  // newly-active step opens automatically as the user advances.
  return (
    <Accordion key={currentStep} defaultValue={[currentStep]} multiple>
      {steps.map((step) => (
        <AccordionItem key={step} value={step}>
          <AccordionTrigger className="py-3">
            <div className="flex flex-1 flex-col text-left">
              <span
                className={
                  step === currentStep ? "font-semibold" : "text-muted-foreground font-medium"
                }
              >
                {stepLabel(step, messages)}
              </span>
              <StepSummaryLine step={step} draft={draft} />
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <StepDetails step={step} draft={draft} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function StepSummaryLine({
  step,
  draft,
}: {
  step: JourneyStep
  draft: NonNullable<SidePanelState["draft"]>
}): React.ReactElement | null {
  const messages = useBookingsUiMessagesOrDefault()
  const text = stepHeadline(step, draft, messages)
  if (!text) return null
  return <span className="text-muted-foreground text-xs">{text}</span>
}

function stepHeadline(
  step: JourneyStep,
  draft: NonNullable<SidePanelState["draft"]>,
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>,
): string {
  switch (step) {
    case "configure": {
      const total = paxTotal(draft)
      const slot = draft.configure?.departureSlotId ?? draft.configure?.departureDate ?? undefined
      const range = draft.configure?.dateRange
      const when = range?.checkIn && range?.checkOut ? `${range.checkIn} → ${range.checkOut}` : slot
      const guestLabel =
        total === 1
          ? messages.bookingJourney.sidePanel.guestSingular
          : messages.bookingJourney.sidePanel.guestPlural
      return when ? `${total} ${guestLabel} · ${when}` : `${total} ${guestLabel}`
    }
    case "billing": {
      const c = draft.billing.contact
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim()
      return name || c.email || messages.bookingJourney.values.notSet
    }
    case "travelers": {
      const filled = draft.travelers.filter((t) => t.firstName && t.lastName).length
      return formatMessage(messages.bookingJourney.sidePanel.filledOf, {
        filled,
        total: draft.travelers.length,
      })
    }
    case "accommodation": {
      const rooms = draft.accommodation?.rooms ?? []
      if (rooms.length === 0) return ""
      return `${rooms.length} ${
        rooms.length === 1
          ? messages.bookingJourney.sidePanel.roomSingular
          : messages.bookingJourney.sidePanel.roomPlural
      }`
    }
    case "addons": {
      const addons = draft.addons ?? []
      if (addons.length === 0) return messages.bookingJourney.values.none
      return `${addons.length} ${
        addons.length === 1
          ? messages.bookingJourney.sidePanel.addOnSingular
          : messages.bookingJourney.sidePanel.addOnPlural
      }`
    }
    case "payment": {
      const intent = draft.payment.intent
      if (intent === "card") return messages.bookingJourney.sidePanel.card
      if (intent === "hold") return messages.bookingJourney.sidePanel.hold
      if (intent === "ticket_on_credit") return messages.bookingJourney.sidePanel.onCredit
      return ""
    }
    case "review":
      return messages.bookingJourney.sidePanel.confirmAndBook
    default:
      return ""
  }
}

function StepDetails({
  step,
  draft,
}: {
  step: JourneyStep
  draft: NonNullable<SidePanelState["draft"]>
}): React.ReactElement | null {
  const messages = useBookingsUiMessagesOrDefault()
  switch (step) {
    case "configure":
      return <ConfigureDetails draft={draft} />
    case "billing":
      return <BillingDetails draft={draft} />
    case "travelers":
      return <TravelersDetails draft={draft} />
    case "accommodation":
      return <AccommodationDetails draft={draft} />
    case "addons":
      return <AddonsDetails draft={draft} />
    case "payment":
      return <PaymentDetails draft={draft} />
    case "review":
      return (
        <p className="text-muted-foreground text-xs">
          {messages.bookingJourney.sidePanel.reviewDetails}
        </p>
      )
    default:
      return null
  }
}

function ConfigureDetails({
  draft,
}: {
  draft: NonNullable<SidePanelState["draft"]>
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const cfg = draft.configure ?? {}
  const range = cfg.dateRange
  return (
    <dl className="space-y-1 text-xs">
      <Row label={messages.bookingJourney.sidePanel.adults} value={String(cfg.pax?.adult ?? 0)} />
      {(cfg.pax?.child ?? 0) > 0 ? (
        <Row label={messages.bookingJourney.sidePanel.children} value={String(cfg.pax.child)} />
      ) : null}
      {(cfg.pax?.infant ?? 0) > 0 ? (
        <Row label={messages.bookingJourney.sidePanel.infants} value={String(cfg.pax.infant)} />
      ) : null}
      {cfg.departureSlotId ? (
        <Row label={messages.bookingJourney.sidePanel.departure} value={cfg.departureSlotId} />
      ) : null}
      {cfg.departureDate ? (
        <Row label={messages.bookingJourney.sidePanel.date} value={cfg.departureDate} />
      ) : null}
      {range?.checkIn ? (
        <Row label={messages.bookingJourney.sidePanel.checkIn} value={range.checkIn} />
      ) : null}
      {range?.checkOut ? (
        <Row label={messages.bookingJourney.sidePanel.checkOut} value={range.checkOut} />
      ) : null}
      {cfg.cabinCategoryId ? (
        <Row label={messages.bookingJourney.sidePanel.cabin} value={cfg.cabinCategoryId} />
      ) : null}
    </dl>
  )
}

function BillingDetails({
  draft,
}: {
  draft: NonNullable<SidePanelState["draft"]>
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const c = draft.billing.contact
  const a = draft.billing.address
  const addressLine = [a.line1, a.line2, a.city, a.postal, a.country].filter(Boolean).join(", ")
  return (
    <dl className="space-y-1 text-xs">
      <Row
        label={messages.bookingJourney.sidePanel.name}
        value={
          [c.firstName, c.lastName].filter(Boolean).join(" ") ||
          messages.bookingJourney.values.noValue
        }
      />
      <Row
        label={messages.bookingJourney.sidePanel.email}
        value={c.email || messages.bookingJourney.values.noValue}
      />
      {c.phone ? <Row label={messages.bookingJourney.sidePanel.phone} value={c.phone} /> : null}
      <Row
        label={messages.bookingJourney.sidePanel.buyer}
        value={
          draft.billing.buyerType === "B2B"
            ? messages.bookingJourney.sidePanel.company
            : messages.bookingJourney.sidePanel.individual
        }
      />
      {draft.billing.company?.name ? (
        <Row label={messages.bookingJourney.sidePanel.company} value={draft.billing.company.name} />
      ) : null}
      {draft.billing.company?.vatId ? (
        <Row label={messages.bookingJourney.sidePanel.vat} value={draft.billing.company.vatId} />
      ) : null}
      {addressLine ? (
        <Row label={messages.bookingJourney.sidePanel.address} value={addressLine} />
      ) : null}
    </dl>
  )
}

function TravelersDetails({
  draft,
}: {
  draft: NonNullable<SidePanelState["draft"]>
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  if (draft.travelers.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {messages.bookingJourney.sidePanel.noTravelersYet}
      </p>
    )
  }
  return (
    <ul className="space-y-3 text-xs">
      {draft.travelers.map((t, i) => {
        const key = t.rowId ?? `t-${i}`
        const name = [t.firstName, t.lastName].filter(Boolean).join(" ").trim()
        const docType = t.documents?.documentType as string | undefined
        const docNum = t.documents?.documentNumber as string | undefined
        const docExpiry = t.documents?.documentExpiry as string | undefined
        const docLine = [docType, docNum, docExpiry ? `exp ${docExpiry}` : null]
          .filter(Boolean)
          .join(" · ")
        return (
          <li key={key} className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">
                {formatMessage(messages.bookingJourney.sidePanel.travelerNumber, {
                  number: i + 1,
                })}
              </span>
              <span className="truncate font-medium">
                {name || messages.bookingJourney.values.noValue}
              </span>
            </div>
            {t.email ? <div className="text-muted-foreground truncate">{t.email}</div> : null}
            {t.phone ? <div className="text-muted-foreground">{t.phone}</div> : null}
            {t.dateOfBirth ? (
              <div className="text-muted-foreground">
                {messages.bookingJourney.sidePanel.dob} {t.dateOfBirth}
              </div>
            ) : null}
            {docLine ? <div className="text-muted-foreground">{docLine}</div> : null}
          </li>
        )
      })}
    </ul>
  )
}

function AccommodationDetails({
  draft,
}: {
  draft: NonNullable<SidePanelState["draft"]>
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const rooms = draft.accommodation?.rooms ?? []
  if (rooms.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {messages.bookingJourney.sidePanel.notSelected}
      </p>
    )
  }
  return (
    <ul className="space-y-1 text-xs">
      {rooms.map((r) => (
        <li
          key={`${r.optionUnitId}-${r.ratePlanId ?? ""}-${r.quantity}`}
          className="flex justify-between gap-2"
        >
          <span className="truncate">{r.optionUnitId}</span>
          <span className="text-muted-foreground">
            × {r.quantity}
            {r.ratePlanId ? ` · ${r.ratePlanId}` : ""}
          </span>
        </li>
      ))}
    </ul>
  )
}

function AddonsDetails({
  draft,
}: {
  draft: NonNullable<SidePanelState["draft"]>
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const addons = draft.addons ?? []
  if (addons.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {messages.bookingJourney.sidePanel.noAddonsSelected}
      </p>
    )
  }
  return (
    <ul className="space-y-1 text-xs">
      {addons.map((a) => (
        <li key={`${a.extraId}-${a.quantity}`} className="flex justify-between gap-2">
          <span className="truncate">{a.extraId}</span>
          <span className="text-muted-foreground">× {a.quantity}</span>
        </li>
      ))}
    </ul>
  )
}

function PaymentDetails({
  draft,
}: {
  draft: NonNullable<SidePanelState["draft"]>
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const intent = draft.payment.intent
  const label =
    intent === "card"
      ? messages.bookingJourney.sidePanel.payByCard
      : intent === "ticket_on_credit"
        ? messages.bookingJourney.sidePanel.ticketOnCredit
        : messages.bookingJourney.sidePanel.holdNoChargeYet
  return (
    <dl className="space-y-1 text-xs">
      <Row label={messages.bookingJourney.sidePanel.method} value={label} />
      {draft.payment.schedule ? (
        <Row
          label={messages.bookingJourney.sidePanel.schedule}
          value={String(draft.payment.schedule)}
        />
      ) : null}
    </dl>
  )
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  )
}

function stepLabel(
  step: JourneyStep,
  messages: ReturnType<typeof useBookingsUiMessagesOrDefault>,
): string {
  if (step === "billing") return messages.bookingJourney.steps.billingAndContact
  return messages.bookingJourney.steps[step]
}

function paxTotal(draft: NonNullable<SidePanelState["draft"]>): number {
  const pax = draft.configure?.pax ?? {}
  return (pax.adult ?? 0) + (pax.child ?? 0) + (pax.infant ?? 0)
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}
