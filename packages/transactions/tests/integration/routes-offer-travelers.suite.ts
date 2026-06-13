import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { offerParticipants, transactionPiiAccessLog } from "../../src/schema.js"
import { app, db, json, seedOffer, seedOfferParticipant } from "./routes.test-support.js"

export function registerOfferTravelerSuites() {
  describe("Offer Travelers", () => {
    it("POST /offer-travelers → 201", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      expect(participant.id).toMatch(/^ofpt_/)
      expect(participant.offerId).toBe(offer.id)
      expect(participant.participantType).toBe("traveler")
      expect(participant.isPrimary).toBe(false)
    })

    it("GET /offer-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const res = await app.request(`/offer-travelers/${participant.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /offer-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-travelers/ofpt_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /offer-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const res = await app.request(`/offer-travelers/${participant.id}`, {
        method: "PATCH",
        ...json({ isPrimary: true, participantType: "occupant" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isPrimary).toBe(true)
      expect(body.data.participantType).toBe("occupant")
    })

    it("PATCH /offer-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-travelers/ofpt_nonexistent", {
        method: "PATCH",
        ...json({ isPrimary: true }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /offer-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const res = await app.request(`/offer-travelers/${participant.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /offer-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-travelers/ofpt_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /offer-travelers → list by offerId", async () => {
      const o1 = await seedOffer()
      const o2 = await seedOffer()
      await seedOfferParticipant(o1.id)
      await seedOfferParticipant(o1.id)
      await seedOfferParticipant(o2.id)

      const res = await app.request(`/offer-travelers?offerId=${o1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("stores offer participant travel identity encrypted and keeps generic responses non-sensitive", async () => {
      const offer = await seedOffer()
      const res = await app.request("/offer-travelers", {
        method: "POST",
        ...json({
          offerId: offer.id,
          firstName: "Ana",
          lastName: "Traveler",
          dateOfBirth: "1990-02-03",
          nationality: "RO",
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.hasTravelIdentity).toBe(true)
      expect(body.data).not.toHaveProperty("dateOfBirth")
      expect(body.data).not.toHaveProperty("nationality")

      const [stored] = await db
        .select()
        .from(offerParticipants)
        .where(eq(offerParticipants.id, body.data.id))

      expect(stored.identityEncrypted?.enc).toMatch(/^env:v1:/)
      expect(stored.identityEncrypted?.enc).not.toContain("1990-02-03")

      const detailsRes = await app.request(`/offer-travelers/${body.data.id}/travel-details`)
      expect(detailsRes.status).toBe(200)
      const details = await detailsRes.json()
      expect(details.data.travelerId).toBe(body.data.id)
      expect(details.data.participantId).toBeUndefined()
      expect(details.data.dateOfBirth).toBe("1990-02-03")
      expect(details.data.nationality).toBe("RO")
    })

    it("audits denied offer participant pii reads", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      await app.request(`/offer-travelers/${participant.id}/travel-details`, {
        method: "PATCH",
        ...json({ nationality: "RO" }),
      })

      const restrictedApp = new Hono()
      restrictedApp.use("*", async (c, next) => {
        c.set("db" as never, db)
        c.set("userId" as never, "test-customer-id")
        c.set("actor" as never, "customer")
        await next()
      })
      restrictedApp.route("/", (await import("../../src/routes.js")).transactionsRoutes)

      const denied = await restrictedApp.request(
        `/offer-travelers/${participant.id}/travel-details`,
      )
      expect(denied.status).toBe(403)
      expect(await denied.json()).toMatchObject({
        error: "Forbidden",
        code: "forbidden",
      })

      const rows = await db
        .select()
        .from(transactionPiiAccessLog)
        .where(eq(transactionPiiAccessLog.travelerId, participant.id))

      expect(
        rows.some(
          (row: { outcome: string; reason: string | null; travelerKind: string }) =>
            row.outcome === "denied" &&
            row.reason === "insufficient_scope" &&
            row.travelerKind === "offer",
        ),
      ).toBe(true)
    })
  })
}
