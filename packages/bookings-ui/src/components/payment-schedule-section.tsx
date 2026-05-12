"use client"

import { Button, Label } from "@voyantjs/ui/components"
import { CurrencyInput } from "@voyantjs/ui/components/currency-input"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

export type PaymentScheduleMode = "unpaid" | "full" | "advance" | "split"

export interface PaymentScheduleValue {
  mode: PaymentScheduleMode
  /** Used when mode === "full" — single due date for the whole amount. */
  fullDueDate: string | null
  /** Used when mode === "advance" — deposit amount collected up front. */
  advanceAmountCents: number | null
  advanceDueDate: string | null
  /** Used when mode === "split" — two installments. */
  splitFirstAmountCents: number | null
  splitFirstDueDate: string | null
  splitSecondAmountCents: number | null
  splitSecondDueDate: string | null
}

export const emptyPaymentScheduleValue: PaymentScheduleValue = {
  mode: "unpaid",
  fullDueDate: null,
  advanceAmountCents: null,
  advanceDueDate: null,
  splitFirstAmountCents: null,
  splitFirstDueDate: null,
  splitSecondAmountCents: null,
  splitSecondDueDate: null,
}

export interface PaymentScheduleSectionProps {
  value: PaymentScheduleValue
  onChange: (value: PaymentScheduleValue) => void
  /**
   * Booking total in cents. Enables the 50/50 preset in split mode and the
   * "Use balance" helper in advance mode. When unset the section still works
   * — operator types the amounts.
   */
  totalAmountCents?: number
  /** Used only for display formatting (e.g., "EUR"). No server-side effect. */
  currency?: string
  labels?: {
    heading?: string
    modeUnpaid?: string
    modeFull?: string
    modeAdvance?: string
    modeSplit?: string
    dueDate?: string
    amount?: string
    firstInstallment?: string
    secondInstallment?: string
    preset5050?: string
    unpaidHint?: string
  }
}

/**
 * Payment schedule picker for booking-create flows. Operators choose one of
 * four modes; only the relevant fields render for the selected mode, so the
 * UI stays narrow.
 *
 * The section produces a controlled `PaymentScheduleValue` — actually
 * creating `booking_payment_schedules` rows happens in the parent at submit
 * time, after the booking exists (schedules have a FK to `bookings.id`).
 *
 * ### Mapping guide for the parent
 *
 * - `unpaid`  → no schedules created.
 * - `full`    → one schedule with `scheduleType: "balance"`, dueDate =
 *               fullDueDate, amountCents = bookingTotalAmountCents.
 * - `advance` → two schedules: { type: "deposit", dueDate = advanceDueDate,
 *               amountCents = advanceAmountCents } + { type: "balance",
 *               dueDate = fullDueDate ?? sensible-default, amountCents =
 *               total - advanceAmountCents }.
 * - `split`   → two schedules with `scheduleType: "installment"`.
 */
export function PaymentScheduleSection({
  value,
  onChange,
  totalAmountCents,
  currency,
  labels,
}: PaymentScheduleSectionProps) {
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.paymentScheduleSection.labels, ...labels }
  const set = (patch: Partial<PaymentScheduleValue>) => onChange({ ...value, ...patch })

  const modes: Array<{ id: PaymentScheduleMode; label: string }> = [
    { id: "unpaid", label: merged.modeUnpaid },
    { id: "full", label: merged.modeFull },
    { id: "advance", label: merged.modeAdvance },
    { id: "split", label: merged.modeSplit },
  ]

  const handlePreset5050 = () => {
    if (!totalAmountCents) return
    const half = Math.floor(totalAmountCents / 2)
    // Floor + remainder assignment avoids rounding-off-by-one: a total of
    // 9999 cents splits into 4999 + 5000 rather than 4999 + 4999.
    set({
      splitFirstAmountCents: half,
      splitSecondAmountCents: totalAmountCents - half,
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <Label>{merged.heading}</Label>

      <div className="flex flex-wrap items-center gap-2">
        {modes.map((mode) => (
          <Button
            key={mode.id}
            type="button"
            size="sm"
            variant={value.mode === mode.id ? "default" : "ghost"}
            onClick={() => set({ mode: mode.id })}
          >
            {mode.label}
          </Button>
        ))}
      </div>

      {value.mode === "unpaid" && (
        <p className="text-xs text-muted-foreground">{merged.unpaidHint}</p>
      )}

      {value.mode === "full" && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{merged.dueDate}</Label>
          <DatePicker
            value={value.fullDueDate ?? ""}
            onChange={(nextValue) => set({ fullDueDate: nextValue })}
          />
        </div>
      )}

      {value.mode === "advance" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{merged.amount}</Label>
            <CurrencyInput
              value={value.advanceAmountCents}
              onChange={(next) => set({ advanceAmountCents: next })}
              currency={currency}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{merged.dueDate}</Label>
            <DatePicker
              value={value.advanceDueDate ?? ""}
              onChange={(nextValue) => set({ advanceDueDate: nextValue })}
            />
          </div>
        </div>
      )}

      {value.mode === "split" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{merged.firstInstallment}</span>
            {totalAmountCents ? (
              <Button type="button" variant="ghost" size="sm" onClick={handlePreset5050}>
                {merged.preset5050}
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CurrencyInput
              placeholder={merged.amount}
              value={value.splitFirstAmountCents}
              onChange={(next) => set({ splitFirstAmountCents: next })}
              currency={currency}
            />
            <DatePicker
              value={value.splitFirstDueDate ?? ""}
              onChange={(nextValue) => set({ splitFirstDueDate: nextValue })}
            />
          </div>

          <div className="text-xs font-medium">{merged.secondInstallment}</div>
          <div className="grid grid-cols-2 gap-2">
            <CurrencyInput
              placeholder={merged.amount}
              value={value.splitSecondAmountCents}
              onChange={(next) => set({ splitSecondAmountCents: next })}
              currency={currency}
            />
            <DatePicker
              value={value.splitSecondDueDate ?? ""}
              onChange={(nextValue) => set({ splitSecondDueDate: nextValue })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
