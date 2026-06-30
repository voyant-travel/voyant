"use client"

import { useOperatorAdminMessages as useAdminMessages } from "@voyant-travel/admin"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { CurrencyInput } from "@voyant-travel/ui/components/currency-input"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { DateTimeField } from "@voyant-travel/ui/components/date-time-field"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@voyant-travel/ui/components/empty"
import { Input } from "@voyant-travel/ui/components/input"
import { Textarea } from "@voyant-travel/ui/components/textarea"
import { Route as RouteIcon } from "lucide-react"

import { formatMoney } from "./display.js"
import { computePlaceholderTotals, Field, type PendingComponent } from "./shared.js"

export function CruiseConfigurator({
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
          <DatePicker
            value={pending.embarkationDate || null}
            onChange={(value) => onChange({ ...pending, embarkationDate: value ?? "" })}
            placeholder={t.pickDate}
            className="w-full"
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

export function PlaceholderConfigurator({
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
