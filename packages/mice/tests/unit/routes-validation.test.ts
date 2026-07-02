import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import { miceAdminRoutes } from "../../src/routes.js"

function fakeProgramDb(selectRows: unknown[][] = []) {
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
      throw new Error("update should not be reached")
    }),
  }
}

function makeApp(db: ReturnType<typeof fakeProgramDb>) {
  const app = new Hono()
  app.onError((err, c) => handleApiError(err, c))
  app.use("*", async (c, next) => {
    c.set("db", db)
    await next()
  })
  app.route("/", miceAdminRoutes)
  return app
}

describe("mice program route validation", () => {
  it("rejects program create when endDate is before startDate", async () => {
    const db = fakeProgramDb()
    const response = await makeApp(db).request("/programs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Acme Kickoff",
        type: "meeting",
        startDate: "2026-12-10",
        endDate: "2026-12-01",
      }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: {
        issues: [
          expect.objectContaining({
            path: ["endDate"],
            message: "endDate must be on or after startDate",
          }),
        ],
      },
    })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("rejects program patch when the stored date range would become reversed", async () => {
    const db = fakeProgramDb([
      [
        {
          id: "mice_programs_1",
          name: "Acme Kickoff",
          startDate: "2026-12-10",
          endDate: "2026-12-20",
        },
      ],
    ])

    const response = await makeApp(db).request("/programs/mice_programs_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endDate: "2026-12-01" }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      details: {
        issues: [
          expect.objectContaining({
            path: ["endDate"],
            message: "endDate must be on or after startDate",
          }),
        ],
      },
    })
    expect(db.update).not.toHaveBeenCalled()
  })
})
