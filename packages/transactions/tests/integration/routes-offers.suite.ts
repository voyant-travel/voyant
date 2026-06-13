import { describe, expect, it } from "vitest"
import { app, json, seedOffer } from "./routes.test-support.js"

export function registerOfferSuites() {
  describe("Offers", () => {
    it("POST /offers → 201", async () => {
      const offer = await seedOffer()
      expect(offer.id).toMatch(/^ofr_/)
      expect(offer.offerNumber).toMatch(/^OFF-\d{13}-0001$/)
      expect(offer.title).toBe("Offer 0001")
      expect(offer.currency).toBe("USD")
      expect(offer.status).toBe("draft")
    })

    it("GET /offers/:id → 200", async () => {
      const offer = await seedOffer()
      const res = await app.request(`/offers/${offer.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(offer.id)
    })

    it("GET /offers/:id → 404 for missing", async () => {
      const res = await app.request("/offers/ofr_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /offers/:id → 200", async () => {
      const offer = await seedOffer()
      const res = await app.request(`/offers/${offer.id}`, {
        method: "PATCH",
        ...json({ title: "Updated Offer", status: "published", totalAmountCents: 50000 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.title).toBe("Updated Offer")
      expect(body.data.status).toBe("published")
      expect(body.data.totalAmountCents).toBe(50000)
    })

    it("PATCH /offers/:id → 404 for missing", async () => {
      const res = await app.request("/offers/ofr_nonexistent", {
        method: "PATCH",
        ...json({ title: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /offers/:id → 200", async () => {
      const offer = await seedOffer()
      const res = await app.request(`/offers/${offer.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const get = await app.request(`/offers/${offer.id}`)
      expect(get.status).toBe(404)
    })

    it("DELETE /offers/:id → 404 for missing", async () => {
      const res = await app.request("/offers/ofr_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /offers → list with pagination", async () => {
      await seedOffer()
      await seedOffer()
      const res = await app.request("/offers?limit=1&offset=0")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it("GET /offers → filter by status", async () => {
      await seedOffer({ status: "draft" })
      await seedOffer({ status: "published" })
      const res = await app.request("/offers?status=published")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("published")
    })

    it("GET /offers → search by title", async () => {
      await seedOffer({ title: "Alpha Trip" })
      await seedOffer({ title: "Beta Tour" })
      const res = await app.request("/offers?search=Alpha")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].title).toBe("Alpha Trip")
    })
  })
}
