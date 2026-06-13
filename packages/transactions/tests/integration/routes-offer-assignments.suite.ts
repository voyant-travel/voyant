import { describe, expect, it } from "vitest"
import { app, json, seedOffer, seedOfferItem } from "./routes.test-support.js"

export function registerOfferAssignmentSuites() {
  describe("Offer Staff Assignments", () => {
    it("supports CRUD and filtering on /offer-staff-assignments", async () => {
      const offer = await seedOffer()
      const otherOffer = await seedOffer()
      const offerItem = await seedOfferItem(offer.id)

      const createRes = await app.request("/offer-staff-assignments", {
        method: "POST",
        ...json({
          offerId: offer.id,
          offerItemId: offerItem.id,
          firstName: "Guide",
          lastName: "One",
          role: "service_assignee",
          email: "guide.one@example.com",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.id).toMatch(/^ofsa_/)
      expect(created.offerId).toBe(offer.id)
      expect(created.offerItemId).toBe(offerItem.id)

      await app.request("/offer-staff-assignments", {
        method: "POST",
        ...json({
          offerId: otherOffer.id,
          firstName: "Guide",
          lastName: "Two",
          role: "other",
        }),
      })

      const listRes = await app.request(
        `/offer-staff-assignments?offerId=${offer.id}&role=service_assignee`,
      )
      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.total).toBe(1)
      expect(listBody.data[0].id).toBe(created.id)

      const getRes = await app.request(`/offer-staff-assignments/${created.id}`)
      expect(getRes.status).toBe(200)
      expect((await getRes.json()).data.email).toBe("guide.one@example.com")

      const patchRes = await app.request(`/offer-staff-assignments/${created.id}`, {
        method: "PATCH",
        ...json({
          role: "other",
          notes: "Updated guide assignment",
          isPrimary: false,
        }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.role).toBe("other")
      expect(patched.notes).toBe("Updated guide assignment")
      expect(patched.isPrimary).toBe(false)

      const deleteRes = await app.request(`/offer-staff-assignments/${created.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(200)

      const afterDelete = await app.request(`/offer-staff-assignments/${created.id}`)
      expect(afterDelete.status).toBe(404)
    })
  })

  describe("Offer Contact Assignments", () => {
    it("supports CRUD and filtering on /offer-contact-assignments", async () => {
      const offer = await seedOffer()
      const otherOffer = await seedOffer()
      const offerItem = await seedOfferItem(offer.id)

      const createRes = await app.request("/offer-contact-assignments", {
        method: "POST",
        ...json({
          offerId: offer.id,
          offerItemId: offerItem.id,
          firstName: "Mihai",
          lastName: "Booker",
          role: "primary_contact",
          email: "mihai.booker@example.com",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.id).toMatch(/^ofca_/)
      expect(created.offerId).toBe(offer.id)
      expect(created.offerItemId).toBe(offerItem.id)

      await app.request("/offer-contact-assignments", {
        method: "POST",
        ...json({
          offerId: otherOffer.id,
          firstName: "Ana",
          lastName: "Contact",
          role: "other",
        }),
      })

      const listRes = await app.request(
        `/offer-contact-assignments?offerId=${offer.id}&role=primary_contact`,
      )
      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.total).toBe(1)
      expect(listBody.data[0].id).toBe(created.id)

      const getRes = await app.request(`/offer-contact-assignments/${created.id}`)
      expect(getRes.status).toBe(200)
      expect((await getRes.json()).data.email).toBe("mihai.booker@example.com")

      const patchRes = await app.request(`/offer-contact-assignments/${created.id}`, {
        method: "PATCH",
        ...json({
          role: "other",
          notes: "Updated contact assignment",
          isPrimary: false,
        }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.role).toBe("other")
      expect(patched.notes).toBe("Updated contact assignment")
      expect(patched.isPrimary).toBe(false)

      const deleteRes = await app.request(`/offer-contact-assignments/${created.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(200)

      const afterDelete = await app.request(`/offer-contact-assignments/${created.id}`)
      expect(afterDelete.status).toBe(404)
    })
  })
}
