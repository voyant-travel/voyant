import { describe, expect, it } from "vitest"
import { app, json, seedOrder, seedOrderItem } from "./routes.test-support.js"

export function registerOrderAssignmentSuites() {
  describe("Order Staff Assignments", () => {
    it("supports CRUD and filtering on /order-staff-assignments", async () => {
      const order = await seedOrder()
      const otherOrder = await seedOrder()
      const orderItem = await seedOrderItem(order.id)

      const createRes = await app.request("/order-staff-assignments", {
        method: "POST",
        ...json({
          orderId: order.id,
          orderItemId: orderItem.id,
          firstName: "Driver",
          lastName: "One",
          role: "service_assignee",
          phone: "+40123456789",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.id).toMatch(/^orsa_/)
      expect(created.orderId).toBe(order.id)
      expect(created.orderItemId).toBe(orderItem.id)

      await app.request("/order-staff-assignments", {
        method: "POST",
        ...json({
          orderId: otherOrder.id,
          firstName: "Driver",
          lastName: "Two",
          role: "other",
        }),
      })

      const listRes = await app.request(
        `/order-staff-assignments?orderId=${order.id}&role=service_assignee`,
      )
      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.total).toBe(1)
      expect(listBody.data[0].id).toBe(created.id)

      const getRes = await app.request(`/order-staff-assignments/${created.id}`)
      expect(getRes.status).toBe(200)
      expect((await getRes.json()).data.phone).toBe("+40123456789")

      const patchRes = await app.request(`/order-staff-assignments/${created.id}`, {
        method: "PATCH",
        ...json({
          role: "other",
          notes: "Updated driver assignment",
          isPrimary: false,
        }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.role).toBe("other")
      expect(patched.notes).toBe("Updated driver assignment")
      expect(patched.isPrimary).toBe(false)

      const deleteRes = await app.request(`/order-staff-assignments/${created.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(200)

      const afterDelete = await app.request(`/order-staff-assignments/${created.id}`)
      expect(afterDelete.status).toBe(404)
    })
  })

  describe("Order Contact Assignments", () => {
    it("supports CRUD and filtering on /order-contact-assignments", async () => {
      const order = await seedOrder()
      const otherOrder = await seedOrder()
      const orderItem = await seedOrderItem(order.id)

      const createRes = await app.request("/order-contact-assignments", {
        method: "POST",
        ...json({
          orderId: order.id,
          orderItemId: orderItem.id,
          firstName: "Ana",
          lastName: "Contact",
          role: "primary_contact",
          phone: "+40123456789",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.id).toMatch(/^orca_/)
      expect(created.orderId).toBe(order.id)
      expect(created.orderItemId).toBe(orderItem.id)

      await app.request("/order-contact-assignments", {
        method: "POST",
        ...json({
          orderId: otherOrder.id,
          firstName: "Driver",
          lastName: "Two",
          role: "other",
        }),
      })

      const listRes = await app.request(
        `/order-contact-assignments?orderId=${order.id}&role=primary_contact`,
      )
      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.total).toBe(1)
      expect(listBody.data[0].id).toBe(created.id)

      const getRes = await app.request(`/order-contact-assignments/${created.id}`)
      expect(getRes.status).toBe(200)
      expect((await getRes.json()).data.phone).toBe("+40123456789")

      const patchRes = await app.request(`/order-contact-assignments/${created.id}`, {
        method: "PATCH",
        ...json({
          role: "other",
          notes: "Updated order contact assignment",
          isPrimary: false,
        }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.role).toBe("other")
      expect(patched.notes).toBe("Updated order contact assignment")
      expect(patched.isPrimary).toBe(false)

      const deleteRes = await app.request(`/order-contact-assignments/${created.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(200)

      const afterDelete = await app.request(`/order-contact-assignments/${created.id}`)
      expect(afterDelete.status).toBe(404)
    })
  })
}
