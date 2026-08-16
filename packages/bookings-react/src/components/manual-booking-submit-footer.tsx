"use client"

import { Button } from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"

/**
 * DOM id of the reason paragraph, so **Create booking** can point
 * `aria-describedby` at it. A literal rather than `useId` because the manual
 * create form renders exactly one of these.
 */
export const MANUAL_BOOKING_SUBMIT_BLOCKED_ID = "manual-booking-submit-blocked"

export interface ManualBookingSubmitFooterProps {
  submitting: boolean
  submitBlocked: boolean
  /**
   * Why **Create booking** is shut, already formatted for display. `null`
   * when nothing is blocking, or when the same sentence is already rendered
   * as an alert a couple of lines above this footer.
   */
  blockedReason: string | null
  cancelLabel: string
  submitLabel: string
  onCancel: () => void
}

/**
 * The manual create form's action row.
 *
 * voyant#4762: **Create booking** used to be `disabled` with no `title`, no
 * `aria-describedby` and no adjacent text, so seven independent conditions all
 * rendered as the same dead button. The one message that did exist sat with
 * the Options section near the top of the form, far enough from the button
 * that operators read it as the document checkboxes beside it instead.
 *
 * The reason is rendered here, next to the control it explains, and pointed at
 * from the button — `title` alone would be invisible on touch and to screen
 * readers.
 */
export function ManualBookingSubmitFooter({
  submitting,
  submitBlocked,
  blockedReason,
  cancelLabel,
  submitLabel,
  onCancel,
}: ManualBookingSubmitFooterProps) {
  // While submitting, the button is busy rather than blocked, and saying why
  // it cannot be pressed would contradict the spinner.
  const reason = submitting ? null : blockedReason
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t px-1 pt-3">
      {reason ? (
        <p id={MANUAL_BOOKING_SUBMIT_BLOCKED_ID} className="mr-auto text-xs text-muted-foreground">
          {reason}
        </p>
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        size="sm"
        disabled={submitting || submitBlocked}
        aria-describedby={reason ? MANUAL_BOOKING_SUBMIT_BLOCKED_ID : undefined}
      >
        {submitting ? (
          <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
        ) : null}
        {submitLabel}
      </Button>
    </div>
  )
}
