import { RequestValidationError } from "@voyant-travel/hono"
import { describe, expect, it, vi } from "vitest"

import { createProgram, updateProgram } from "../../src/service.js"

function fakeProgramDb({
  selectRows = [],
  updateRows = [],
}: {
  selectRows?: unknown[][]
  updateRows?: unknown[]
}) {
  return {
    select: vi.fn(() => {
      const rows = selectRows.shift() ?? []
      const builder = {
        from: vi.fn(() => builder),
        where: vi.fn(() => builder),
        limit: vi.fn(() => Promise.resolve(rows)),
      }
      return builder
    }),
    insert: vi.fn(() => {
      throw new Error("insert should not be reached")
    }),
    update: vi.fn(() => {
      const builder = {
        set: vi.fn(() => builder),
        where: vi.fn(() => builder),
        returning: vi.fn(() => Promise.resolve(updateRows)),
      }
      return builder
    }),
  }
}

function expectInvalidProgramDateRange(error: unknown) {
  expect(error).toBeInstanceOf(RequestValidationError)
  expect(error).toMatchObject({
    details: {
      issues: [
        expect.objectContaining({
          path: ["endDate"],
          message: "endDate must be on or after startDate",
        }),
      ],
    },
  })
}

async function expectRejectsInvalidProgramDateRange(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (error) {
    expectInvalidProgramDateRange(error)
    return
  }

  throw new Error("Expected RequestValidationError")
}

describe("mice program service validation", () => {
  it("rejects program create when endDate is before startDate", async () => {
    const db = fakeProgramDb({})

    await expectRejectsInvalidProgramDateRange(() =>
      createProgram(db as never, {
        name: "Backward dates",
        type: "meeting",
        startDate: "2026-12-10",
        endDate: "2026-12-01",
      }),
    )

    expect(db.insert).not.toHaveBeenCalled()
  })

  it("rejects program update when the merged date range is inverted", async () => {
    const db = fakeProgramDb({
      selectRows: [
        [
          {
            id: "mice_programs_1",
            name: "Acme Kickoff",
            startDate: "2026-12-10",
            endDate: "2026-12-20",
          },
        ],
      ],
    })

    await expectRejectsInvalidProgramDateRange(() =>
      updateProgram(db as never, "mice_programs_1", { endDate: "2026-12-01" }),
    )

    expect(db.update).not.toHaveBeenCalled()
  })

  it("allows omitted-date patch payloads when the stored range is valid", async () => {
    const current = {
      id: "mice_programs_1",
      name: "Acme Kickoff",
      startDate: "2026-12-10",
      endDate: "2026-12-20",
    }
    const db = fakeProgramDb({
      selectRows: [[current]],
      updateRows: [{ ...current, status: "planning" }],
    })

    await expect(
      updateProgram(db as never, "mice_programs_1", { status: "planning" }),
    ).resolves.toMatchObject({
      id: "mice_programs_1",
      status: "planning",
    })
    expect(db.update).toHaveBeenCalledOnce()
  })
})
