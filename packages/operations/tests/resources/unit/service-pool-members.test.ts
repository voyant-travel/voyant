import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"
import { type ResourcesServiceError, resourcesService } from "../../../src/resources/service.js"

function createPoolMemberDb(error: unknown): PostgresJsDatabase {
  const selectRows = [[{ id: "pool_1" }], [{ id: "resource_1" }], []]
  const db: Partial<PostgresJsDatabase> = {
    select: (() => ({
      from: () => ({
        where: () => ({
          limit: () => selectRows.shift() ?? [],
        }),
      }),
    })) as never,
    insert: (() => ({
      values: () => ({
        returning: () => {
          throw error
        },
      }),
    })) as never,
  }
  return db as PostgresJsDatabase
}

describe("resourcesService.createPoolMember", () => {
  it("maps postgres.js duplicate constraint errors to a conflict", async () => {
    const db = createPoolMemberDb({
      code: "23505",
      constraint_name: "uidx_resource_pool_members_pool_resource",
    })

    await expect(
      resourcesService.createPoolMember(db, {
        poolId: "pool_1",
        resourceId: "resource_1",
      }),
    ).rejects.toMatchObject({
      name: "ResourcesServiceError",
      message: "Resource pool member already exists",
      status: 409,
    } satisfies Partial<ResourcesServiceError>)
  })
})
