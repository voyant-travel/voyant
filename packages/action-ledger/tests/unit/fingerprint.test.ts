import { describe, expect, test } from "vitest"

import {
  buildActionApprovalCommandFingerprint,
  buildIdempotencyFingerprint,
  canonicalize,
  canonicalJson,
  sha256,
} from "../../src/fingerprint.js"

describe("canonicalize", () => {
  test("alphabetizes object keys recursively", () => {
    expect(
      canonicalize({
        z: 1,
        nested: { y: 2, x: 3 },
        a: [{ b: 1, a: 2 }],
      }),
    ).toEqual({
      a: [{ a: 2, b: 1 }],
      nested: { x: 3, y: 2 },
      z: 1,
    })
  })

  test("turns undefined into null", () => {
    expect(canonicalJson({ a: undefined })).toBe('{"a":null}')
  })
})

describe("sha256", () => {
  test("hashes structurally equivalent input identically", async () => {
    await expect(sha256({ z: 1, a: 2 })).resolves.toBe(await sha256({ a: 2, z: 1 }))
  })

  test("distinguishes different command input", async () => {
    const first = await buildIdempotencyFingerprint({
      actionName: "booking.cancel",
      actionVersion: "v1",
      targetType: "booking",
      targetId: "book_123",
      commandInput: { reason: "customer" },
    })
    const second = await buildIdempotencyFingerprint({
      actionName: "booking.cancel",
      actionVersion: "v1",
      targetType: "booking",
      targetId: "book_123",
      commandInput: { reason: "operator" },
    })

    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(first).not.toBe(second)
  })
})

describe("buildActionApprovalCommandFingerprint", () => {
  test("matches the approval command idempotency envelope", async () => {
    await expect(
      buildActionApprovalCommandFingerprint({
        actionName: "booking.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_123",
        commandInput: { reason: "customer" },
        approvalPolicy: "conditional",
        capabilityId: "bookings:status:cancel",
        capabilityVersion: "v1",
        evaluatedRisk: "high",
        reasonCode: "agent_high_risk_booking_cancel",
      }),
    ).resolves.toBe(
      await buildIdempotencyFingerprint({
        actionName: "booking.cancel",
        actionVersion: "v1",
        targetType: "booking",
        targetId: "book_123",
        commandInput: { reason: "customer" },
        policyInputs: {
          approvalPolicy: "conditional",
          capabilityId: "bookings:status:cancel",
          capabilityVersion: "v1",
          evaluatedRisk: "high",
          reasonCode: "agent_high_risk_booking_cancel",
        },
      }),
    )
  })

  test("distinguishes different approval policy inputs", async () => {
    const first = await buildActionApprovalCommandFingerprint({
      actionName: "booking.cancel",
      actionVersion: "v1",
      targetType: "booking",
      targetId: "book_123",
      commandInput: { reason: "customer" },
      approvalPolicy: "conditional",
      capabilityId: "bookings:status:cancel",
      capabilityVersion: "v1",
      evaluatedRisk: "high",
      reasonCode: "agent_high_risk_booking_cancel",
    })
    const second = await buildActionApprovalCommandFingerprint({
      actionName: "booking.cancel",
      actionVersion: "v1",
      targetType: "booking",
      targetId: "book_123",
      commandInput: { reason: "customer" },
      approvalPolicy: "conditional",
      capabilityId: "bookings:status:cancel",
      capabilityVersion: "v1",
      evaluatedRisk: "high",
      reasonCode: "workflow_high_risk_booking_cancel",
    })

    expect(first).not.toBe(second)
  })

  test("binds created-target policy metadata into the approval envelope", async () => {
    const base = {
      actionName: "cruise.booking.create",
      actionVersion: "v1",
      targetType: "cruise-booking-create-command",
      targetId: "command_123",
      commandInput: { sailingId: "sailing_1" },
      approvalPolicy: "required" as const,
      capabilityId: "cruises:booking:create",
      capabilityVersion: "v1",
      evaluatedRisk: "high" as const,
      reasonCode: "high_value_booking",
    }
    const first = await buildActionApprovalCommandFingerprint({
      ...base,
      createdTarget: {
        canonicalTargetType: "cruise-booking",
        resultReferenceType: "cruise-booking-ref",
      },
    })
    const drifted = await buildActionApprovalCommandFingerprint({
      ...base,
      createdTarget: {
        canonicalTargetType: "cruise-booking",
        resultReferenceType: "wrong-ref",
      },
    })

    expect(first).not.toBe(drifted)
    await expect(
      buildIdempotencyFingerprint({
        actionName: base.actionName,
        actionVersion: base.actionVersion,
        targetType: base.targetType,
        targetId: base.targetId,
        commandInput: base.commandInput,
        policyInputs: {
          approvalPolicy: base.approvalPolicy,
          capabilityId: base.capabilityId,
          capabilityVersion: base.capabilityVersion,
          evaluatedRisk: base.evaluatedRisk,
          reasonCode: base.reasonCode,
          createdTarget: {
            canonicalTargetType: "cruise-booking",
            resultReferenceType: "cruise-booking-ref",
          },
        },
      }),
    ).resolves.toBe(first)
  })
})
