import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { relationshipsService } from "../../src/index.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

/**
 * Round-trips the unified value API through a real DB: values are stored in the
 * entity's `custom_fields` jsonb column (not the retired `custom_field_values`
 * side table), and the EAV-shaped typed columns are reconstructed on read. See
 * the custom-fields unification ADR.
 */
describe.skipIf(!DB_AVAILABLE)("custom-field values on the entity column", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test DB handle -- owner: relationships; integration harness is loosely typed.
  let db: any
  const rand = Math.random().toString(36).slice(2, 8)
  const pid = `pers_cfv_${rand}`
  const dEnum = `cfd_e_${rand}`
  const dMoney = `cfd_m_${rand}`

  beforeAll(async () => {
    const { createTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await db.execute(
      sql`INSERT INTO people (id, first_name, last_name) VALUES (${pid}, 'CF', 'Values')`,
    )
    await db.execute(
      sql`INSERT INTO custom_field_definitions (id, entity_type, key, label, field_type) VALUES
        (${dEnum}, 'person', 'loyalty_tier', 'Tier', 'enum'),
        (${dMoney}, 'person', 'budget', 'Budget', 'monetary')`,
    )
  })

  afterAll(async () => {
    if (!db) return
    await db.execute(sql`DELETE FROM people WHERE id = ${pid}`)
    await db.execute(sql`DELETE FROM custom_field_definitions WHERE id IN (${dEnum}, ${dMoney})`)
  })

  it("upsert writes the value into the entity custom_fields column", async () => {
    const up = await relationshipsService.upsertCustomFieldValue(db, dEnum, {
      entityType: "person",
      entityId: pid,
      textValue: "gold",
    })
    expect(up.id).toBe(`person::${pid}::${dEnum}`)
    expect(up.textValue).toBe("gold")

    const stored = await db.execute(sql`SELECT custom_fields FROM people WHERE id = ${pid}`)
    expect(stored[0].custom_fields.loyalty_tier).toBe("gold")
  })

  it("list reconstructs typed columns from jsonb (incl. monetary)", async () => {
    await relationshipsService.upsertCustomFieldValue(db, dMoney, {
      entityType: "person",
      entityId: pid,
      monetaryValueCents: 1500,
      currencyCode: "EUR",
    })
    const list = await relationshipsService.listCustomFieldValues(db, {
      entityType: "person",
      entityId: pid,
      limit: 50,
      offset: 0,
    })
    expect(list.total).toBe(2)
    const budget = list.data.find((v) => v.definitionId === dMoney)
    expect(budget?.monetaryValueCents).toBe(1500)
    expect(budget?.currencyCode).toBe("EUR")
  })

  it("delete removes the key, leaving other values intact", async () => {
    await relationshipsService.deleteCustomFieldValue(db, `person::${pid}::${dEnum}`)
    const stored = await db.execute(sql`SELECT custom_fields FROM people WHERE id = ${pid}`)
    expect(stored[0].custom_fields.loyalty_tier).toBeUndefined()
    expect(stored[0].custom_fields.budget.amountCents).toBe(1500)
  })

  it("rejects an upsert whose entityType disagrees with the definition", async () => {
    // `dEnum` is a person definition; writing it as an organization must fail
    // rather than land a value where listing would never surface it.
    await expect(
      relationshipsService.upsertCustomFieldValue(db, dEnum, {
        entityType: "organization",
        entityId: pid,
        textValue: "gold",
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it("404s an upsert against a nonexistent entity row (no synthetic success)", async () => {
    await expect(
      relationshipsService.upsertCustomFieldValue(db, dEnum, {
        entityType: "person",
        entityId: "pers_does_not_exist",
        textValue: "gold",
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it("delete returns null for a nonexistent entity / unset value (→ 404 at the route)", async () => {
    const gone = await relationshipsService.deleteCustomFieldValue(
      db,
      `person::pers_does_not_exist::${dEnum}`,
    )
    expect(gone).toBeNull()
  })
})
