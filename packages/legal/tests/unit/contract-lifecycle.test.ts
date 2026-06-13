import { describe, expect, it, vi } from "vitest"

import {
  appendContractStageHistory,
  buildContractLifecycleEvent,
  checkContractLifecycleTransition,
  createContractStageHistoryEntry,
  emitContractLifecycleEvent,
} from "../../src/contracts/lifecycle.js"
import type { Contract } from "../../src/contracts/schema.js"
import { updateContractSchema } from "../../src/contracts/validation.js"

describe("contract lifecycle", () => {
  it("accepts the documented happy-path transitions", () => {
    expect(checkContractLifecycleTransition("draft", "issued")).toEqual({ ok: true })
    expect(checkContractLifecycleTransition("issued", "sent")).toEqual({ ok: true })
    expect(checkContractLifecycleTransition("sent", "signed")).toEqual({ ok: true })
    expect(checkContractLifecycleTransition("signed", "executed")).toEqual({ ok: true })
    expect(checkContractLifecycleTransition("executed", "voided")).toEqual({ ok: true })
  })

  it("rejects out-of-order transitions", () => {
    expect(checkContractLifecycleTransition("draft", "signed")).toEqual({
      ok: false,
      reason: "not_sent",
    })
    expect(checkContractLifecycleTransition("issued", "signed")).toEqual({
      ok: false,
      reason: "not_sent",
    })
    expect(checkContractLifecycleTransition("sent", "executed")).toEqual({
      ok: false,
      reason: "not_signed",
    })
    expect(checkContractLifecycleTransition("void", "voided")).toEqual({
      ok: false,
      reason: "already_void",
    })
  })

  it("does not accept direct status changes through the update schema", () => {
    expect(updateContractSchema.parse({ title: "Keep status", status: "executed" })).toEqual({
      title: "Keep status",
    })
  })

  it("keeps lifecycle hooks best-effort after event emission", async () => {
    const calls: string[] = []
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const eventBus = {
      emit: vi.fn(async () => {
        calls.push("event")
      }),
      subscribe: vi.fn(),
    }

    try {
      await expect(
        emitContractLifecycleEvent(
          {
            eventBus,
            lifecycleHooks: [
              () => {
                calls.push("hook-1")
                throw new Error("side effect failed")
              },
              () => {
                calls.push("hook-2")
              },
            ],
          },
          {
            contractId: "cont_123",
            contractNumber: null,
            scope: "customer",
            previousStage: "signed",
            stage: "executed",
            transition: "executed",
            occurredAt: "2026-05-14T10:05:00.000Z",
            personId: null,
            organizationId: null,
            supplierId: null,
            channelId: null,
            bookingId: null,
            targetKind: null,
            targetId: null,
            targetProvider: null,
            targetSourceRef: null,
            legacyTransactionOfferId: null,
            legacyTransactionOrderId: null,
          },
        ),
      ).resolves.toBeUndefined()

      expect(calls).toEqual(["event", "hook-1", "hook-2"])
      expect(eventBus.emit).toHaveBeenCalledWith(
        "contract.executed",
        expect.objectContaining({ contractId: "cont_123" }),
        { category: "domain", source: "service" },
      )
      expect(consoleError).toHaveBeenCalledWith(
        "[legal] lifecycle hook failed for contract.executed:",
        expect.any(Error),
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it("records transition history entries without leaking contract body fields into events", () => {
    const created = createContractStageHistoryEntry("draft", {
      enteredAt: new Date("2026-05-14T10:00:00.000Z"),
    })
    const issued = createContractStageHistoryEntry("issued", {
      previousStage: "draft",
      transition: "issued",
      enteredAt: new Date("2026-05-14T10:05:00.000Z"),
    })

    expect(appendContractStageHistory([created], issued)).toEqual([created, issued])

    const event = buildContractLifecycleEvent(
      {
        id: "cont_123",
        contractNumber: "C-1",
        scope: "customer",
        status: "issued",
        stageHistory: [created, issued],
        title: "Customer contract",
        templateVersionId: null,
        seriesId: null,
        personId: "pers_123",
        organizationId: null,
        supplierId: null,
        channelId: null,
        bookingId: "book_123",
        targetKind: "booking",
        targetId: "book_123",
        targetProvider: null,
        targetSourceRef: null,
        legacyTransactionOfferId: null,
        legacyTransactionOrderId: null,
        issuedAt: null,
        sentAt: null,
        executedAt: null,
        expiresAt: null,
        voidedAt: null,
        language: "en",
        renderedBodyFormat: "html",
        renderedBody: "<p>private</p>",
        variables: null,
        metadata: null,
        createdAt: new Date("2026-05-14T10:00:00.000Z"),
        updatedAt: new Date("2026-05-14T10:05:00.000Z"),
      } satisfies Contract,
      "draft",
      "issued",
      "issued",
      new Date("2026-05-14T10:05:00.000Z"),
    )

    expect(event).toEqual({
      contractId: "cont_123",
      contractNumber: "C-1",
      scope: "customer",
      previousStage: "draft",
      stage: "issued",
      transition: "issued",
      occurredAt: "2026-05-14T10:05:00.000Z",
      personId: "pers_123",
      organizationId: null,
      supplierId: null,
      channelId: null,
      bookingId: "book_123",
      targetKind: "booking",
      targetId: "book_123",
      targetProvider: null,
      targetSourceRef: null,
      legacyTransactionOfferId: null,
      legacyTransactionOrderId: null,
      delivery: null,
    })
  })
})
