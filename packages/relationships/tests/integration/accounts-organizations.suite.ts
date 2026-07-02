import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import {
  DB_AVAILABLE,
  json,
  jsonWithIdempotency,
  setupAccountRoutesTest,
} from "./accounts-test-utils.js"

describe.skipIf(!DB_AVAILABLE)("Organization account routes", () => {
  const getApp = setupAccountRoutesTest()

  describe("Organizations", () => {
    it("creates an organization", async () => {
      const res = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "Acme Corp" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.name).toBe("Acme Corp")
      expect(body.data.id).toBeTruthy()
      expect(body.data.status).toBe("active")
    })

    it("replays organization creates with the same idempotency key", async () => {
      const input = { name: "Idempotent Org" }
      const first = await getApp().request("/organizations", {
        method: "POST",
        ...jsonWithIdempotency(input, "crm-org-create-1"),
      })
      const replay = await getApp().request("/organizations", {
        method: "POST",
        ...jsonWithIdempotency(input, "crm-org-create-1"),
      })

      expect(first.status).toBe(201)
      expect(replay.status).toBe(201)
      expect(replay.headers.get("Idempotency-Replayed")).toBe("true")
      const firstBody = await first.json()
      const replayBody = await replay.json()
      expect(replayBody.data.id).toBe(firstBody.data.id)
    })

    it("lists organizations", async () => {
      await getApp().request("/organizations", { method: "POST", ...json({ name: "Org A" }) })
      await getApp().request("/organizations", { method: "POST", ...json({ name: "Org B" }) })

      const res = await getApp().request("/organizations", { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeInstanceOf(Array)
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(2)
    })

    it("finds organizations by exact tax id even when names do not match", async () => {
      await getApp().request("/organizations", {
        method: "POST",
        ...json({
          name: "Existing Travel Company",
          legalName: "Existing Travel SRL",
          taxId: "RO44255073",
        }),
      })
      await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "Different Company", legalName: "Different SRL", taxId: "RO00000000" }),
      })

      const res = await getApp().request("/organizations?search=Missing&taxId=%20RO44255073%20", {
        method: "GET",
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0]).toMatchObject({
        name: "Existing Travel Company",
        taxId: "RO44255073",
      })

      const byTaxId = await getApp().request("/organizations?tax_id=RO44255073", { method: "GET" })
      expect(byTaxId.status).toBe(200)
      const byTaxIdBody = await byTaxId.json()
      expect(byTaxIdBody.data).toHaveLength(1)
      expect(byTaxIdBody.data[0]).toMatchObject({
        name: "Existing Travel Company",
        taxId: "RO44255073",
      })
    })

    it("gets an organization by id", async () => {
      const createRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "GetMe" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/organizations/${created.id}`, { method: "GET" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe("GetMe")
    })

    it("updates an organization", async () => {
      const createRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "Old Name" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/organizations/${created.id}`, {
        method: "PATCH",
        ...json({ name: "New Name" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe("New Name")
    })

    it("patches only fields explicitly sent by the caller", async () => {
      const createRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({
          name: "Partial Update Org",
          legalName: "Partial Update Org SRL",
          status: "inactive",
          tags: ["preferred", "agency"],
        }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/organizations/${created.id}`, {
        method: "PATCH",
        ...json({ name: "Renamed Partial Update Org" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toMatchObject({
        name: "Renamed Partial Update Org",
        legalName: "Partial Update Org SRL",
        status: "inactive",
        tags: ["preferred", "agency"],
      })
    })

    it("merges duplicate organizations and repoints people and booking references", async () => {
      const { createTestDb } = await import("@voyant-travel/db/test-utils")
      const db = createTestDb()

      const keepRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "Acme Travel", tags: ["agency"] }),
      })
      const mergeRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({
          name: "Acme Travel SRL",
          legalName: "Acme Travel SRL",
          taxId: "RO123456",
          paymentTerms: 14,
          tags: ["billing"],
        }),
      })
      const keep = (await keepRes.json()).data
      const merge = (await mergeRes.json()).data

      const personRes = await getApp().request("/people", {
        method: "POST",
        ...json({
          firstName: "Org",
          lastName: "Contact",
          organizationId: merge.id,
        }),
      })
      const person = (await personRes.json()).data

      await db.execute(sql`
          INSERT INTO bookings (
            id,
            booking_number,
            status,
            organization_id,
            source_type,
            sell_currency
          )
          VALUES (
            'book_merge_org_000000000000000000001',
            'B-MERGE-ORG-1',
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
            'cfdef_merge_org_tier_000000000001',
            'organization',
            'merge_org_tier',
            'Merge organization tier',
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
              'cfval_merge_org_keep_000000000001',
              'cfdef_merge_org_tier_000000000001',
              'organization',
              ${keep.id},
              'gold'
            ),
            (
              'cfval_merge_org_dup_000000000001',
              'cfdef_merge_org_tier_000000000001',
              'organization',
              ${merge.id},
              'silver'
            )
        `)

      const res = await getApp().request(`/organizations/${keep.id}/merge`, {
        method: "POST",
        ...json({ mergeId: merge.id }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(keep.id)
      expect(body.data.name).toBe("Acme Travel")
      expect(body.data.legalName).toBe("Acme Travel SRL")
      expect(body.data.taxId).toBe("RO123456")
      expect(body.data.paymentTerms).toBe(14)
      expect(body.data.tags).toEqual(["agency", "billing"])

      const duplicate = await getApp().request(`/organizations/${merge.id}`, { method: "GET" })
      expect(duplicate.status).toBe(404)

      const personAfterMerge = await getApp().request(`/people/${person.id}`, { method: "GET" })
      expect(personAfterMerge.status).toBe(200)
      expect((await personAfterMerge.json()).data.organizationId).toBe(keep.id)

      const bookingRows = await db.execute<{ organization_id: string }>(sql`
          SELECT organization_id
          FROM bookings
          WHERE id = 'book_merge_org_000000000000000000001'
        `)
      expect(bookingRows[0]?.organization_id).toBe(keep.id)

      const customFieldRows = await db.execute<{ entity_id: string; text_value: string }>(sql`
          SELECT entity_id, text_value
          FROM custom_field_values
          WHERE definition_id = 'cfdef_merge_org_tier_000000000001'
        `)
      expect(customFieldRows).toEqual([{ entity_id: keep.id, text_value: "gold" }])
    })

    it("deletes an organization", async () => {
      const createRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "ToDelete" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/organizations/${created.id}`, { method: "DELETE" })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it("rejects deleting an organization while people are linked", async () => {
      const createRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "Linked People Org" }),
      })
      const { data: organization } = await createRes.json()

      const personRes = await getApp().request("/people", {
        method: "POST",
        ...json({
          firstName: "Linked",
          lastName: "Person",
          organizationId: organization.id,
        }),
      })
      expect(personRes.status).toBe(201)
      const { data: person } = await personRes.json()

      const res = await getApp().request(`/organizations/${organization.id}`, { method: "DELETE" })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe("Organization has linked people")

      const personAfterDelete = await getApp().request(`/people/${person.id}`, { method: "GET" })
      expect(personAfterDelete.status).toBe(200)
      expect((await personAfterDelete.json()).data.organizationId).toBe(organization.id)
    })

    it("returns 404 for non-existent organization", async () => {
      const res = await getApp().request("/organizations/crm_org_00000000000000000000000000", {
        method: "GET",
      })
      expect(res.status).toBe(404)
    })

    it("creates nested contact methods from the organization path", async () => {
      const createRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "Contact Method Org" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/organizations/${created.id}/contact-methods`, {
        method: "POST",
        ...json({
          entityType: "person",
          entityId: "pers_wrong_000000000000000000000",
          kind: "email",
          value: "ops@example.com",
          isPrimary: true,
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toMatchObject({
        entityType: "organization",
        entityId: created.id,
        kind: "email",
        value: "ops@example.com",
      })
    })

    it("creates nested addresses from natural organization payloads", async () => {
      const createRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "Address Org" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/organizations/${created.id}/addresses`, {
        method: "POST",
        ...json({
          label: "billing",
          line1: "10 Main Street",
          city: "Bucharest",
          country: "RO",
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toMatchObject({
        entityType: "organization",
        entityId: created.id,
        label: "billing",
        line1: "10 Main Street",
      })
    })

    it("rejects nested identity rows for missing organizations", async () => {
      const { createTestDb } = await import("@voyant-travel/db/test-utils")
      const db = createTestDb()
      const missingOrganizationId = "crm_org_missing_nested_identity_0001"

      const contactRes = await getApp().request(
        `/organizations/${missingOrganizationId}/contact-methods`,
        {
          method: "POST",
          ...json({ kind: "email", value: "missing@example.com" }),
        },
      )
      const addressRes = await getApp().request(
        `/organizations/${missingOrganizationId}/addresses`,
        {
          method: "POST",
          ...json({ label: "billing", line1: "Missing Street" }),
        },
      )

      expect(contactRes.status).toBe(404)
      expect(addressRes.status).toBe(404)

      const contactRows = await db.execute<{ count: number }>(sql`
          SELECT count(*)::int
          FROM identity_contact_points
          WHERE entity_type = 'organization'
            AND entity_id = ${missingOrganizationId}
        `)
      const addressRows = await db.execute<{ count: number }>(sql`
          SELECT count(*)::int
          FROM identity_addresses
          WHERE entity_type = 'organization'
            AND entity_id = ${missingOrganizationId}
        `)
      expect(contactRows[0]?.count).toBe(0)
      expect(addressRows[0]?.count).toBe(0)
    })

    it("creates an organization note", async () => {
      const createRes = await getApp().request("/organizations", {
        method: "POST",
        ...json({ name: "Notes Org" }),
      })
      const { data: created } = await createRes.json()

      const res = await getApp().request(`/organizations/${created.id}/notes`, {
        method: "POST",
        ...json({ content: "Call back next week" }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.content).toBe("Call back next week")
      expect(body.data.authorUserId).toBe("test-user-id")
    })
  })
})
