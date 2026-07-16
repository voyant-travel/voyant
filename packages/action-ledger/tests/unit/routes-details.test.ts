import type { AnyDrizzleDb } from "@voyant-travel/db"
import { afterEach, describe, expect, test, vi } from "vitest"

import { __test__ } from "../../src/routes.js"
import { actionLedgerService } from "../../src/service.js"
import {
  makeApp,
  makeApproval,
  makeDelegation,
  makeEntry,
  makeMutationDetail,
  makePayload,
  makeSensitiveReadDetail,
} from "./routes-fixtures.js"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("actionLedgerAdminRoutes", () => {
  test("lists delegations with principal and scope filters plus cursor pagination", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "listDelegations").mockResolvedValue({
      delegations: [makeDelegation()],
      nextCursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "adel_1",
      },
    })

    const app = makeApp(db)
    const response = await app.request(
      "/delegations?rootPrincipalType=user&rootPrincipalId=usr_root&parentPrincipalType=user&parentPrincipalId=usr_root&childPrincipalType=agent&childPrincipalId=agent_child&grantSource=travel.agent.run&capabilityScopeRef=capability%3A%2F%2Fbookings%2Fstatus&budgetScopeRef=budget%3A%2F%2Ftravel-agent%2Frun-1&expiresAtFrom=2026-05-15T11%3A00%3A00.000Z&expiresAtTo=2026-05-15T12%3A00%3A00.000Z&createdAtFrom=2026-05-15T09%3A00%3A00.000Z&createdAtTo=2026-05-15T10%3A00%3A00.000Z&cursorCreatedAt=2026-05-15T10%3A00%3A00.000Z&cursorId=adel_cursor&limit=25",
    )

    expect(spy).toHaveBeenCalledWith(db, {
      rootPrincipalType: "user",
      rootPrincipalId: "usr_root",
      parentPrincipalType: "user",
      parentPrincipalId: "usr_root",
      childPrincipalType: "agent",
      childPrincipalId: "agent_child",
      grantSource: "travel.agent.run",
      capabilityScopeRef: "capability://bookings/status",
      budgetScopeRef: "budget://travel-agent/run-1",
      expiresAtFrom: new Date("2026-05-15T11:00:00.000Z"),
      expiresAtTo: new Date("2026-05-15T12:00:00.000Z"),
      createdAtFrom: new Date("2026-05-15T09:00:00.000Z"),
      createdAtTo: new Date("2026-05-15T10:00:00.000Z"),
      cursor: {
        createdAt: "2026-05-15T10:00:00.000Z",
        id: "adel_cursor",
      },
      limit: 25,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: "adel_1",
          rootPrincipalType: "user",
          rootPrincipalId: "usr_root",
          childPrincipalType: "agent",
          childPrincipalId: "agent_child",
          expiresAt: "2026-05-15T12:00:00.000Z",
          createdAt: "2026-05-15T10:00:00.000Z",
        },
      ],
      pageInfo: {
        nextCursor: {
          createdAt: "2026-05-15T10:00:00.000Z",
          id: "adel_1",
        },
      },
    })
  })

  test("rejects delegation cursor halves", () => {
    const parsed = __test__.actionDelegationListQuerySchema.safeParse({
      cursorCreatedAt: "2026-05-15T10:00:00.000Z",
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(["cursorId"])
  })

  test("gets one approval with requested action details", async () => {
    const approval = makeApproval({
      id: "appr_detail",
      requestedActionId: "alge_requested",
    })
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "getApproval").mockResolvedValue({
      approval,
      requestedAction: {
        entry: makeEntry({
          id: approval.requestedActionId,
          status: "awaiting_approval",
          approvalId: approval.id,
        }),
        mutationDetail: makeMutationDetail({ actionId: approval.requestedActionId }),
        sensitiveReadDetail: null,
        payloads: [makePayload({ actionId: approval.requestedActionId })],
      },
    })

    const app = makeApp(db)
    const response = await app.request("/approvals/appr_detail")

    expect(spy).toHaveBeenCalledWith(db, "appr_detail")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "appr_detail",
        requestedActionId: "alge_requested",
        createdAt: "2026-05-15T10:00:00.000Z",
        requestedAction: {
          id: "alge_requested",
          status: "awaiting_approval",
          approvalId: "appr_detail",
          occurredAt: "2026-05-15T10:00:00.000Z",
          createdAt: "2026-05-15T10:00:00.000Z",
          mutationDetail: {
            actionId: "alge_requested",
          },
          sensitiveReadDetail: null,
          payloads: [
            {
              actionId: "alge_requested",
              createdAt: "2026-05-15T10:00:00.000Z",
            },
          ],
        },
      },
    })
  })

  test("returns 404 when an approval is missing", async () => {
    vi.spyOn(actionLedgerService, "getApproval").mockResolvedValue(null)

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/approvals/appr_missing")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Action approval not found",
    })
  })

  test("gets one delegation", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "getDelegation").mockResolvedValue({
      delegation: makeDelegation({ id: "adel_detail" }),
    })

    const app = makeApp(db)
    const response = await app.request("/delegations/adel_detail")

    expect(spy).toHaveBeenCalledWith(db, "adel_detail")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "adel_detail",
        rootPrincipalType: "user",
        childPrincipalType: "agent",
        expiresAt: "2026-05-15T12:00:00.000Z",
        createdAt: "2026-05-15T10:00:00.000Z",
      },
    })
  })

  test("returns 404 when a delegation is missing", async () => {
    vi.spyOn(actionLedgerService, "getDelegation").mockResolvedValue(null)

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/delegations/adel_missing")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Action delegation not found",
    })
  })

  test("gets one entry with profile details", async () => {
    const db = {} as AnyDrizzleDb
    const spy = vi.spyOn(actionLedgerService, "getEntry").mockResolvedValue({
      entry: makeEntry({
        actionName: "booking.status.confirm",
        actionKind: "update",
        targetType: "booking",
        targetId: "book_1",
      }),
      mutationDetail: makeMutationDetail(),
      sensitiveReadDetail: makeSensitiveReadDetail(),
      payloads: [makePayload()],
    })

    const app = makeApp(db)
    const response = await app.request("/entries/alge_1")

    expect(spy).toHaveBeenCalledWith(db, "alge_1")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: "alge_1",
        occurredAt: "2026-05-15T10:00:00.000Z",
        createdAt: "2026-05-15T10:00:00.000Z",
        mutationDetail: {
          actionId: "alge_1",
          summary: "Booking status changed from on_hold to confirmed",
          reversalKind: "none",
        },
        sensitiveReadDetail: {
          actionId: "alge_1",
          reasonCode: "travel_details_reveal",
          disclosedFieldSet: ["passportNumber"],
        },
        payloads: [
          {
            id: "alpa_1",
            createdAt: "2026-05-15T10:00:00.000Z",
            expiresAt: "2026-06-15T10:00:00.000Z",
            storageRef: "blob://action-ledger/alge_1/input",
          },
        ],
      },
    })
  })

  test("records a reversal action for an entry", async () => {
    const db = {} as AnyDrizzleDb
    const originalAction = makeEntry({
      id: "alge_original",
      actionName: "booking.status.cancel",
      actionKind: "update",
      targetType: "booking",
      targetId: "book_1",
    })
    const reversalAction = makeEntry({
      id: "alge_reversal",
      actionName: "booking.status.reopen",
      actionKind: "reverse",
      status: "reversed",
      targetType: "booking",
      targetId: "book_1",
      causationActionId: originalAction.id,
    })
    const spy = vi.spyOn(actionLedgerService, "recordReversal").mockResolvedValue({
      originalAction,
      originalMutationDetail: makeMutationDetail({ actionId: originalAction.id }),
      reversalAction,
      replayed: false,
    })

    const app = makeApp(db)
    const response = await app.request("/entries/alge_original/reversals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reversalAction: {
          actionName: "booking.status.reopen",
          actionVersion: "v1",
          actionKind: "reverse",
          status: "reversed",
          evaluatedRisk: "high",
          principalType: "user",
          principalId: "usr_reverser",
          internalRequest: false,
          targetType: "booking",
          targetId: "book_1",
          mutationDetail: {
            summary: "Booking cancellation reversed",
          },
        },
      }),
    })

    expect(spy).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        originalActionId: "alge_original",
        reversalAction: expect.objectContaining({
          actionName: "booking.status.reopen",
          mutationDetail: expect.objectContaining({
            summary: "Booking cancellation reversed",
            reversalKind: "none",
            reversedByActionIdProjection: null,
          }),
        }),
      }),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        originalAction: { id: "alge_original" },
        reversalAction: {
          id: "alge_reversal",
          actionKind: "reverse",
          status: "reversed",
          causationActionId: "alge_original",
        },
        replayed: false,
      },
    })
  })

  test("returns 404 when an entry is missing", async () => {
    vi.spyOn(actionLedgerService, "getEntry").mockResolvedValue(null)

    const app = makeApp({} as AnyDrizzleDb)
    const response = await app.request("/entries/alge_missing")

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Action ledger entry not found",
    })
  })
})
