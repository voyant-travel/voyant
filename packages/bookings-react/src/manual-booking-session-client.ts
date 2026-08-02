import {
  type BookingSessionOutcomeV1,
  bookingSessionOutcomeV1,
} from "@voyant-travel/catalog-contracts/booking-engine/session-contracts"

import { fetchWithValidation, type VoyantFetcher } from "./client.js"

export interface ManualBookingSessionClientOptions {
  baseUrl: string
  fetcher: VoyantFetcher
}

export interface ManualBookingSessionCommitInput {
  productId: string
  selection: Record<string, unknown>
  quantity: number
  idempotencyKey: string
  payment?: { returnUrl?: string; cancelUrl?: string }
}

export type ManualBookingSessionCommitResult =
  | { kind: "committed"; bookingId: string }
  | {
      kind: "payment_required"
      sessionId: string
      revision: number
      quoteId: string
      holdId: string
      commitIdempotencyKey: string
      redirectUrl: string | null
    }

export async function commitManualBookingSessionV1(
  client: ManualBookingSessionClientOptions,
  input: ManualBookingSessionCommitInput,
): Promise<ManualBookingSessionCommitResult> {
  const created = await request(client, "/v1/admin/catalog/booking-sessions", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: key(input.idempotencyKey, "create"),
      target: { kind: "product", productId: input.productId },
      selection: input.selection,
    }),
  })
  const session = expectOutcome(created, "session_created").session
  const quoted = expectOutcome(
    await request(client, path(session.id, "quote"), {
      method: "POST",
      body: JSON.stringify({
        expectedRevision: session.revision,
        idempotencyKey: key(input.idempotencyKey, "quote"),
      }),
    }),
    "quote_created",
  )
  const held = expectOutcome(
    await request(client, path(session.id, "hold"), {
      method: "POST",
      body: JSON.stringify({
        expectedRevision: session.revision,
        quoteId: quoted.quote.id,
        quantity: input.quantity,
        idempotencyKey: key(input.idempotencyKey, "hold"),
      }),
    }),
    "hold_created",
  )
  const commitIdempotencyKey = key(input.idempotencyKey, "commit")
  const committed = expectOutcome(
    await request(client, path(session.id, "commit"), {
      method: "POST",
      body: JSON.stringify({
        expectedRevision: session.revision,
        quoteId: quoted.quote.id,
        holdId: held.hold.id,
        idempotencyKey: commitIdempotencyKey,
        ...(input.payment ? { payment: input.payment } : {}),
      }),
    }),
    "commit_result",
  )
  if (committed.outcome.kind === "committed") {
    return { kind: "committed", bookingId: committed.outcome.booking.id }
  }
  if (
    committed.outcome.kind === "idempotent_replay" &&
    committed.outcome.originalOutcome.kind === "committed"
  ) {
    return { kind: "committed", bookingId: committed.outcome.originalOutcome.booking.id }
  }
  if (committed.outcome.kind === "payment_required") {
    return {
      kind: "payment_required",
      sessionId: session.id,
      revision: session.revision,
      quoteId: quoted.quote.id,
      holdId: held.hold.id,
      commitIdempotencyKey,
      redirectUrl: committed.outcome.paymentSession.redirectUrl,
    }
  }
  throw new ManualBookingSessionError(committed)
}

function request(
  client: ManualBookingSessionClientOptions,
  route: string,
  init: RequestInit,
): Promise<BookingSessionOutcomeV1> {
  return fetchWithValidation(route, bookingSessionOutcomeV1, client, {
    ...init,
    credentials: "include",
  })
}

function path(sessionId: string, action: string) {
  return `/v1/admin/catalog/booking-sessions/${encodeURIComponent(sessionId)}/${action}`
}

function key(root: string, action: string) {
  return `${root}:${action}`
}

function expectOutcome<K extends BookingSessionOutcomeV1["kind"]>(
  outcome: BookingSessionOutcomeV1,
  kind: K,
): Extract<BookingSessionOutcomeV1, { kind: K }> {
  if (outcome.kind === kind) return outcome as Extract<BookingSessionOutcomeV1, { kind: K }>
  throw new ManualBookingSessionError(outcome)
}

export class ManualBookingSessionError extends Error {
  constructor(readonly outcome: BookingSessionOutcomeV1) {
    super(messageForOutcome(outcome))
    this.name = "ManualBookingSessionError"
  }
}

function messageForOutcome(outcome: BookingSessionOutcomeV1): string {
  if (outcome.kind !== "rejected") return `Booking Session returned ${outcome.kind}.`
  switch (outcome.error.kind) {
    case "revision_conflict":
      return "The booking changed while it was being committed. Review it and try again."
    case "quote_expired":
    case "quote_superseded":
    case "quote_required":
      return "The price changed or expired. Review the refreshed total and try again."
    case "hold_expired":
    case "hold_required":
    case "availability_changed":
      return "The selected availability is no longer held. Review the departure and try again."
    case "quote_unavailable":
      return "The selected product could not be quoted. Review the selection and try again."
    case "commit_rejected":
      return "The booking could not be committed from the current selection."
    case "not_authorized":
    case "capability_required":
    case "capability_scope_required":
      return "You do not have permission to commit this booking."
    default:
      return `Booking Session rejected the request (${outcome.error.kind}).`
  }
}
