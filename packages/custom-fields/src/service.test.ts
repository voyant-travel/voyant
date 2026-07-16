import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"
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
  Object.assign(db, implementation)
  if (!("transaction" in db)) {
    Object.assign(db, {
      transaction: async (callback: (tx: PostgresJsDatabase) => unknown) => callback(db),
    })
  }
  return db
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
            for: () => ({
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

  it("renames definitions and stored values in one transaction", async () => {
    const existing = {
      id: "definition_1",
      ...input,
      namespace: "custom",
      ownerKind: "operator",
      ownerId: null,
      lifecycleState: "active",
    }
    const renameDefinitionKey = vi.fn(async () => undefined)
    const tx = postgresStub({
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => ({ limit: async () => [existing] }),
          }),
        }),
      }),
      update: () => ({
        set: (value: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => [{ ...existing, ...value }],
          }),
        }),
      }),
    })
    const transaction = vi.fn(async (callback: (db: PostgresJsDatabase) => unknown) => callback(tx))
    const db = postgresStub({ transaction })
    const service = createCustomFieldsService(targets, [
      {
        supports: (entityType) => entityType === "booking",
        renameDefinitionKey,
        deleteDefinitionValues: vi.fn(async () => undefined),
      },
    ])

    await service.update(db, existing.id, { key: "renamed_external_id" })

    expect(transaction).toHaveBeenCalledOnce()
    expect(renameDefinitionKey).toHaveBeenCalledWith(tx, existing, "renamed_external_id")
  })

  it("fails closed when multiple lifecycle providers claim one target", async () => {
    const existing = {
      id: "definition_1",
      ...input,
      namespace: "custom",
      ownerKind: "operator",
      ownerId: null,
      lifecycleState: "active",
    }
    const tx = postgresStub({
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => ({ limit: async () => [existing] }),
          }),
        }),
      }),
    })
    const lifecycle = {
      supports: (entityType: string) => entityType === "booking",
      renameDefinitionKey: vi.fn(async () => undefined),
      deleteDefinitionValues: vi.fn(async () => undefined),
    }
    const service = createCustomFieldsService(targets, [lifecycle, lifecycle])

    await expect(
      service.update(
        postgresStub({
          transaction: async (callback: (db: PostgresJsDatabase) => unknown) => callback(tx),
        }),
        existing.id,
        { key: "renamed_external_id" },
      ),
    ).rejects.toThrow(/exactly one.*found 2/)
    expect(lifecycle.renameDefinitionKey).not.toHaveBeenCalled()
  })

  it("maps rename key collisions to the definition conflict response", async () => {
    const existing = {
      id: "definition_1",
      ...input,
      namespace: "custom",
      ownerKind: "operator",
      ownerId: null,
      lifecycleState: "active",
    }
    const tx = postgresStub({
      select: () => ({
        from: () => ({
          where: () => ({
            for: () => ({ limit: async () => [existing] }),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              throw {
                code: "23505",
                constraint: "uidx_custom_field_definitions_namespace_key",
              }
            },
          }),
        }),
      }),
    })
    const db = postgresStub({
      transaction: async (callback: (transaction: PostgresJsDatabase) => unknown) => callback(tx),
    })
    const service = createCustomFieldsService(targets, [
      {
        supports: (entityType) => entityType === "booking",
        renameDefinitionKey: vi.fn(async () => undefined),
        deleteDefinitionValues: vi.fn(async () => undefined),
      },
    ])

    await expect(
      service.update(db, existing.id, { key: "duplicate_external_id" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "duplicate_custom_field_key",
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
