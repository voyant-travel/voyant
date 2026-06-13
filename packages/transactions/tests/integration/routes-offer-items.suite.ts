import { describe, expect, it } from "vitest"
import {
  app,
  json,
  seedOffer,
  seedOfferItem,
  seedOfferItemParticipant,
  seedOfferParticipant,
} from "./routes.test-support.js"

export function registerOfferItemSuites() {
  describe("Offer Items", () => {
    it("POST /offer-items → 201", async () => {
      const offer = await seedOffer()
      const item = await seedOfferItem(offer.id)
      expect(item.id).toMatch(/^ofit_/)
      expect(item.offerId).toBe(offer.id)
      expect(item.itemType).toBe("unit")
      expect(item.status).toBe("draft")
      expect(item.quantity).toBe(1)
    })

    it("GET /offer-items/:id → 200", async () => {
      const offer = await seedOffer()
      const item = await seedOfferItem(offer.id)
      const res = await app.request(`/offer-items/${item.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /offer-items/:id → 404 for missing", async () => {
      const res = await app.request("/offer-items/ofit_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /offer-items/:id → 200", async () => {
      const offer = await seedOffer()
      const item = await seedOfferItem(offer.id)
      const res = await app.request(`/offer-items/${item.id}`, {
        method: "PATCH",
        ...json({ status: "priced", quantity: 3, unitSellAmountCents: 1500 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("priced")
      expect(body.data.quantity).toBe(3)
      expect(body.data.unitSellAmountCents).toBe(1500)
    })

    it("PATCH /offer-items/:id → 404 for missing", async () => {
      const res = await app.request("/offer-items/ofit_nonexistent", {
        method: "PATCH",
        ...json({ quantity: 5 }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /offer-items/:id → 200", async () => {
      const offer = await seedOffer()
      const item = await seedOfferItem(offer.id)
      const res = await app.request(`/offer-items/${item.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /offer-items/:id → 404 for missing", async () => {
      const res = await app.request("/offer-items/ofit_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /offer-items → list by offerId", async () => {
      const offer = await seedOffer()
      await seedOfferItem(offer.id)
      await seedOfferItem(offer.id)

      const res = await app.request(`/offer-items?offerId=${offer.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it("GET /offer-items → filter by status", async () => {
      const offer = await seedOffer()
      await seedOfferItem(offer.id, { status: "draft" })
      await seedOfferItem(offer.id, { status: "priced" })

      const res = await app.request("/offer-items?status=priced")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("priced")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Offer Item Participants
	   ═══════════════════════════════════════════════════════ */
  describe("Offer Item Travelers", () => {
    it("POST /offer-item-travelers → 201", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      const link = await seedOfferItemParticipant(item.id, participant.id)
      expect(link.id).toMatch(/^ofip_/)
      expect(link.offerItemId).toBe(item.id)
      expect(link.travelerId).toBe(participant.id)
      expect(link.role).toBe("traveler")
    })

    it("GET /offer-item-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      const link = await seedOfferItemParticipant(item.id, participant.id)
      const res = await app.request(`/offer-item-travelers/${link.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /offer-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-item-travelers/ofip_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /offer-item-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      const link = await seedOfferItemParticipant(item.id, participant.id)
      const res = await app.request(`/offer-item-travelers/${link.id}`, {
        method: "PATCH",
        ...json({ role: "occupant", isPrimary: true }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.role).toBe("occupant")
      expect(body.data.isPrimary).toBe(true)
    })

    it("PATCH /offer-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-item-travelers/ofip_nonexistent", {
        method: "PATCH",
        ...json({ role: "occupant" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /offer-item-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      const link = await seedOfferItemParticipant(item.id, participant.id)
      const res = await app.request(`/offer-item-travelers/${link.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /offer-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-item-travelers/ofip_nonexistent", {
        method: "DELETE",
      })
      expect(res.status).toBe(404)
    })

    it("GET /offer-item-travelers → list by offerItemId", async () => {
      const offer = await seedOffer()
      const p1 = await seedOfferParticipant(offer.id)
      const p2 = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      await seedOfferItemParticipant(item.id, p1.id)
      await seedOfferItemParticipant(item.id, p2.id)

      const res = await app.request(`/offer-item-travelers?offerItemId=${item.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })
  })
}
