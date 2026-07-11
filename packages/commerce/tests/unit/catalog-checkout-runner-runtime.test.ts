import { createEventBus } from "@voyant-travel/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import {
  createCheckoutFinalizeWorkflowRunner,
  registerCheckoutFinalizeWorkflowRunner,
} from "../../src/checkout/runner-runtime.js"

const input = { bookingId: "booking_1", paymentSessionId: "session_1" }
const rerunContext = {
  parentRunId: "parent_1",
  triggeredByUserId: "user_1",
  correlationId: "correlation_1",
  tags: ["bookingId:booking_1"],
}

describe("checkout-finalize workflow runner", () => {
  it("registers package-owned workflow metadata", () => {
    const registry = { register: vi.fn() }
    const runner = registerCheckoutFinalizeWorkflowRunner({
      registry,
      bindings: {},
      eventBus: createEventBus(),
      withDb: vi.fn(),
    })

    expect(runner).toMatchObject({
      name: "checkout-finalize",
      idempotency: "unsafe",
      rerun: expect.any(Function),
      resume: expect.any(Function),
    })
    expect(registry.register).toHaveBeenCalledWith(runner)
  })

  it("dispatches reruns and resumes with recorded workflow context", async () => {
    const db = {} as PostgresJsDatabase
    const eventBus = createEventBus()
    const dispatchFinalize = vi
      .fn()
      .mockResolvedValueOnce({ runId: "rerun_1" })
      .mockResolvedValueOnce({ runId: "resume_1" })
    const withDb = vi.fn(async (_bindings, operation) => operation(db))
    const runner = createCheckoutFinalizeWorkflowRunner({
      bindings: { DATABASE_URL: "postgres://commerce" },
      eventBus,
      withDb,
      dispatchFinalize,
    })

    await expect(runner.rerun(input, rerunContext)).resolves.toEqual({ runId: "rerun_1" })
    await expect(
      runner.resume(input, {
        ...rerunContext,
        resumeFromStep: "issue_invoice",
        seedResults: { confirm_booking: { status: "ok" } },
      }),
    ).resolves.toEqual({ runId: "resume_1" })

    expect(dispatchFinalize).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        db,
        eventBus,
        input,
        trigger: "manual.rerun",
        tags: ["bookingId:booking_1", "rerun:true"],
        parentRunId: "parent_1",
        triggeredByUserId: "user_1",
      }),
    )
    expect(dispatchFinalize).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        trigger: "manual.resume",
        tags: ["bookingId:booking_1", "resume:true"],
        resumeFromStep: "issue_invoice",
        seedResults: { confirm_booking: { status: "ok" } },
      }),
    )
  })

  it("rejects recorded inputs without a booking id", async () => {
    const runner = createCheckoutFinalizeWorkflowRunner({
      bindings: {},
      eventBus: createEventBus(),
      withDb: vi.fn(),
    })

    await expect(runner.rerun({}, rerunContext)).rejects.toThrow(
      "checkout-finalize rerun: recorded input has no bookingId",
    )
  })
})
