import type { CustomFieldValueOperationsRuntime } from "@voyant-travel/core/runtime-port"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"
import {
  createAppCustomFieldDefinitionOwner,
  createCustomFieldsService,
  operatorCustomFieldDefinitionOwner,
} from "./service.js"
import { createCustomFieldTargetRegistry } from "./targets.js"

const targets = createCustomFieldTargetRegistry([
  {
    id: "person",
    namespace: "relationships",
    label: "Person",
    fieldTypes: ["text"],
    capabilities: ["read", "write"],
    ownerUnitId: "@voyant-travel/relationships",
  },
])

const appDefinition = {
  id: "cfd_app",
  entityType: "person",
  namespace: "app--acme-7f3",
  key: "external_id",
  fieldType: "text",
  lifecycleState: "active",
  label: "External ID",
  isRequired: false,
  isSearchable: false,
  isExportable: true,
  isInvoiceable: false,
  options: null,
}

function listDb(definitions: readonly (typeof appDefinition)[]): PostgresJsDatabase {
  return {
    select: () => ({
      from: () => ({
        where: async () => definitions,
      }),
    }),
  } as unknown as PostgresJsDatabase
}

function lockedDefinitionDb(definition: Record<string, unknown>): PostgresJsDatabase {
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          for: () => ({ limit: async () => [definition] }),
        }),
      }),
    }),
  } as unknown as PostgresJsDatabase
  return {
    transaction: async (callback: (db: PostgresJsDatabase) => unknown) => callback(tx),
  } as unknown as PostgresJsDatabase
}

describe("generic custom-field value orchestration", () => {
  it("keeps same-key values independent by trusted owner namespace", async () => {
    const list = vi.fn(async () => [
      {
        entityId: "pers_1",
        customFields: {
          custom: { external_id: "operator-value" },
          "app--acme-7f3": { external_id: "app-value" },
        },
      },
    ])
    const operations: CustomFieldValueOperationsRuntime = {
      supports: (entityType) => entityType === "person",
      list,
      upsert: async () => true,
      delete: async () => true,
    }
    const appOwner = createAppCustomFieldDefinitionOwner({
      appId: "app_acme",
      namespace: "app--acme-7f3",
    })
    const service = createCustomFieldsService(targets, [], [operations])

    await expect(
      service.values.listForOwner(listDb([appDefinition]), appOwner, {
        entityType: "person",
        entityId: "pers_1",
        limit: 50,
        offset: 0,
      }),
    ).resolves.toMatchObject({
      total: 1,
      data: [
        {
          id: "person::pers_1::app--acme-7f3::cfd_app",
          namespace: "app--acme-7f3",
          key: "external_id",
          textValue: "app-value",
        },
      ],
    })
    expect(list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: "app", namespace: "app--acme-7f3", ownerId: "app_acme" }),
      { entityType: "person", entityId: "pers_1" },
    )
  })

  it("fails closed when no selected provider owns the requested target", async () => {
    const service = createCustomFieldsService(targets)
    await expect(
      service.values.listForOwner({} as PostgresJsDatabase, operatorCustomFieldDefinitionOwner, {
        entityType: "person",
        limit: 50,
        offset: 0,
      }),
    ).rejects.toMatchObject({ status: 400, code: "unsupported_custom_field_target" })
  })

  it("validates values against the locked persisted definition before writing", async () => {
    const upsert = vi.fn(async () => true)
    const operations: CustomFieldValueOperationsRuntime = {
      supports: (entityType) => entityType === "person",
      list: async () => [],
      upsert,
      delete: async () => true,
    }
    const enumDefinition = {
      ...appDefinition,
      fieldType: "enum",
      options: [
        { label: "Gold", value: "gold" },
        { label: "Silver", value: "silver" },
      ],
    }
    const service = createCustomFieldsService(targets, [], [operations])
    const owner = createAppCustomFieldDefinitionOwner({
      appId: "app_acme",
      namespace: "app--acme-7f3",
    })

    await expect(
      service.values.upsertForOwner(lockedDefinitionDb(enumDefinition), owner, enumDefinition.id, {
        entityType: "person",
        entityId: "pers_1",
        textValue: "bronze",
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(upsert).not.toHaveBeenCalled()
  })

  it("persists valid fractional double values and rejects null or stray columns", async () => {
    const upsert = vi.fn(async () => true)
    const operations: CustomFieldValueOperationsRuntime = {
      supports: (entityType) => entityType === "person",
      list: async () => [],
      upsert,
      delete: async () => true,
    }
    const doubleDefinition = { ...appDefinition, fieldType: "double" }
    const service = createCustomFieldsService(targets, [], [operations])
    const owner = createAppCustomFieldDefinitionOwner({
      appId: "app_acme",
      namespace: "app--acme-7f3",
    })

    await service.values.upsertForOwner(
      lockedDefinitionDb(doubleDefinition),
      owner,
      doubleDefinition.id,
      {
        entityType: "person",
        entityId: "pers_1",
        numberValue: 1.25,
      },
    )
    expect(upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ value: 1.25 }),
    )

    for (const invalid of [{ numberValue: null }, { numberValue: 1.25, textValue: "stray" }]) {
      await expect(
        service.values.upsertForOwner(
          lockedDefinitionDb(doubleDefinition),
          owner,
          doubleDefinition.id,
          {
            entityType: "person",
            entityId: "pers_1",
            ...invalid,
          },
        ),
      ).rejects.toMatchObject({ status: 400 })
    }
  })
})
