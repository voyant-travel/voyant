import { describe, expect, it } from "vitest"
import {
  app,
  json,
  seedOffer,
  seedOrder,
  seedOrderItem,
  seedOrderItemParticipant,
  seedOrderParticipant,
  seedOrderTerm,
} from "./routes.test-support.js"

export function registerOrderItemSuites() {
  describe("Order Items", () => {
    it("POST /order-items → 201", async () => {
      const order = await seedOrder()
      const item = await seedOrderItem(order.id)
      expect(item.id).toMatch(/^orit_/)
      expect(item.orderId).toBe(order.id)
      expect(item.itemType).toBe("unit")
      expect(item.status).toBe("draft")
    })

    it("GET /order-items/:id → 200", async () => {
      const order = await seedOrder()
      const item = await seedOrderItem(order.id)
      const res = await app.request(`/order-items/${item.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /order-items/:id → 404 for missing", async () => {
      const res = await app.request("/order-items/orit_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /order-items/:id → 200", async () => {
      const order = await seedOrder()
      const item = await seedOrderItem(order.id)
      const res = await app.request(`/order-items/${item.id}`, {
        method: "PATCH",
        ...json({ status: "confirmed", quantity: 2 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("confirmed")
      expect(body.data.quantity).toBe(2)
    })

    it("PATCH /order-items/:id → 404 for missing", async () => {
      const res = await app.request("/order-items/orit_nonexistent", {
        method: "PATCH",
        ...json({ quantity: 5 }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /order-items/:id → 200", async () => {
      const order = await seedOrder()
      const item = await seedOrderItem(order.id)
      const res = await app.request(`/order-items/${item.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /order-items/:id → 404 for missing", async () => {
      const res = await app.request("/order-items/orit_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /order-items → list by orderId", async () => {
      const order = await seedOrder()
      await seedOrderItem(order.id)
      await seedOrderItem(order.id)

      const res = await app.request(`/order-items?orderId=${order.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it("GET /order-items → filter by status", async () => {
      const order = await seedOrder()
      await seedOrderItem(order.id, { status: "draft" })
      await seedOrderItem(order.id, { status: "confirmed" })

      const res = await app.request("/order-items?status=confirmed")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("confirmed")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Order Item Participants
	   ═══════════════════════════════════════════════════════ */
  describe("Order Item Travelers", () => {
    it("POST /order-item-travelers → 201", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      const link = await seedOrderItemParticipant(item.id, participant.id)
      expect(link.id).toMatch(/^orip_/)
      expect(link.orderItemId).toBe(item.id)
      expect(link.travelerId).toBe(participant.id)
      expect(link.role).toBe("traveler")
    })

    it("GET /order-item-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      const link = await seedOrderItemParticipant(item.id, participant.id)
      const res = await app.request(`/order-item-travelers/${link.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /order-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-item-travelers/orip_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /order-item-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      const link = await seedOrderItemParticipant(item.id, participant.id)
      const res = await app.request(`/order-item-travelers/${link.id}`, {
        method: "PATCH",
        ...json({ role: "beneficiary", isPrimary: true }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.role).toBe("beneficiary")
      expect(body.data.isPrimary).toBe(true)
    })

    it("PATCH /order-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-item-travelers/orip_nonexistent", {
        method: "PATCH",
        ...json({ role: "occupant" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /order-item-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      const link = await seedOrderItemParticipant(item.id, participant.id)
      const res = await app.request(`/order-item-travelers/${link.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /order-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-item-travelers/orip_nonexistent", {
        method: "DELETE",
      })
      expect(res.status).toBe(404)
    })

    it("GET /order-item-travelers → list by orderItemId", async () => {
      const order = await seedOrder()
      const p1 = await seedOrderParticipant(order.id)
      const p2 = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      await seedOrderItemParticipant(item.id, p1.id)
      await seedOrderItemParticipant(item.id, p2.id)

      const res = await app.request(`/order-item-travelers?orderItemId=${item.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Order Terms
	   ═══════════════════════════════════════════════════════ */
  describe("Order Terms", () => {
    it("POST /order-terms → 201 with orderId", async () => {
      const order = await seedOrder()
      const term = await seedOrderTerm({ orderId: order.id })
      expect(term.id).toMatch(/^ortm_/)
      expect(term.orderId).toBe(order.id)
      expect(term.termType).toBe("terms_and_conditions")
      expect(term.acceptanceStatus).toBe("pending")
      expect(term.required).toBe(true)
    })

    it("POST /order-terms → 201 with offerId", async () => {
      const offer = await seedOffer()
      const term = await seedOrderTerm({ offerId: offer.id })
      expect(term.offerId).toBe(offer.id)
    })

    it("GET /order-terms/:id → 200", async () => {
      const order = await seedOrder()
      const term = await seedOrderTerm({ orderId: order.id })
      const res = await app.request(`/order-terms/${term.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(term.id)
    })

    it("GET /order-terms/:id → 404 for missing", async () => {
      const res = await app.request("/order-terms/ortm_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /order-terms/:id → 200", async () => {
      const order = await seedOrder()
      const term = await seedOrderTerm({ orderId: order.id })
      const res = await app.request(`/order-terms/${term.id}`, {
        method: "PATCH",
        ...json({
          termType: "cancellation",
          acceptanceStatus: "accepted",
          title: "Updated Term",
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.termType).toBe("cancellation")
      expect(body.data.acceptanceStatus).toBe("accepted")
      expect(body.data.title).toBe("Updated Term")
    })

    it("PATCH /order-terms/:id → 404 for missing", async () => {
      const res = await app.request("/order-terms/ortm_nonexistent", {
        method: "PATCH",
        ...json({ title: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /order-terms/:id → 200", async () => {
      const order = await seedOrder()
      const term = await seedOrderTerm({ orderId: order.id })
      const res = await app.request(`/order-terms/${term.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /order-terms/:id → 404 for missing", async () => {
      const res = await app.request("/order-terms/ortm_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /order-terms → list by orderId", async () => {
      const o1 = await seedOrder()
      const o2 = await seedOrder()
      await seedOrderTerm({ orderId: o1.id })
      await seedOrderTerm({ orderId: o1.id })
      await seedOrderTerm({ orderId: o2.id })

      const res = await app.request(`/order-terms?orderId=${o1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /order-terms → filter by termType", async () => {
      const order = await seedOrder()
      await seedOrderTerm({ orderId: order.id }, { termType: "terms_and_conditions" })
      await seedOrderTerm({ orderId: order.id }, { termType: "cancellation" })

      const res = await app.request("/order-terms?termType=cancellation")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].termType).toBe("cancellation")
    })

    it("GET /order-terms → filter by acceptanceStatus", async () => {
      const order = await seedOrder()
      await seedOrderTerm({ orderId: order.id }, { acceptanceStatus: "pending" })
      await seedOrderTerm({ orderId: order.id }, { acceptanceStatus: "accepted" })

      const res = await app.request("/order-terms?acceptanceStatus=accepted")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].acceptanceStatus).toBe("accepted")
    })
  })
}
