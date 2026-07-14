"use client"

/**
 * Admin Travel Credit picker: an async combobox over the admin Travel Credit list.
 * Staff search by code and pick a Travel Credit (the full remaining balance is
 * redeemed); they never need to know the exact code, unlike storefront
 * customers. Wired into `<BookingJourneyHost />` via `renderTravelCreditPicker`.
 */

import { useOperatorAdminMessages } from "@voyant-travel/admin"
import { type TravelCreditRecord, useTravelCredits } from "@voyant-travel/finance-react"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyant-travel/ui/components/combobox"
import { Label } from "@voyant-travel/ui/components/label"
import { useEffect, useState } from "react"

import type { TravelCreditPickerProps } from "../journey/index.js"

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function travelCreditLabel(travelCredit: TravelCreditRecord): string {
  return `${travelCredit.code} · ${formatMoney(travelCredit.remainingAmountCents, travelCredit.currency)}`
}

export function JourneyTravelCreditPicker({
  value,
  onApply,
}: TravelCreditPickerProps): React.ReactElement {
  const t = useOperatorAdminMessages().bookings.detail.bookingJourney
  const [inputValue, setInputValue] = useState("")
  const [search, setSearch] = useState("")

  // Active Travel Credits with a remaining balance, filtered by the typed code.
  const query = useTravelCredits({
    status: "active",
    hasBalance: true,
    search: search || undefined,
    limit: 20,
  })
  const travelCredits = query.data?.data ?? []
  const byId = new Map(
    travelCredits.map((travelCredit) => [travelCredit.id, travelCredit] as const),
  )
  const selectedId = value.travelCreditId ?? null

  // Reflect a pre-selected Travel Credit's label once its record loads.
  useEffect(() => {
    if (selectedId && byId.has(selectedId)) {
      setInputValue(travelCreditLabel(byId.get(selectedId)!))
    }
  }, [selectedId, byId])

  return (
    <div className="space-y-1">
      <Label>{t.travelCreditPickerLabel}</Label>
      <Combobox
        items={travelCredits.map((travelCredit) => travelCredit.id)}
        value={selectedId}
        inputValue={inputValue}
        autoHighlight
        itemToStringLabel={(id) => {
          const v = byId.get(id as string)
          return v ? travelCreditLabel(v) : (id as string)
        }}
        itemToStringValue={(id) => id as string}
        onInputValueChange={(next) => {
          setInputValue(next)
          setSearch(next)
          if (!next) onApply(null)
        }}
        onValueChange={(next) => {
          const id = (next as string | null) ?? null
          if (!id) {
            onApply(null)
            setInputValue("")
            return
          }
          const v = byId.get(id)
          if (v) {
            onApply({ travelCreditId: v.id, amountCents: v.remainingAmountCents })
            setInputValue(travelCreditLabel(v))
          }
        }}
      >
        <ComboboxInput placeholder={t.travelCreditSearchPlaceholder} showClear={!!selectedId} />
        <ComboboxContent>
          <ComboboxEmpty>{t.travelCreditEmpty}</ComboboxEmpty>
          <ComboboxList>
            <ComboboxCollection>
              {(id) => {
                const v = byId.get(id as string)
                if (!v) return null
                return (
                  <ComboboxItem key={v.id} value={v.id}>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{v.code}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {formatMoney(v.remainingAmountCents, v.currency)}
                      </span>
                    </div>
                  </ComboboxItem>
                )
              }}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
