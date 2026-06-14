"use client"

/**
 * Admin voucher picker — an async combobox over the admin vouchers list.
 * Staff search by code and pick a voucher (the full remaining balance is
 * redeemed); they never need to know the exact code, unlike storefront
 * customers. Wired into `<BookingJourneyHost />` via `renderVoucherPicker`.
 */

import { useOperatorAdminMessages } from "@voyant-travel/admin"
import { useVouchers, type VoucherRecord } from "@voyant-travel/finance-react"
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

import type { VoucherPickerProps } from "../journey/index.js"

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

function voucherLabel(voucher: VoucherRecord): string {
  return `${voucher.code} · ${formatMoney(voucher.remainingAmountCents, voucher.currency)}`
}

export function JourneyVoucherPicker({ value, onApply }: VoucherPickerProps): React.ReactElement {
  const t = useOperatorAdminMessages().bookings.detail.bookingJourney
  const [inputValue, setInputValue] = useState("")
  const [search, setSearch] = useState("")

  // Active vouchers with a remaining balance, filtered by the typed code.
  const query = useVouchers({
    status: "active",
    hasBalance: true,
    search: search || undefined,
    limit: 20,
  })
  const vouchers = query.data?.data ?? []
  const byId = new Map(vouchers.map((v) => [v.id, v] as const))
  const selectedId = value.voucherId ?? null

  // Reflect a pre-selected voucher's label once its record loads.
  useEffect(() => {
    if (selectedId && byId.has(selectedId)) {
      setInputValue(voucherLabel(byId.get(selectedId)!))
    }
  }, [selectedId, byId])

  return (
    <div className="space-y-1">
      <Label>{t.voucherPickerLabel}</Label>
      <Combobox
        items={vouchers.map((v) => v.id)}
        value={selectedId}
        inputValue={inputValue}
        autoHighlight
        itemToStringLabel={(id) => {
          const v = byId.get(id as string)
          return v ? voucherLabel(v) : (id as string)
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
            onApply({ voucherId: v.id, amountCents: v.remainingAmountCents })
            setInputValue(voucherLabel(v))
          }
        }}
      >
        <ComboboxInput placeholder={t.voucherSearchPlaceholder} showClear={!!selectedId} />
        <ComboboxContent>
          <ComboboxEmpty>{t.voucherEmpty}</ComboboxEmpty>
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
