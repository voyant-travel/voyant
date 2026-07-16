import { createCustomFieldRegistry } from "@voyant-travel/core/custom-fields"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"
import { loadCustomFieldDefinitions, loadCustomFieldRegistry } from "./registry.js"
import { createCustomFieldTargetRegistry } from "./targets.js"

function fakeDb(rows: unknown[]): PostgresJsDatabase {
  const db = Object.create(null) as PostgresJsDatabase
  return Object.assign(db, {
    select: () => ({ from: () => Promise.resolve(rows) }),
  })
}

describe("database custom-field registry", () => {
  it("maps persisted definitions and visibility into the runtime registry", async () => {
    const rows = [
      {
        entityType: "person",
        namespace: "custom",
        lifecycleState: "active",
        key: "tier",
        fieldType: "enum",
        label: "Tier",
        isRequired: true,
        isSearchable: true,
        isExportable: true,
        isInvoiceable: true,
        options: [
          { label: "Gold", value: "gold" },
          { label: "Silver", value: "silver" },
        ],
      },
    ]

    expect(await loadCustomFieldDefinitions(fakeDb(rows))).toEqual([
      expect.objectContaining({
        entity: "person",
        key: "tier",
        type: "select",
        options: ["gold", "silver"],
        visibility: { export: true, invoice: true, search: true },
      }),
    ])

    expect(
      (await loadCustomFieldRegistry(fakeDb(rows))).field("person", "custom", "tier"),
    ).toMatchObject({
      type: "select",
      visibility: { export: true, invoice: true, search: true },
    })
  })

  it("filters deselected targets and normalizes visibility to selected capabilities", async () => {
    const rows = [
      {
        entityType: "person",
        namespace: "custom",
        lifecycleState: "active",
        key: "tier",
        fieldType: "text",
        label: "Tier",
        isRequired: false,
        isSearchable: true,
        isExportable: true,
        isInvoiceable: true,
        options: null,
      },
      {
        entityType: "activity",
        namespace: "custom",
        lifecycleState: "active",
        key: "private_note",
        fieldType: "text",
        label: "Private note",
        isRequired: false,
        isSearchable: true,
        isExportable: true,
        isInvoiceable: true,
        options: null,
      },
    ]
    const targets = createCustomFieldTargetRegistry([
      {
        id: "person",
        namespace: "relationships",
        label: "Person",
        fieldTypes: ["text"],
        capabilities: ["read", "export"],
        ownerUnitId: "@voyant-travel/relationships",
      },
    ])

    expect(await loadCustomFieldDefinitions(fakeDb(rows), targets)).toEqual([
      expect.objectContaining({
        entity: "person",
        visibility: { export: true, invoice: false, search: false },
      }),
    ])
  })

  it("keeps same-key definitions distinct by physical namespace", async () => {
    const rows = [
      {
        entityType: "person",
        namespace: "custom",
        lifecycleState: "active",
        key: "external_id",
        fieldType: "text",
        label: "Operator external ID",
        isRequired: false,
        isSearchable: false,
        isExportable: true,
        isInvoiceable: false,
        options: null,
      },
      {
        entityType: "person",
        namespace: "app--acme-7f3",
        lifecycleState: "active",
        key: "external_id",
        fieldType: "text",
        label: "App external ID",
        isRequired: false,
        isSearchable: false,
        isExportable: true,
        isInvoiceable: false,
        options: null,
      },
    ]

    const definitions = await loadCustomFieldDefinitions(fakeDb(rows))
    expect(definitions).toHaveLength(2)
    expect(
      createCustomFieldRegistry(definitions).field("person", "app--acme-7f3", "external_id"),
    ).toMatchObject({ label: "App external ID" })
  })

  it("keeps inactive definitions out of the runtime registry", async () => {
    const rows = [
      {
        entityType: "person",
        namespace: "custom",
        lifecycleState: "inactive",
        key: "retired",
        fieldType: "text",
        label: "Retired",
        isRequired: false,
        isSearchable: false,
        isExportable: false,
        isInvoiceable: false,
        options: null,
      },
    ]

    expect(await loadCustomFieldDefinitions(fakeDb(rows))).toEqual([])
  })
})
