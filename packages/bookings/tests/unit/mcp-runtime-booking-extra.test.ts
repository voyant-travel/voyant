import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import { afterEach, describe, expect, it, vi } from "vitest"

const executeAdmittedCreatedTargetCommand = vi.hoisted(() => vi.fn())

vi.mock("@voyant-travel/action-ledger/created-command", () => ({
  executeAdmittedCreatedTargetCommand,
}))

import { contributeBookingsExtrasToolContext } from "../../src/extras/mcp-runtime.js"
import { bookingsExtrasService } from "../../src/extras/service.js"

afterEach(() => {
  vi.restoreAllMocks()
  executeAdmittedCreatedTargetCommand.mockReset()
})

describe("booking-extra created-target runtime", () => {
  it("validates the booking anchor and creates the child on the admitted transaction", async () => {
    const tx = parentLookup([{ id: "booking_1" }])
    executeAdmittedCreatedTargetCommand.mockImplementation(async (_input, handlers) => {
      const mutation = await handlers.create(tx)
      return { replayed: false, value: mutation.value, result: {} }
    })
    const create = vi
      .spyOn(bookingsExtrasService, "createBookingExtra")
      .mockResolvedValue({ id: "extra_1" } as never)
    const runtime = contributeBookingsExtrasToolContext({
      request: request(),
      context: { db: {} },
    }).bookingsExtras

    await expect(
      runtime.execute(
        "createBookingExtra",
        {
          bookingId: "booking_1",
          name: "Transfer",
        },
        {} as ToolHandlerActionPolicyContext,
      ),
    ).resolves.toEqual({ id: "extra_1", replayed: false })
    expect(create).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ bookingId: "booking_1", name: "Transfer" }),
    )
  })

  it("rejects an absent booking anchor before calling the child service", async () => {
    const tx = parentLookup([])
    executeAdmittedCreatedTargetCommand.mockImplementation(async (_input, handlers) => {
      const mutation = await handlers.create(tx)
      return { replayed: false, value: mutation.value, result: {} }
    })
    const create = vi.spyOn(bookingsExtrasService, "createBookingExtra")
    const runtime = contributeBookingsExtrasToolContext({
      request: request(),
      context: { db: {} },
    }).bookingsExtras

    await expect(
      runtime.execute(
        "createBookingExtra",
        {
          bookingId: "missing",
          name: "Transfer",
        },
        {} as ToolHandlerActionPolicyContext,
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" })
    expect(create).not.toHaveBeenCalled()
  })
})

function parentLookup(rows: Array<{ id: string }>) {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return { limit: () => Promise.resolve(rows) }
            },
          }
        },
      }
    },
  }
}

function request() {
  return {
    var: {
      actor: "staff",
      callerType: "agent",
      agentId: "agent_1",
      organizationId: "org_1",
    },
    req: { header: () => null },
  } as never
}
