import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import { loadCustomFieldDefinitions } from "../../src/service/custom-fields-registry.js"

/** Minimal stub: `db.select().from(table)` resolves to the given rows. */
function fakeDb(rows: unknown[]): PostgresJsDatabase {
  return { select: () => ({ from: () => Promise.resolve(rows) }) } as PostgresJsDatabase
}

describe("loadCustomFieldDefinitions", () => {
  it("maps EAV definition rows to registry definitions", async () => {
    const rows = [
      {
        entityType: "person",
        key: "tier",
        fieldType: "enum",
        label: "Tier",
        isRequired: true,
        isSearchable: true,
        options: [
          { label: "Gold", value: "gold" },
          { label: "Silver", value: "silver" },
        ],
      },
      {
        entityType: "organization",
        key: "budget",
        fieldType: "monetary",
        label: "Budget",
        isRequired: false,
        isSearchable: false,
        options: null,
      },
      {
        entityType: "person",
        key: "addr",
        fieldType: "address",
        label: "Address",
        isRequired: false,
        isSearchable: false,
        options: null,
      },
    ]

    const defs = await loadCustomFieldDefinitions(fakeDb(rows))

    expect(defs[0]).toMatchObject({
      entity: "person",
      key: "tier",
      type: "select", // enum → select
      label: "Tier",
      required: true,
      options: ["gold", "silver"], // {label,value}[] → value[]
      visibility: { search: true }, // isSearchable → search
    })
    expect(defs[1]).toMatchObject({ entity: "organization", type: "monetary" })
    expect(defs[2]).toMatchObject({ type: "json" }) // address → json
    expect(defs[1]?.options).toBeUndefined()
  })

  it("returns an empty list when there are no definitions", async () => {
    expect(await loadCustomFieldDefinitions(fakeDb([]))).toEqual([])
  })
})
