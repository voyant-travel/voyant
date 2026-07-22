import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { mediaProductsService } from "../../src/service-media.js"

const target = {
  id: "pmed_target",
  productId: "prod_1",
  dayId: null,
  mediaType: "image",
  isBrochure: false,
  isOpenGraph: false,
}

describe("mediaProductsService.setOpenGraphMedia", () => {
  it("atomically replaces the current Open Graph image", async () => {
    const fixture = fakeTransactionalDb({
      selectRows: [[{ id: "prod_1" }], [target]],
      updateRows: [[], [{ ...target, isOpenGraph: true }]],
    })

    const result = await mediaProductsService.setOpenGraphMedia(fixture.db, "prod_1", target.id)

    expect(result).toEqual({ ...target, isOpenGraph: true })
    expect(fixture.transactionCalls).toBe(1)
    expect(fixture.updateSets).toEqual([
      expect.objectContaining({ isOpenGraph: false }),
      expect.objectContaining({ isOpenGraph: true }),
    ])
  })

  it("clears the explicit Open Graph image in the same transaction", async () => {
    const fixture = fakeTransactionalDb({ selectRows: [[{ id: "prod_1" }]], updateRows: [[]] })

    await expect(
      mediaProductsService.setOpenGraphMedia(fixture.db, "prod_1", null),
    ).resolves.toBeNull()
    expect(fixture.transactionCalls).toBe(1)
    expect(fixture.updateSets).toEqual([expect.objectContaining({ isOpenGraph: false })])
  })

  it("does not clear the current image when the requested target is invalid", async () => {
    const fixture = fakeTransactionalDb({
      selectRows: [[{ id: "prod_1" }], []],
      updateRows: [],
    })

    await expect(
      mediaProductsService.setOpenGraphMedia(fixture.db, "prod_1", "pmed_missing"),
    ).rejects.toMatchObject({ code: "invalid_media_target" })
    expect(fixture.updateSets).toEqual([])
  })

  it("fails instead of returning null when a locked target cannot be updated", async () => {
    const fixture = fakeTransactionalDb({
      selectRows: [[{ id: "prod_1" }], [target]],
      updateRows: [[], []],
    })

    await expect(
      mediaProductsService.setOpenGraphMedia(fixture.db, "prod_1", target.id),
    ).rejects.toMatchObject({ code: "invalid_media_target" })
  })
})

function fakeTransactionalDb(options: { selectRows: unknown[][]; updateRows: unknown[][] }): {
  db: PostgresJsDatabase
  transactionCalls: number
  updateSets: Array<Record<string, unknown>>
} {
  const selectRows = [...options.selectRows]
  const updateRows = [...options.updateRows]
  const updateSets: Array<Record<string, unknown>> = []
  const fixture = {
    transactionCalls: 0,
    updateSets,
    db: null as unknown as PostgresJsDatabase,
  }

  const tx = {
    select: () => ({
      from: () => {
        const rows = selectRows.shift() ?? []
        const chain = {
          where: () => chain,
          for: () => chain,
          limit: async () => rows,
        }
        return chain
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updateSets.push(values)
        return {
          where: () => {
            const rows = updateRows.shift() ?? []
            const result = Promise.resolve(rows) as Promise<unknown[]> & {
              returning: () => Promise<unknown[]>
            }
            result.returning = async () => rows
            return result
          },
        }
      },
    }),
  }

  fixture.db = {
    transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      fixture.transactionCalls += 1
      return callback(tx)
    },
  } as never

  return fixture
}
