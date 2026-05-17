import type { BookingStatus } from "./state-machine.js"

export interface BookingStatusDispatchTarget {
  /**
   * Path of the verb endpoint to POST to, including `/v1/bookings/:id` prefix.
   * Always begins with a `/`.
   */
  path: string
  /**
   * JSON body the server expects for the resolved verb.
   *
   * - For named verbs (`/confirm`, `/expire`, `/start`, `/complete`, `/cancel`)
   *   this is `{ note }` when a note is provided, otherwise an empty object.
   * - For `/override-status` it is `{ status, reason, note? }` — the server
   *   rejects empty reasons with a 400, so callers should pass a meaningful
   *   note when the dispatch falls through to override.
   */
  body: Record<string, unknown>
}

/**
 * Map (currentStatus, targetStatus) → which verb endpoint to call. Lifecycle
 * arrows that have a named verb on the server go to that verb; everything else
 * (non-adjacent jumps, e.g. cancelled → confirmed for data correction) falls
 * through to /override-status, which requires a reason. The note text is used
 * as the reason — the server rejects empty reasons with a 400.
 *
 * Framework-agnostic: returns the URL + body to send. Callers own the
 * transport (fetch, axios, the React hook, server-to-server scripts, etc).
 */
export function dispatchBookingStatusChange(
  bookingId: string,
  current: BookingStatus,
  target: BookingStatus,
  note?: string | null,
  options?: { suppressNotifications?: boolean },
): BookingStatusDispatchTarget {
  const noteBody = note ? { note } : {}
  // Only carry the suppression flag on transitions to `confirmed` —
  // it's the only transition that triggers customer-facing
  // notifications today. Including it elsewhere is harmless but noisy.
  const suppress =
    target === "confirmed" && options?.suppressNotifications === true
      ? { suppressNotifications: true }
      : {}

  if (current === "on_hold" && target === "confirmed") {
    return { path: `/v1/bookings/${bookingId}/confirm`, body: { ...noteBody, ...suppress } }
  }
  if (current === "on_hold" && target === "expired") {
    return { path: `/v1/bookings/${bookingId}/expire`, body: noteBody }
  }
  if (current === "confirmed" && target === "in_progress") {
    return { path: `/v1/bookings/${bookingId}/start`, body: noteBody }
  }
  if (current === "in_progress" && target === "completed") {
    return { path: `/v1/bookings/${bookingId}/complete`, body: noteBody }
  }
  if (
    target === "cancelled" &&
    (current === "draft" ||
      current === "on_hold" ||
      current === "confirmed" ||
      current === "in_progress")
  ) {
    return { path: `/v1/bookings/${bookingId}/cancel`, body: noteBody }
  }

  // The override-status route rejects empty reasons. For the common
  // post-create transitions out of `draft` (the operator commits the
  // booking to either confirmed-with-money-in or awaiting-payment) we
  // don't want to force a reason prompt, so supply a benign default.
  // Callers can still pass an explicit note to override.
  const defaultReason =
    current === "draft" && (target === "confirmed" || target === "awaiting_payment")
      ? `Set to ${target} after create`
      : ""
  const reason = note?.trim() || defaultReason
  return {
    path: `/v1/bookings/${bookingId}/override-status`,
    body: { status: target, reason, ...(note ? { note } : {}), ...suppress },
  }
}
