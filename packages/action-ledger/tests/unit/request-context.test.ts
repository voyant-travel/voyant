import { describe, expect, test } from "vitest"

import {
  buildActionLedgerMutationEntryInput,
  buildActionLedgerSensitiveReadEntryInput,
  mapActionLedgerRequestContext,
} from "../../src/request-context.js"

describe("mapActionLedgerRequestContext", () => {
  test("maps a staff session to a user principal", () => {
    expect(
      mapActionLedgerRequestContext({
        userId: "usr_1",
        sessionId: "sess_1",
        callerType: "session",
        actor: "staff",
        organizationId: "org_1",
      }),
    ).toEqual({
      actorType: "staff",
      principalType: "user",
      principalId: "usr_1",
      sessionId: "sess_1",
      apiTokenId: null,
      internalRequest: false,
      callerType: "session",
      organizationId: "org_1",
      workflowRunId: null,
      workflowStepId: null,
      correlationId: null,
    })
  })

  test("maps an API key to an api_key principal even when a user id is present", () => {
    expect(
      mapActionLedgerRequestContext({
        userId: "usr_operator",
        apiTokenId: "key_1",
        callerType: "api_key",
        actor: "staff",
      }),
    ).toMatchObject({
      actorType: "staff",
      principalType: "api_key",
      principalId: "key_1",
      apiTokenId: "key_1",
      callerType: "api_key",
    })
  })

  test("maps internal requests to a system principal", () => {
    expect(
      mapActionLedgerRequestContext({
        callerType: "internal",
        isInternalRequest: true,
        workflowRunId: "wf_run_1",
      }),
    ).toMatchObject({
      principalType: "system",
      principalId: "internal_request",
      internalRequest: true,
      workflowRunId: "wf_run_1",
    })
  })
})

describe("action ledger route entry builders", () => {
  test("builds sensitive-read entries from request context", () => {
    const entry = buildActionLedgerSensitiveReadEntryInput({
      context: {
        userId: "usr_1",
        sessionId: "sess_1",
        callerType: "session",
        actor: "staff",
      },
      actionName: "booking.pii.read",
      targetType: "booking_traveler",
      targetId: "bkpt_1",
      routeOrToolName: "bookings.travel-details",
      reasonCode: "travel_details_reveal",
      disclosedFieldSet: ["passportNumber"],
      disclosureSummary: "Traveler travel details",
      decisionPolicy: "bookings-pii-scope-or-staff-v1",
    })

    expect(entry).toMatchObject({
      actionName: "booking.pii.read",
      actionVersion: "v1",
      actionKind: "read",
      status: "succeeded",
      evaluatedRisk: "high",
      actorType: "staff",
      principalType: "user",
      principalId: "usr_1",
      sessionId: "sess_1",
      targetType: "booking_traveler",
      targetId: "bkpt_1",
      routeOrToolName: "bookings.travel-details",
      sensitiveReadDetail: {
        reasonCode: "travel_details_reveal",
        disclosedFieldSet: ["passportNumber"],
        disclosureSummary: "Traveler travel details",
        decisionPolicy: "bookings-pii-scope-or-staff-v1",
      },
    })
  })

  test("builds mutation entries that can be appended inside a later transaction", () => {
    const entry = buildActionLedgerMutationEntryInput({
      context: {
        userId: "usr_1",
        callerType: "session",
        actor: "staff",
      },
      actionName: "booking.cancel",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
      mutationDetail: {
        summary: "Booking cancelled",
        reversalKind: "domain_command",
        reversalCommandId: "booking.reopen",
        reversalCommandVersion: "v1",
      },
    })

    expect(entry).toMatchObject({
      actionName: "booking.cancel",
      actionKind: "update",
      status: "succeeded",
      evaluatedRisk: "medium",
      principalType: "user",
      principalId: "usr_1",
      targetType: "booking",
      targetId: "book_1",
      mutationDetail: {
        summary: "Booking cancelled",
        reversalKind: "domain_command",
      },
    })
  })
})
