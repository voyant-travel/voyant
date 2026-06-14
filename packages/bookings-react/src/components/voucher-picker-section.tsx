"use client"

import { usePublicVoucherValidationMutation } from "@voyant-travel/finance-react"
import { Button, Input, Label } from "@voyant-travel/ui/components"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

/** Details of a successfully-validated voucher. */
export interface PickedVoucher {
  id: string
  code: string
  label: string | null
  currency: string | null
  remainingAmountCents: number | null
  expiresAt: string | null
}

export interface VoucherPickerValue {
  /** Code typed by the operator. Not cleared on failure so they can correct a typo. */
  code: string
  /** Populated only when the last validate call succeeded. */
  picked: PickedVoucher | null
  /** Reason returned by the server when validate fails, or a client-side message. */
  error: string | null
}

export const emptyVoucherPickerValue: VoucherPickerValue = {
  code: "",
  picked: null,
  error: null,
}

export interface VoucherPickerSectionProps {
  value: VoucherPickerValue
  onChange: (value: VoucherPickerValue) => void
  /**
   * Context for the validate call — when provided, the server rejects vouchers
   * locked to a different booking / mismatched currency / insufficient balance.
   */
  bookingId?: string
  currency?: string
  amountCents?: number
  labels?: {
    heading?: string
    codePlaceholder?: string
    apply?: string
    clear?: string
    remainingLabel?: string
    invalidLabel?: string
  }
}

/**
 * Voucher picker for booking-create flows. Operator enters a code, clicks
 * Apply, and the server-side `/v1/public/vouchers/validate` runs all the
 * usual guards (status, expiry, currency, booking-assignment, balance).
 *
 * The section only *validates* — it doesn't redeem. Redemption happens when
 * the parent calls `POST /v1/finance/vouchers/:id/redeem` at submit time,
 * after the booking exists and the final amount is known. Validate being
 * idempotent means the operator can try a code, correct a typo, and try
 * again without leaving a trail.
 */
export function VoucherPickerSection({
  value,
  onChange,
  bookingId,
  currency,
  amountCents,
  labels,
}: VoucherPickerSectionProps) {
  const { formatCurrency } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.voucherPickerSection.labels, ...labels }
  const validate = usePublicVoucherValidationMutation()

  const handleApply = async () => {
    const code = value.code.trim()
    if (!code) return

    try {
      const { data } = await validate.mutateAsync({
        code,
        bookingId: bookingId ?? undefined,
        currency: currency ?? undefined,
        amountCents: amountCents ?? undefined,
      })

      if (data.valid && data.voucher) {
        onChange({
          code,
          picked: {
            id: data.voucher.id,
            code: data.voucher.code,
            label: data.voucher.label,
            currency: data.voucher.currency,
            remainingAmountCents: data.voucher.remainingAmountCents,
            expiresAt: data.voucher.expiresAt,
          },
          error: null,
        })
        return
      }

      onChange({
        code,
        picked: null,
        error:
          messages.voucherPickerSection.reasonMessages[
            data.reason as keyof typeof messages.voucherPickerSection.reasonMessages
          ] ?? messages.voucherPickerSection.validation.invalid,
      })
    } catch (err) {
      onChange({
        code,
        picked: null,
        error:
          err instanceof Error
            ? err.message
            : messages.voucherPickerSection.validation.lookupFailed,
      })
    }
  }

  const handleClear = () => onChange(emptyVoucherPickerValue)

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Label>{merged.heading}</Label>
      <div className="flex items-center gap-2">
        <Input
          value={value.code}
          onChange={(e) => onChange({ ...value, code: e.target.value, error: null })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void handleApply()
            }
          }}
          placeholder={merged.codePlaceholder}
          disabled={validate.isPending || Boolean(value.picked)}
        />
        {value.picked ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            {merged.clear}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => void handleApply()}
            disabled={validate.isPending || !value.code.trim()}
          >
            {validate.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {merged.apply}
          </Button>
        )}
      </div>

      {value.picked && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>
            {merged.remainingLabel}{" "}
            <strong>
              {value.picked.remainingAmountCents == null || !value.picked.currency
                ? messages.voucherPickerSection.validation.amountUnavailable
                : formatCurrency(value.picked.remainingAmountCents / 100, value.picked.currency)}
            </strong>
          </span>
        </div>
      )}

      {value.error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4" />
          <span>
            {merged.invalidLabel} {value.error}
          </span>
        </div>
      )}
    </div>
  )
}
