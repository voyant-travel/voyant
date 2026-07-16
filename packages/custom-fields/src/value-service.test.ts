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
})
