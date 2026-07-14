"use client"

import { usePublicTravelCreditValidationMutation } from "@voyant-travel/finance-react"
import { Button, Input, Label } from "@voyant-travel/ui/components"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

/** Details of a successfully validated Travel Credit. */
export interface PickedTravelCredit {
  id: string
  code: string
  currency: string | null
  remainingAmountCents: number | null
  expiresAt: string | null
}

export interface TravelCreditPickerValue {
  /** Code typed by the operator. Not cleared on failure so they can correct a typo. */
  code: string
  /** Populated only when the last validate call succeeded. */
  picked: PickedTravelCredit | null
  /** Reason returned by the server when validate fails, or a client-side message. */
  error: string | null
}

export const emptyTravelCreditPickerValue: TravelCreditPickerValue = {
  code: "",
  picked: null,
  error: null,
}

export interface TravelCreditPickerSectionProps {
  value: TravelCreditPickerValue
  onChange: (value: TravelCreditPickerValue) => void
  /**
   * Context for the validate call. When provided, the server rejects Travel Credits
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
 * Travel Credit picker for booking-create flows. The operator enters a code, clicks
 * Apply, and the server-side `/v1/public/finance/travel-credits/validate` runs all the
 * usual guards (status, expiry, currency, booking-assignment, balance).
 *
 * The section only *validates* — it doesn't redeem. Redemption happens when
 * the parent calls `POST /v1/admin/finance/travel-credits/:id/redeem` at submit time,
 * after the booking exists and the final amount is known. Validate being
 * idempotent means the operator can try a code, correct a typo, and try
 * again without leaving a trail.
 */
export function TravelCreditPickerSection({
  value,
  onChange,
  bookingId,
  currency,
  amountCents,
  labels,
}: TravelCreditPickerSectionProps) {
  const { formatCurrency } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.travelCreditPickerSection.labels, ...labels }
  const validate = usePublicTravelCreditValidationMutation()

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

      if (data.valid && data.travelCredit) {
        onChange({
          code,
          picked: {
            id: data.travelCredit.id,
            code: data.travelCredit.code,
            currency: data.travelCredit.currency,
            remainingAmountCents: data.travelCredit.remainingAmountCents,
            expiresAt: data.travelCredit.expiresAt,
          },
          error: null,
        })
        return
      }

      onChange({
        code,
        picked: null,
        error:
          messages.travelCreditPickerSection.reasonMessages[
            data.reason as keyof typeof messages.travelCreditPickerSection.reasonMessages
          ] ?? messages.travelCreditPickerSection.validation.invalid,
      })
    } catch (err) {
      onChange({
        code,
        picked: null,
        error:
          err instanceof Error
            ? err.message
            : messages.travelCreditPickerSection.validation.lookupFailed,
      })
    }
  }

  const handleClear = () => onChange(emptyTravelCreditPickerValue)

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
                ? messages.travelCreditPickerSection.validation.amountUnavailable
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
