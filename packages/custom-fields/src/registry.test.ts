import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"
import { loadCustomFieldDefinitions, loadCustomFieldRegistry } from "./registry.js"
import { createCustomFieldTargetRegistry } from "./targets.js"

function fakeDb(rows: unknown[]): PostgresJsDatabase {
  return {
    select: () => ({ from: () => Promise.resolve(rows) }),
  } as unknown as PostgresJsDatabase
}

describe("database custom-field registry", () => {
  it("maps persisted definitions and visibility into the runtime registry", async () => {
    const rows = [
      {
        entityType: "person",
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

    expect((await loadCustomFieldRegistry(fakeDb(rows))).field("person", "tier")).toMatchObject({
      type: "select",
      visibility: { export: true, invoice: true, search: true },
    })
  })

  it("filters deselected targets and normalizes visibility to selected capabilities", async () => {
    const rows = [
      {
        entityType: "person",
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
})
