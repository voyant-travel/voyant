import { eq } from "drizzle-orm"
import { expect, it } from "vitest"

import {
  offerContactAssignments,
  offerParticipants,
  offerStaffAssignments,
} from "../../src/schema.js"
import { app, db, json, nextRef, nextSeq, seedOffer, seedOrder } from "./routes.test-support.js"

export function registerOfferBundleSuites() {
  it("rejects staff and contact-only roles on traveler routes", async () => {
    const offer = await seedOffer()

    const staffRes = await app.request("/offer-travelers", {
      method: "POST",
      ...json({
        offerId: offer.id,
        firstName: "Guide",
        lastName: "Local",
        participantType: "staff",
      }),
    })

    expect(staffRes.status).toBe(400)
    expect((await staffRes.json()).error).toContain("staff")

    const contactRes = await app.request("/offer-travelers", {
      method: "POST",
      ...json({
        offerId: offer.id,
        firstName: "Mihai",
        lastName: "Booker",
        participantType: "booker",
      }),
    })

    expect(contactRes.status).toBe(400)
    expect((await contactRes.json()).error).toContain("Invalid option")

    const order = await seedOrder()
    const orderContactRes = await app.request("/order-travelers", {
      method: "POST",
      ...json({
        orderId: order.id,
        firstName: "Ana",
        lastName: "Contact",
        participantType: "contact",
      }),
    })

    expect(orderContactRes.status).toBe(400)
    expect((await orderContactRes.json()).error).toContain("Invalid option")
  })

  it("stores staff separately when creating offer bundles", async () => {
    const { transactionsService } = await import("../../src/service.js")

    const created = await transactionsService.createOfferBundle(db, {
      offer: {
        offerNumber: nextRef("OFF", nextSeq()),
        title: "Guided offer",
        currency: "USD",
      },
      travelers: [
        {
          firstName: "Ana",
          lastName: "Traveler",
          participantType: "traveler",
          isPrimary: true,
        },
        {
          firstName: "Guide",
          lastName: "Local",
          participantType: "staff",
          isPrimary: false,
        },
      ],
      items: [
        {
          title: "Tour entry",
          sellCurrency: "USD",
        },
      ],
      itemTravelers: [
        { itemIndex: 0, participantIndex: 0, role: "traveler", isPrimary: true },
        { itemIndex: 0, participantIndex: 1, role: "service_assignee", isPrimary: false },
      ],
    })

    expect(created?.travelers).toHaveLength(1)

    const travelerRows = await db
      .select()
      .from(offerParticipants)
      .where(eq(offerParticipants.offerId, created!.offer.id))
    expect(travelerRows).toHaveLength(1)
    expect(travelerRows[0]?.participantType).toBe("traveler")

    const staffRows = await db
      .select()
      .from(offerStaffAssignments)
      .where(eq(offerStaffAssignments.offerId, created!.offer.id))
    expect(staffRows).toHaveLength(1)
    expect(staffRows[0]).toMatchObject({
      firstName: "Guide",
      lastName: "Local",
      role: "service_assignee",
    })
    expect(staffRows[0]?.offerItemId).toBeTruthy()
  })

  it("derives offer contact snapshots from primary contact assignments", async () => {
    const { transactionsService } = await import("../../src/service.js")

    const created = await transactionsService.createOfferBundle(db, {
      offer: {
        offerNumber: nextRef("OFF", nextSeq()),
        title: "Contacted offer",
        currency: "USD",
      },
      travelers: [
        {
          firstName: "Ana",
          lastName: "Traveler",
          participantType: "traveler",
          isPrimary: true,
        },
      ],
      contactAssignments: [
        {
          firstName: "Bianca",
          lastName: "Booker",
          role: "primary_contact",
          email: "bianca.booker@example.com",
          phone: "+40111111222",
          preferredLanguage: "ro",
          isPrimary: true,
        },
      ],
      items: [
        {
          title: "Tour entry",
          sellCurrency: "USD",
        },
      ],
      itemTravelers: [{ itemIndex: 0, participantIndex: 0, role: "traveler", isPrimary: true }],
    })

    expect(created?.offer.contactFirstName).toBe("Bianca")
    expect(created?.offer.contactLastName).toBe("Booker")
    expect(created?.offer.contactEmail).toBe("bianca.booker@example.com")
    expect(created?.offer.contactPhone).toBe("+40111111222")
    expect(created?.offer.contactPreferredLanguage).toBe("ro")

    const travelerRows = await db
      .select()
      .from(offerParticipants)
      .where(eq(offerParticipants.offerId, created!.offer.id))
    expect(travelerRows).toHaveLength(1)

    const contactRows = await db
      .select()
      .from(offerContactAssignments)
      .where(eq(offerContactAssignments.offerId, created!.offer.id))
    expect(contactRows).toHaveLength(1)
    expect(contactRows[0]).toMatchObject({
      firstName: "Bianca",
      lastName: "Booker",
      role: "primary_contact",
    })
    expect(contactRows[0]?.offerItemId).toBeNull()
  })

  it("stores explicit offer billing party snapshots", async () => {
    const { transactionsService } = await import("../../src/service.js")

    const created = await transactionsService.createOfferBundle(db, {
      offer: {
        offerNumber: nextRef("OFF", nextSeq()),
        title: "Company offer",
        currency: "EUR",
        organizationId: "org_123",
        contactPartyType: "company",
        contactFirstName: "Acme SRL",
        contactLastName: null,
        contactTaxId: "RO123456",
      },
      travelers: [
        {
          firstName: "Ana",
          lastName: "Traveler",
          participantType: "traveler",
          isPrimary: true,
        },
      ],
      items: [
        {
          title: "Tour entry",
          sellCurrency: "EUR",
        },
      ],
    })

    expect(created?.offer.contactPartyType).toBe("company")
    expect(created?.offer.contactFirstName).toBe("Acme SRL")
    expect(created?.offer.contactLastName).toBeNull()
    expect(created?.offer.contactTaxId).toBe("RO123456")
  })
}
