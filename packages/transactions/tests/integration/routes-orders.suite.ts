import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { orderParticipants } from "../../src/schema.js"
import { app, db, json, seedOrder, seedOrderParticipant } from "./routes.test-support.js"

export function registerOrderSuites() {
  describe("Orders", () => {
    it("POST /orders → 201", async () => {
      const order = await seedOrder()
      expect(order.id).toMatch(/^ord_/)
      expect(order.orderNumber).toMatch(/^ORD-\d{13}-0001$/)
      expect(order.title).toBe("Order 0001")
      expect(order.currency).toBe("USD")
      expect(order.status).toBe("draft")
    })

    it("GET /orders/:id → 200", async () => {
      const order = await seedOrder()
      const res = await app.request(`/orders/${order.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(order.id)
    })

    it("GET /orders/:id → 404 for missing", async () => {
      const res = await app.request("/orders/ord_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /orders/:id → 200", async () => {
      const order = await seedOrder()
      const res = await app.request(`/orders/${order.id}`, {
        method: "PATCH",
        ...json({ title: "Updated Order", status: "confirmed", totalAmountCents: 75000 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.title).toBe("Updated Order")
      expect(body.data.status).toBe("confirmed")
      expect(body.data.totalAmountCents).toBe(75000)
    })

    it("PATCH /orders/:id → 404 for missing", async () => {
      const res = await app.request("/orders/ord_nonexistent", {
        method: "PATCH",
        ...json({ title: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /orders/:id → 200", async () => {
      const order = await seedOrder()
      const res = await app.request(`/orders/${order.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const get = await app.request(`/orders/${order.id}`)
      expect(get.status).toBe(404)
    })

    it("DELETE /orders/:id → 404 for missing", async () => {
      const res = await app.request("/orders/ord_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /orders → list with pagination", async () => {
      await seedOrder()
      await seedOrder()
      const res = await app.request("/orders?limit=1&offset=0")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it("GET /orders → filter by status", async () => {
      await seedOrder({ status: "draft" })
      await seedOrder({ status: "confirmed" })
      const res = await app.request("/orders?status=confirmed")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("confirmed")
    })

    it("GET /orders → search by title", async () => {
      await seedOrder({ title: "Summer Safari" })
      await seedOrder({ title: "Winter Trip" })
      const res = await app.request("/orders?search=Safari")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].title).toBe("Summer Safari")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Order Participants
	   ═══════════════════════════════════════════════════════ */
  describe("Order Travelers", () => {
    it("POST /order-travelers → 201", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      expect(participant.id).toMatch(/^orpt_/)
      expect(participant.orderId).toBe(order.id)
      expect(participant.participantType).toBe("traveler")
    })

    it("GET /order-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const res = await app.request(`/order-travelers/${participant.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /order-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-travelers/orpt_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /order-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const res = await app.request(`/order-travelers/${participant.id}`, {
        method: "PATCH",
        ...json({ isPrimary: true, travelerCategory: "child" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isPrimary).toBe(true)
      expect(body.data.travelerCategory).toBe("child")
    })

    it("PATCH /order-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-travelers/orpt_nonexistent", {
        method: "PATCH",
        ...json({ isPrimary: true }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /order-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const res = await app.request(`/order-travelers/${participant.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /order-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-travelers/orpt_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /order-travelers → list by orderId", async () => {
      const o1 = await seedOrder()
      const o2 = await seedOrder()
      await seedOrderParticipant(o1.id)
      await seedOrderParticipant(o1.id)
      await seedOrderParticipant(o2.id)

      const res = await app.request(`/order-travelers?orderId=${o1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("stores order participant travel identity encrypted and serves it through the dedicated route", async () => {
      const order = await seedOrder()
      const res = await app.request("/order-travelers", {
        method: "POST",
        ...json({
          orderId: order.id,
          firstName: "Mihai",
          lastName: "Traveler",
          dateOfBirth: "1988-01-02",
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
        .from(orderParticipants)
        .where(eq(orderParticipants.id, body.data.id))

      expect(stored.identityEncrypted?.enc).toMatch(/^env:v1:/)

      const detailsRes = await app.request(`/order-travelers/${body.data.id}/travel-details`)
      expect(detailsRes.status).toBe(200)
      const details = await detailsRes.json()
      expect(details.data.travelerId).toBe(body.data.id)
      expect(details.data.participantId).toBeUndefined()
      expect(details.data.dateOfBirth).toBe("1988-01-02")
      expect(details.data.nationality).toBe("RO")
    })
  })
}
