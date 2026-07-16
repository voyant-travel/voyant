import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { insertCustomFieldDefinitionSchema } from "../../src/validation.js"

describe("booking custom-field definitions", () => {
  it("admits booking definitions through the Settings write contract", () => {
    expect(
      insertCustomFieldDefinitionSchema.parse({
        entityType: "booking",
        key: "group_size",
        label: "Group size",
        fieldType: "double",
      }),
    ).toMatchObject({
      entityType: "booking",
      key: "group_size",
      fieldType: "double",
    })
  })

  it("ships the post-cutline enum migration required to persist booking definitions", () => {
    const migration = readFileSync(
      fileURLToPath(
        new URL("../../migrations/0003_add_booking_custom_field_target.sql", import.meta.url),
      ),
      "utf8",
    )

    expect(migration).toContain(
      `CREATE TYPE "public"."custom_field_target" AS ENUM('organization', 'person', 'quote', 'activity', 'booking')`,
    )
    expect(migration).toContain(
      `ALTER COLUMN "entity_type" SET DATA TYPE "public"."custom_field_target"`,
    )
    expect(migration).toContain(`"is_exportable" boolean DEFAULT true NOT NULL`)
    expect(migration).toContain(`"is_invoiceable" boolean DEFAULT false NOT NULL`)
  })

  it("publishes the persisted definition shape in the admin OpenAPI artifact", () => {
    const openApi = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../openapi/admin/relationships.json", import.meta.url)),
        "utf8",
      ),
    ) as { paths: Record<string, unknown> }
    const customFieldPaths = JSON.stringify(
      Object.fromEntries(
        Object.entries(openApi.paths).filter(([path]) => path.includes("/custom-fields")),
      ),
    )

    expect(customFieldPaths).toContain('"booking"')
    expect(customFieldPaths).toContain('"isExportable"')
    expect(customFieldPaths).toContain('"isInvoiceable"')
  })
})
