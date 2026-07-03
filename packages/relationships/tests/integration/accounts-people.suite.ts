// agent-quality: file-size exception -- owner: relationships; existing people route coverage stays co-located until account route suites are split by child resource.
import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import {
  DB_AVAILABLE,
  json,
  jsonWithIdempotency,
  setupAccountRoutesTest,
} from "./accounts-test-utils.js"

describe.skipIf(!DB_AVAILABLE)("People account routes", () => {
  const getApp = setupAccountRoutesTest()

  describe("People", () => {
    it("creates a person", async () => {
      const res = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "John", lastName: "Doe" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.firstName).toBe("John")
      expect(body.data.lastName).toBe("Doe")
      expect(body.data.id).toBeTruthy()
    })

    it("merges duplicate people and repoints booking references", async () => {
      const { createTestDb } = await import("@voyant-travel/db/test-utils")
      const db = createTestDb()

      const keepRes = await getApp().request("/people", {
        method: "POST",
        ...json({
          firstName: "Ana",
          lastName: "Ionescu",
          email: "ana@example.com",
          tags: ["vip"],
        }),
      })
      const mergeRes = await getApp().request("/people", {
        method: "POST",
        ...json({
          firstName: "Ana Maria",
          middleName: "Maria",
          lastName: "Ionescu",
          phone: "+40 700 000 000",
          dateOfBirth: "1990-03-12",
          notes: "Duplicate traveler profile",
          tags: ["repeat"],
        }),
      })
      const keep = (await keepRes.json()).data
      const merge = (await mergeRes.json()).data

      await db.execute(sql`
          INSERT INTO bookings (
            id,
            booking_number,
            status,
            person_id,
            source_type,
            sell_currency
          )
          VALUES (
            'book_merge_person_000000000000000001',
            'B-MERGE-PERSON-1',
            'draft',
            ${merge.id},
            'manual',
            'EUR'
          )
        `)
      await db.execute(sql`
          INSERT INTO custom_field_definitions (
            id,
            entity_type,
            key,
            label,
            field_type
          )
          VALUES (
            'cfdef_merge_person_pref_00000001',
            'person',
            'merge_person_pref',
            'Merge person preference',
            'text'
          )
        `)
      await db.execute(sql`
          INSERT INTO custom_field_values (
            id,
            definition_id,
            entity_type,
            entity_id,
            text_value
          )
          VALUES
            (
              'cfval_merge_person_keep_00000001',
              'cfdef_merge_person_pref_00000001',
              'person',
              ${keep.id},
              'window'
            ),
            (
              'cfval_merge_person_dup_00000001',
              'cfdef_merge_person_pref_00000001',
              'person',
              ${merge.id},
              'aisle'
            )
        `)

      const res = await getApp().request(`/people/${keep.id}/merge`, {
        method: "POST",
        ...json({ mergeId: merge.id }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(keep.id)
      expect(body.data.email).toBe("ana@example.com")
      expect(body.data.phone).toBe("+40 700 000 000")
      expect(body.data.middleName).toBe("Maria")
      expect(body.data.dateOfBirth).toBe("1990-03-12")
      expect(body.data.notes).toBe("Duplicate traveler profile")
      expect(body.data.tags).toEqual(["vip", "repeat"])

      const duplicate = await getApp().request(`/people/${merge.id}`, { method: "GET" })
      expect(duplicate.status).toBe(404)

      const bookingRows = await db.execute<{ person_id: string }>(sql`
          SELECT person_id
          FROM bookings
          WHERE id = 'book_merge_person_000000000000000001'
        `)
      expect(bookingRows[0]?.person_id).toBe(keep.id)

      const customFieldRows = await db.execute<{ entity_id: string; text_value: string }>(sql`
          SELECT entity_id, text_value
          FROM custom_field_values
          WHERE definition_id = 'cfdef_merge_person_pref_00000001'
        `)
      expect(customFieldRows).toEqual([{ entity_id: keep.id, text_value: "window" }])
    })

    it("rejects self person merges", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Self", lastName: "Merge" }),
      })
      const person = (await createRes.json()).data

      const res = await getApp().request(`/people/${person.id}/merge`, {
        method: "POST",
        ...json({ mergeId: person.id }),
      })

      expect(res.status).toBe(400)
    })

    it("replays person creates with the same idempotency key", async () => {
      const input = { firstName: "Idempotent", lastName: "Person" }
      const first = await getApp().request("/people", {
        method: "POST",
        ...jsonWithIdempotency(input, "crm-person-create-1"),
      })
      const replay = await getApp().request("/people", {
        method: "POST",
        ...jsonWithIdempotency(input, "crm-person-create-1"),
      })

      expect(first.status).toBe(201)
      expect(replay.status).toBe(201)
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true")
      const firstBody = await first.json()
      const replayBody = await replay.json()
      expect(replayBody.data.id).toBe(firstBody.data.id)
    })

    it("validates payment method kind-specific fields on create and patch", async () => {
      const personRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Payment", lastName: "Validation" }),
      })
      const person = (await personRes.json()).data

      const invalidCreate = await getApp().request(`/people/${person.id}/payment-methods`, {
        method: "POST",
        ...json({
          brand: "bank_transfer",
          last4: "1234",
          expMonth: 10,
          expYear: 2031,
          processorToken: "tok_bank_weird",
        }),
      })
      expect(invalidCreate.status).toBe(400)

      const validCreate = await getApp().request(`/people/${person.id}/payment-methods`, {
        method: "POST",
        ...json({
          brand: "mastercard",
          last4: "4444",
          expMonth: 10,
          expYear: 2031,
          processorToken: "tok_card",
        }),
      })
      expect(validCreate.status).toBe(201)
      const paymentMethod = (await validCreate.json()).data

      const invalidPatch = await getApp().request(`/person-payment-methods/${paymentMethod.id}`, {
        method: "PATCH",
        ...json({ brand: "bank_transfer" }),
      })
      expect(invalidPatch.status).toBe(400)
    })

    it("rejects invalid communication sentAt values before persistence", async () => {
      const personRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Communication", lastName: "Validation" }),
      })
      const person = (await personRes.json()).data

      const res = await getApp().request(`/people/${person.id}/communications`, {
        method: "POST",
        ...json({
          channel: "email",
          direction: "outbound",
          subject: "Bad date",
          content: "Body",
          sentAt: "not-a-date",
        }),
      })

      expect(res.status).toBe(400)
    })

    it("reflects contact-point updates without an explicit rebuild (#446 view)", async () => {
      // Replaces the old projection-cache assertion: the
      // `person_directory` view computes email/phone/website live, so
      // edits to `identity_contact_points` should flow through the
      // next list read with no rebuild call in between.
      const { identityService } = await import("@voyant-travel/identity/service")
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Live", lastName: "View", email: "first@example.com" }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data

      // Mutate the underlying contact point directly — bypassing the
      // person service's own update path on purpose.
      const { createTestDb } = await import("@voyant-travel/db/test-utils")
      const db = createTestDb()
      const contactPoints = await identityService.listContactPointsForEntity(
        db,
        "person",
        created.id,
      )
      const emailCp = contactPoints.find((p) => p.kind === "email")
      if (!emailCp) throw new Error("expected seeded email contact point")
      await identityService.updateContactPoint(db, emailCp.id, {
        entityType: "person",
        entityId: created.id,
        kind: "email",
        value: "second@example.com",
      })

      const refreshed = await getApp().request(`/people/${created.id}`, { method: "GET" })
      expect(refreshed.status).toBe(200)
      const body = await refreshed.json()
      expect(body.data.email).toBe("second@example.com")
    })

    it("hydrates inline person identity fields on create and list reads", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({
          firstName: "Identity",
          lastName: "Person",
          email: "identity@example.com",
          phone: "+40123456789",
          website: "https://example.com",
        }),
      })

      expect(createRes.status).toBe(201)
      const createBody = await createRes.json()
      expect(createBody.data.email).toBe("identity@example.com")
      expect(createBody.data.website).toBe("https://example.com")

      const listRes = await getApp().request("/people", { method: "GET" })

      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.data[0]?.email).toBe("identity@example.com")
      expect(listBody.data[0]?.phone).toBe("+40123456789")
    })

    it("searches people by email contact point", async () => {
      await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Email", lastName: "Match", email: "client@example.com" }),
      })
      await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Other", lastName: "Person", email: "other@example.com" }),
      })

      const res = await getApp().request(
        `/people?search=${encodeURIComponent("CLIENT@example.com")}`,
        {
          method: "GET",
        },
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0]?.email).toBe("client@example.com")
    })

    it("searches people by formatted phone contact point", async () => {
      await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Phone", lastName: "Match", phone: "+40 (712) 345-678" }),
      })
      await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Other", lastName: "Person", phone: "+40 799 000 000" }),
      })

      const res = await getApp().request(`/people?search=${encodeURIComponent("40712 345")}`, {
        method: "GET",
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0]?.phone).toBe("+40 (712) 345-678")
    })

    it("searches people by name tokens regardless of order or diacritics", async () => {
      await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Ion", lastName: "Gheorghiță" }),
      })
      await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Ioana", lastName: "Popescu" }),
      })

      const familyFirst = await getApp().request(
        `/people?search=${encodeURIComponent("Gheorghita Ion")}`,
        {
          method: "GET",
        },
      )

      expect(familyFirst.status).toBe(200)
      const familyFirstBody = await familyFirst.json()
      expect(familyFirstBody.total).toBe(1)
      expect(familyFirstBody.data[0]).toMatchObject({
        firstName: "Ion",
        lastName: "Gheorghiță",
      })

      const givenFirst = await getApp().request(
        `/people?search=${encodeURIComponent("Ion Gheorghita")}`,
        {
          method: "GET",
        },
      )

      expect(givenFirst.status).toBe(200)
      const givenFirstBody = await givenFirst.json()
      expect(givenFirstBody.total).toBe(1)
      expect(givenFirstBody.data[0]).toMatchObject({
        firstName: "Ion",
        lastName: "Gheorghiță",
      })
    })

    it("lists people", async () => {
      await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "A", lastName: "One" }),
      })

      const res = await getApp().request("/people", { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.total).toBeTypeOf("number")
    })

    it("gets a person by id", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Jane", lastName: "Doe" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.firstName).toBe("Jane")
    })

    it("updates a person", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Old", lastName: "Name" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}`, {
        method: "PATCH",
        ...json({ firstName: "New" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.firstName).toBe("New")
    })

    it("preserves person status and tags on an empty patch", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({
          firstName: "Patch",
          lastName: "Defaults",
          relation: "client",
          status: "inactive",
          tags: ["qa", "people", "alpha"],
        }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}`, {
        method: "PATCH",
        ...json({}),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toMatchObject({
        firstName: "Patch",
        lastName: "Defaults",
        relation: "client",
        status: "inactive",
        tags: ["qa", "people", "alpha"],
      })
    })

    it("preserves contact points on a partial update that omits them (#1971)", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({
          firstName: "Keep",
          lastName: "Contacts",
          email: "keep@example.com",
          phone: "+15551230000",
        }),
      })
      const { data: created } = await createRes.json()

      // PATCH a base field only — email/phone are absent from the body.
      const res = await getApp().request(`/people/${created.id}`, {
        method: "PATCH",
        ...json({ jobTitle: "Manager" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.jobTitle).toBe("Manager")
      // The omitted identity fields must survive the update, not be cleared.
      expect(body.data.email).toBe("keep@example.com")
      expect(body.data.phone).toBe("+15551230000")
    })

    it("clears a contact point on an explicit null update (#1971)", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Clear", lastName: "Email", email: "clear@example.com" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}`, {
        method: "PATCH",
        ...json({ email: null }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.email).toBeNull()
    })

    it("deletes a person", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Del", lastName: "Ete" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("returns 404 for non-existent person", async () => {
      const res = await getApp().request("/people/crm_ppl_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("creates nested contact methods from the person path", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Nested", lastName: "Contact" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}/contact-methods`, {
        method: "POST",
        ...json({
          kind: "email",
          value: "nested.person@example.com",
          isPrimary: true,
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toMatchObject({
        entityType: "person",
        entityId: created.id,
        kind: "email",
        value: "nested.person@example.com",
      })
    })

    it("derives nested contact method ownership from the person path", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Nested", lastName: "Owner" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}/contact-methods`, {
        method: "POST",
        ...json({
          entityType: "organization",
          entityId: "crm_org_wrong_000000000000000000",
          kind: "email",
          value: "nested.owner@example.com",
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toMatchObject({
        entityType: "person",
        entityId: created.id,
        kind: "email",
        value: "nested.owner@example.com",
      })
    })

    it("creates nested addresses from natural person payloads", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Nested", lastName: "Address" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}/addresses`, {
        method: "POST",
        ...json({
          label: "billing",
          line1: "20 Main Street",
          city: "Cluj-Napoca",
          country: "RO",
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toMatchObject({
        entityType: "person",
        entityId: created.id,
        label: "billing",
        line1: "20 Main Street",
      })
    })

    it("rejects nested identity rows for missing people", async () => {
      const { createTestDb } = await import("@voyant-travel/db/test-utils")
      const db = createTestDb()
      const missingPersonId = "pers_missing_nested_identity_0001"

      const contactRes = await getApp().request(`/people/${missingPersonId}/contact-methods`, {
        method: "POST",
        ...json({ kind: "email", value: "missing.person@example.com" }),
      })
      const addressRes = await getApp().request(`/people/${missingPersonId}/addresses`, {
        method: "POST",
        ...json({ label: "billing", line1: "Missing Person Street" }),
      })

      expect(contactRes.status).toBe(404)
      expect(addressRes.status).toBe(404)

      const contactRows = await db.execute<{ count: number }>(sql`
          SELECT count(*)::int
          FROM identity_contact_points
          WHERE entity_type = 'person'
            AND entity_id = ${missingPersonId}
        `)
      const addressRows = await db.execute<{ count: number }>(sql`
          SELECT count(*)::int
          FROM identity_addresses
          WHERE entity_type = 'person'
            AND entity_id = ${missingPersonId}
        `)
      expect(contactRows[0]?.count).toBe(0)
      expect(addressRows[0]?.count).toBe(0)
    })

    it("creates a person note", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({ firstName: "Note", lastName: "Person" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/people/${created.id}/notes`, {
        method: "POST",
        ...json({ content: "Prefers email outreach" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.content).toBe("Prefers email outreach")
      expect(body.data.authorUserId).toBe("test-user-id")
    })

    it("neutralizes spreadsheet formula injection in the people CSV export", async () => {
      const createRes = await getApp().request("/people", {
        method: "POST",
        ...json({
          firstName: '=HYPERLINK("http://evil.test","click")',
          lastName: "Doe, Jane",
          jobTitle: "@SUM(1+9)",
        }),
      })
      expect(createRes.status).toBe(201)

      const res = await getApp().request("/people/export", { method: "POST" })
      expect(res.status).toBe(200)

      const csv = await res.text()
      // Formula prefixes (= @) are neutralized with a leading single quote.
      expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"",""click"")"`)
      expect(csv).toContain("'@SUM(1+9)")
      expect(csv).not.toContain(",=HYPERLINK")
      // Structural quoting of delimiters is preserved.
      expect(csv).toContain('"Doe, Jane"')
    })
  })
})
