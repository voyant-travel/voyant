import {
  type BookingSessionOutcomeV1,
  type BookingSessionRecordV1,
  type BookingSessionTargetV1,
  bookingSessionOutcomeV1,
  type CommitBookingSessionV1,
  type CreateBookingSessionV1,
  type PlaceBookingHoldV1,
  type QuoteBookingSessionV1,
  type UpdateBookingSessionV1,
} from "@voyant-travel/catalog-contracts/booking-engine/session-contracts"

import {
  requestHeaders,
  type StorefrontRequestOptions,
  storefrontFetchWithValidation,
  type VoyantStorefrontClientOptions,
} from "./client.js"

type ResolvedClientOptions = Required<Pick<VoyantStorefrontClientOptions, "baseUrl" | "fetcher">> &
  Pick<VoyantStorefrontClientOptions, "headers">

export interface OwnedProductBookingTracerInput {
  target: BookingSessionTargetV1
  journeyKey: string
  state?: Record<string, unknown>
  quantity?: number
  requestOptions?: StorefrontRequestOptions
}

export interface OwnedProductBookingTracerResult {
  session: BookingSessionRecordV1
  quoteOutcome: BookingSessionOutcomeV1
  holdOutcome: BookingSessionOutcomeV1
  commitOutcome: BookingSessionOutcomeV1
}

export function createBookingSessionV1(
  client: ResolvedClientOptions,
  input: CreateBookingSessionV1,
  options?: StorefrontRequestOptions,
) {
  return storefrontFetchWithValidation(
    "/v1/public/catalog/booking-sessions",
    bookingSessionOutcomeV1,
    client,
    {
      method: "POST",
      headers: requestHeaders(options),
      body: JSON.stringify(input),
    },
  )
}

export function updateBookingSessionV1(
  client: ResolvedClientOptions,
  sessionId: string,
  input: UpdateBookingSessionV1,
  options?: StorefrontRequestOptions,
) {
  return storefrontFetchWithValidation(
    `/v1/public/catalog/booking-sessions/${encodeURIComponent(sessionId)}`,
    bookingSessionOutcomeV1,
    client,
    {
      method: "PATCH",
      headers: requestHeaders(options),
      body: JSON.stringify(input),
    },
  )
}

export function quoteBookingSessionV1(
  client: ResolvedClientOptions,
  sessionId: string,
  input: QuoteBookingSessionV1,
  options?: StorefrontRequestOptions,
) {
  return storefrontFetchWithValidation(
    `/v1/public/catalog/booking-sessions/${encodeURIComponent(sessionId)}/quote`,
    bookingSessionOutcomeV1,
    client,
    {
      method: "POST",
      headers: requestHeaders(options),
      body: JSON.stringify(input),
    },
  )
}

export function holdBookingSessionV1(
  client: ResolvedClientOptions,
  sessionId: string,
  input: PlaceBookingHoldV1,
  options?: StorefrontRequestOptions,
) {
  return storefrontFetchWithValidation(
    `/v1/public/catalog/booking-sessions/${encodeURIComponent(sessionId)}/hold`,
    bookingSessionOutcomeV1,
    client,
    {
      method: "POST",
      headers: requestHeaders(options),
      body: JSON.stringify(input),
    },
  )
}

export function commitBookingSessionV1(
  client: ResolvedClientOptions,
  sessionId: string,
  input: CommitBookingSessionV1,
  options?: StorefrontRequestOptions,
) {
  return storefrontFetchWithValidation(
    `/v1/public/catalog/booking-sessions/${encodeURIComponent(sessionId)}/commit`,
    bookingSessionOutcomeV1,
    client,
    {
      method: "POST",
      headers: requestHeaders(options),
      body: JSON.stringify(input),
    },
  )
}

export async function runOwnedProductBookingTracerV1(
  client: ResolvedClientOptions,
  input: OwnedProductBookingTracerInput,
): Promise<OwnedProductBookingTracerResult> {
  const created = await createBookingSessionV1(
    client,
    { target: input.target },
    input.requestOptions,
  )
  if (created.kind !== "session_created") {
    throw new Error(`Booking Session creation failed: ${created.kind}`)
  }
  let session = created.session

  if (input.state) {
    const updated = await updateBookingSessionV1(
      client,
      session.id,
      { capability: session.capability, expectedRevision: session.revision, state: input.state },
      input.requestOptions,
    )
    if (updated.kind !== "session_updated") {
      throw new Error(`Booking Session update failed: ${updated.kind}`)
    }
    session = updated.session
  }

  const quoteOutcome = await quoteBookingSessionV1(
    client,
    session.id,
    {
      capability: session.capability,
      expectedRevision: session.revision,
      idempotencyKey: `${input.journeyKey}:quote`,
    },
    input.requestOptions,
  )
  if (quoteOutcome.kind !== "quote_created") {
    throw new Error(`Booking Session quote failed: ${quoteOutcome.kind}`)
  }

  const holdOutcome = await holdBookingSessionV1(
    client,
    session.id,
    {
      capability: session.capability,
      expectedRevision: session.revision,
      quoteId: quoteOutcome.quote.id,
      quantity: input.quantity ?? 1,
      idempotencyKey: `${input.journeyKey}:hold`,
    },
    input.requestOptions,
  )
  if (holdOutcome.kind !== "hold_created") {
    throw new Error(`Booking Session hold failed: ${holdOutcome.kind}`)
  }

  const commitOutcome = await commitBookingSessionV1(
    client,
    session.id,
    {
      capability: session.capability,
      expectedRevision: session.revision,
      quoteId: quoteOutcome.quote.id,
      holdId: holdOutcome.hold.id,
      idempotencyKey: `${input.journeyKey}:commit`,
    },
    input.requestOptions,
  )

  return { session, quoteOutcome, holdOutcome, commitOutcome }
}
