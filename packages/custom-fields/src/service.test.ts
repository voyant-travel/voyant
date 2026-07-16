import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"
import { customFieldDefinitionInputSchema } from "./contracts.js"
import {
  createAppCustomFieldDefinitionOwner,
  createCustomFieldsService,
  createPlatformCustomFieldDefinitionOwner,
} from "./service.js"
import { createCustomFieldTargetRegistry } from "./targets.js"

const targets = createCustomFieldTargetRegistry([
  {
    id: "booking",
    namespace: "bookings",
    label: "Booking",
    fieldTypes: ["text"],
    capabilities: ["read", "write"],
    ownerUnitId: "@voyant-travel/bookings",
  },
])

const input = customFieldDefinitionInputSchema.parse({
  entityType: "booking",
  key: "external_id",
  label: "External ID",
  fieldType: "text",
})

function postgresStub(implementation: object): PostgresJsDatabase {
  const db = Object.create(null) as PostgresJsDatabase
  return Object.assign(db, implementation)
}

function insertDb() {
  const rows: Record<string, unknown>[] = []
  return {
    rows,
    db: postgresStub({
      insert: () => ({
        values: (value: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              const duplicate = rows.some(
                (row) =>
                  row.entityType === value.entityType &&
                  row.namespace === value.namespace &&
                  row.key === value.key,
              )
              if (duplicate) return []
              const row = { id: `definition_${rows.length + 1}`, ...value }
              rows.push(row)
              return [row]
            },
          }),
        }),
      }),
    }),
  }
}

describe("custom-field definition ownership", () => {
  it("allows the same key in operator and app namespaces", async () => {
    const { db, rows } = insertDb()
    const service = createCustomFieldsService(targets)
    const app = createAppCustomFieldDefinitionOwner({
      appId: "app_acme",
      namespace: "app--acme-7f3",
    })

    await service.create(db, input)
    await service.createForOwner(db, app, input)

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ namespace: "custom", ownerKind: "operator", ownerId: null }),
        expect.objectContaining({
          namespace: "app--acme-7f3",
          ownerKind: "app",
          ownerId: "app_acme",
        }),
      ]),
    )
  })

  it("rejects cross-owner mutation before issuing an update", async () => {
    const service = createCustomFieldsService(targets)
    const app = createAppCustomFieldDefinitionOwner({
      appId: "app_acme",
      namespace: "app--acme-7f3",
    })
    const db = postgresStub({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "definition_1",
                entityType: "booking",
                namespace: "app--other-92c",
                ownerKind: "app",
                ownerId: "app_other",
              },
            ],
          }),
        }),
      }),
      update: () => {
        throw new Error("must not update a foreign definition")
      },
    })

    await expect(
      service.updateForOwner(db, app, "definition_1", { label: "Changed" }),
    ).rejects.toMatchObject({
      status: 403,
      code: "custom_field_definition_read_only",
    })
  })

  it("requires a platform-assigned app namespace", () => {
    expect(() =>
      createAppCustomFieldDefinitionOwner({ appId: "app_acme", namespace: "custom" }),
    ).toThrow(/platform-assigned/)
  })

  it("derives platform ownership from the selected target", async () => {
    const { db, rows } = insertDb()
    const service = createCustomFieldsService(targets)
    const target = targets.get("booking")
    expect(target).toBeDefined()
    if (!target) throw new Error("booking target missing")

    await service.createForOwner(db, createPlatformCustomFieldDefinitionOwner(target), input)

    expect(rows).toEqual([
      expect.objectContaining({
        namespace: "bookings",
        ownerKind: "platform",
        ownerId: "@voyant-travel/bookings",
      }),
    ])
  })

  it("rejects a platform owner crossing its graph target boundary", async () => {
    const { db } = insertDb()
    const service = createCustomFieldsService(targets)
    const foreignOwner = createPlatformCustomFieldDefinitionOwner({
      namespace: "relationships",
      ownerUnitId: "@voyant-travel/relationships",
    })

    await expect(service.createForOwner(db, foreignOwner, input)).rejects.toMatchObject({
      status: 403,
      code: "custom_field_definition_read_only",
    })
  })
})
