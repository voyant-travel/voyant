import { ApiHttpError } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { customFieldsService } from "../../src/service/custom-fields.js"

/**
 * A duplicate `(entity_type, key)` insert hits
 * `uidx_custom_field_definitions_key`; the service uses `onConflictDoNothing`,
 * so the insert resolves to an empty `RETURNING` set. This mock reproduces that
 * "no row returned" shape without a live database (voyant#2612).
 */
function createConflictingInsertDb(): PostgresJsDatabase {
  const insert: PostgresJsDatabase["insert"] = () =>
    ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: async () => [],
        }),
      }),
    }) as never
  return { insert } as PostgresJsDatabase
}

describe("createCustomFieldDefinition duplicate key conflicts", () => {
  it("maps a duplicate (entityType, key) to a 409 with a stable code and field context", async () => {
    let caught: unknown
    try {
      await customFieldsService.createCustomFieldDefinition(createConflictingInsertDb(), {
        entityType: "organization",
        key: "industry_code",
        label: "Industry Code",
        fieldType: "varchar",
      } as never)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiHttpError)
    const apiError = caught as ApiHttpError
    expect(apiError.status).toBe(409)
    expect(apiError.code).toBe("duplicate_custom_field_key")
    expect(apiError.message).toBe("Custom field key already exists for this entity type")
    expect(apiError.details).toMatchObject({
      resource: "custom_field_definition",
      issues: [
        {
          code: "duplicate_custom_field_key",
          path: ["key"],
          message: "Custom field key already exists for this entity type",
        },
      ],
      fields: {
        key: ["Custom field key already exists for this entity type"],
      },
    })
  })
})
