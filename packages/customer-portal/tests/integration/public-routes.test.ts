import {
  bookingDocuments,
  bookingFulfillments,
  bookingItems,
  bookingSessionStates,
  bookingStaffAssignments,
  bookings,
  bookingTravelers,
} from "@voyantjs/bookings/schema"
import { crmService, people } from "@voyantjs/crm"
import { authUser, userProfilesTable } from "@voyantjs/db/schema/iam"
import { identityService } from "@voyantjs/identity/service"
import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { invoiceRenditions, invoices, payments } from "../../../finance/src/schema.js"
import { contractAttachments, contracts } from "../../../legal/src/contracts/schema.js"
import { customerPortalRoutes } from "../../src/routes.js"
import { createPublicCustomerPortalRoutes } from "../../src/routes-public.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let bookingSeq = 0
function nextBookingNumber() {
  bookingSeq += 1
  return `BK-PORTAL-${String(bookingSeq).padStart(5, "0")}`
}

describe.skipIf(!DB_AVAILABLE)("Public customer portal routes", () => {
  let app: Hono
  let preflightApp: Hono
  let db: ReturnType<typeof import("@voyantjs/db/test-utils").createTestDb>
  const previousKmsProvider = process.env.KMS_PROVIDER
  const previousKmsLocalKey = process.env.KMS_LOCAL_KEY

  beforeAll(async () => {
    process.env.KMS_PROVIDER = "local"
    process.env.KMS_LOCAL_KEY = Buffer.alloc(32, 7).toString("base64")

    const { createTestDb } = await import("@voyantjs/db/test-utils")

    db = createTestDb()
    app = new Hono()
      .use("*", async (c, next) => {
        c.set("db" as never, db)
        c.set("userId" as never, "user_customer_portal")
        await next()
      })
      .route(
        "/",
        createPublicCustomerPortalRoutes({
          resolveDocumentDownloadUrl: (_bindings, storageKey) =>
            `https://signed.example.com/${storageKey}`,
        }),
      )

    preflightApp = new Hono()
      .use("*", async (c, next) => {
        c.set("db" as never, db)
        await next()
      })
      .route("/", customerPortalRoutes)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
    bookingSeq = 0

    await db.insert(authUser).values({
      id: "user_customer_portal",
      name: "Ana Maria Popescu",
      email: "ana@example.com",
      emailVerified: true,
      image: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })

    await db.insert(userProfilesTable).values({
      id: "user_customer_portal",
      firstName: "Ana",
      lastName: "Popescu",
      locale: "ro",
      timezone: "Europe/Bucharest",
      marketingConsent: true,
      marketingConsentAt: new Date("2026-01-02T00:00:00.000Z"),
      marketingConsentSource: "signup_form",
      notificationDefaults: { email: true },
      uiPrefs: { density: "comfortable" },
    })
  })

  afterAll(async () => {
    process.env.KMS_PROVIDER = previousKmsProvider
    process.env.KMS_LOCAL_KEY = previousKmsLocalKey
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  async function seedLinkedCustomer() {
    const person = await crmService.createPerson(db, {
      firstName: "Ana",
      lastName: "Popescu",
      preferredLanguage: "ro",
      preferredCurrency: "EUR",
      birthday: "1990-04-15",
      relation: "client",
      status: "active",
      source: "auth.user",
      sourceRef: "user_customer_portal",
      email: "ana@example.com",
      phone: "+40123456789",
      address: "Strada Lalelelor 10",
      city: "Bucharest",
      country: "RO",
    })

    if (!person) {
      throw new Error("Expected linked customer record")
    }

    await identityService.createAddress(db, {
      entityType: "person",
      entityId: person.id,
      label: "billing",
      line1: "Strada Lalelelor 10",
      line2: "Ap 5",
      city: "Bucharest",
      region: "Bucuresti",
      postalCode: "010101",
      country: "RO",
      isPrimary: true,
    })

    return person
  }

  it("returns the authenticated customer profile with linked CRM record", async () => {
    const person = await seedLinkedCustomer()

    const res = await app.request("/me")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.email).toBe("ana@example.com")
    expect(body.data.locale).toBe("ro")
    expect(body.data.middleName).toBe("Maria")
    expect(body.data.dateOfBirth).toBe("1990-04-15")
    expect(body.data.address).toEqual({
      country: "RO",
      state: "Bucuresti",
      city: "Bucharest",
      postalCode: "010101",
      addressLine1: "Strada Lalelelor 10",
      addressLine2: "Ap 5",
    })
    // PII slots default to null until the customer fills them in.
    expect(body.data.accessibility).toBeNull()
    expect(body.data.dietary).toBeNull()
    expect(body.data.loyalty).toBeNull()
    expect(body.data.insurance).toBeNull()
    expect(body.data.marketingConsentSource).toBe("signup_form")
    expect(body.data.customerRecord).toMatchObject({
      id: person.id,
      firstName: "Ana",
      preferredCurrency: "EUR",
      phone: "+40123456789",
      billingAddress: {
        label: "billing",
        line1: "Strada Lalelelor 10",
        line2: "Ap 5",
        city: "Bucharest",
        region: "Bucuresti",
        postalCode: "010101",
        country: "RO",
      },
    })
  })

  it("reports contact existence for auth and CRM preflight checks", async () => {
    await seedLinkedCustomer()

    const res = await preflightApp.request("/contact-exists?email=ana@example.com")

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({
      email: "ana@example.com",
      authAccountExists: true,
      customerRecordExists: true,
      linkedCustomerRecordExists: true,
    })
  })

  it("reports phone contact existence for CRM preflight checks", async () => {
    await seedLinkedCustomer()

    const res = await preflightApp.request("/contact-exists/phone?phone=%2B40123456789")

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({
      phone: "+40123456789",
      customerRecordExists: true,
      linkedCustomerRecordExists: true,
    })
  })

  it("bootstraps a new linked customer record when none exists", async () => {
    const res = await app.request("/bootstrap", {
      method: "POST",
      ...json({
        customerRecord: {
          preferredLanguage: "ro",
          preferredCurrency: "EUR",
          phone: "+40123456789",
        },
        marketingConsent: true,
        marketingConsentSource: "booking_checkout",
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe("created_customer")
    expect(body.data.profile.marketingConsentSource).toBe("booking_checkout")
    expect(body.data.profile.customerRecord).toMatchObject({
      firstName: "Ana",
      preferredCurrency: "EUR",
      phone: "+40123456789",
    })
  })

  it("returns selectable customer candidates instead of auto-linking them", async () => {
    await crmService.createPerson(db, {
      firstName: "Ana",
      lastName: "Popescu",
      relation: "client",
      status: "active",
      email: "ana@example.com",
    })

    const res = await app.request("/bootstrap", {
      method: "POST",
      ...json({}),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.data.status).toBe("customer_selection_required")
    expect(body.data.candidates).toHaveLength(1)
    expect(body.data.candidates[0]?.linkable).toBe(true)
  })

  it("links an explicitly selected existing customer record", async () => {
    const existing = await crmService.createPerson(db, {
      firstName: "Ana",
      lastName: "Popescu",
      relation: "client",
      status: "active",
      email: "ana@example.com",
      phone: "+40101010101",
    })

    if (!existing) {
      throw new Error("Expected existing customer record")
    }

    const res = await app.request("/bootstrap", {
      method: "POST",
      ...json({
        customerRecordId: existing.id,
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe("linked_existing_customer")
    expect(body.data.profile.customerRecord.id).toBe(existing.id)
  })

  it("updates profile preferences and synced customer contact details", async () => {
    const person = await seedLinkedCustomer()

    const res = await app.request("/me", {
      method: "PATCH",
      ...json({
        firstName: "Anamaria",
        middleName: "Elena",
        timezone: "Europe/Paris",
        dateOfBirth: "1991-06-20",
        address: {
          country: "FR",
          state: "Ile-de-France",
          city: "Paris",
          postalCode: "75001",
          addressLine1: "Rue de Rivoli 22",
          addressLine2: "Etage 3",
        },
        accessibility: "Wheelchair access",
        dietary: "Gluten-free",
        marketingConsent: false,
        marketingConsentSource: "account_preferences",
        customerRecord: {
          phone: "+40999888777",
          city: "Paris",
          country: "FR",
          billingAddress: {
            line1: "Rue de Rivoli 22",
            line2: "Etage 3",
            region: "Ile-de-France",
            postalCode: "75001",
            country: "FR",
          },
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.firstName).toBe("Anamaria")
    expect(body.data.middleName).toBe("Elena")
    expect(body.data.timezone).toBe("Europe/Paris")
    expect(body.data.dateOfBirth).toBe("1991-06-20")
    expect(body.data.address).toEqual({
      country: "FR",
      state: "Ile-de-France",
      city: "Paris",
      postalCode: "75001",
      addressLine1: "Rue de Rivoli 22",
      addressLine2: "Etage 3",
    })
    expect(body.data.accessibility).toBe("Wheelchair access")
    expect(body.data.dietary).toBe("Gluten-free")
    expect(body.data.marketingConsent).toBe(false)
    expect(body.data.marketingConsentSource).toBeNull()
    expect(body.data.customerRecord.phone).toBe("+40999888777")
    expect(body.data.customerRecord.city).toBe("Paris")
    expect(body.data.customerRecord.billingAddress).toMatchObject({
      line1: "Rue de Rivoli 22",
      line2: "Etage 3",
      city: "Paris",
      region: "Ile-de-France",
      postalCode: "75001",
      country: "FR",
    })

    const updatedPerson = await crmService.getPersonById(db, person.id)
    expect(updatedPerson?.firstName).toBe("Anamaria")
    expect(updatedPerson?.birthday).toBe("1991-06-20")
    expect(updatedPerson?.phone).toBe("+40999888777")
    expect(updatedPerson?.country).toBe("FR")
    const [updatedProfile] = await db
      .select({
        marketingConsent: userProfilesTable.marketingConsent,
        marketingConsentAt: userProfilesTable.marketingConsentAt,
        marketingConsentSource: userProfilesTable.marketingConsentSource,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.id, "user_customer_portal"))
      .limit(1)
    expect(updatedProfile).toMatchObject({
      marketingConsent: false,
      marketingConsentSource: null,
    })
    expect(updatedProfile?.marketingConsentAt).toBeNull()

    const updatedAddresses = await identityService.listAddressesForEntity(db, "person", person.id)
    const updatedBillingAddress = updatedAddresses.find((address) => address.label === "billing")
    expect(updatedBillingAddress).toMatchObject({
      line1: "Rue de Rivoli 22",
      line2: "Etage 3",
      city: "Paris",
      region: "Ile-de-France",
      postalCode: "75001",
      country: "FR",
    })
  })

  it("manages companions under the linked customer record", async () => {
    const person = await seedLinkedCustomer()

    const createRes = await app.request("/companions", {
      method: "POST",
      ...json({
        name: "Mihai Popescu",
        email: "mihai@example.com",
        phone: "+40111111111",
        typeKey: "travel_companion",
        person: {
          firstName: "Mihai",
          middleName: "Andrei",
          lastName: "Popescu",
          dateOfBirth: "1995-07-20",
          addresses: [
            {
              type: "home",
              country: "RO",
              city: "Bucharest",
              addressLine1: "Splaiul 1",
              isDefault: true,
            },
          ],
          documents: [
            {
              type: "passport",
              number: "TR12345",
              country: "RO",
              expiryDate: "2030-07-20",
            },
          ],
        },
      }),
    })

    expect(createRes.status).toBe(201)
    const created = (await createRes.json()).data
    expect(created.name).toBe("Mihai Popescu")
    expect(created.typeKey).toBe("travel_companion")
    expect(created.person).toMatchObject({
      firstName: "Mihai",
      middleName: "Andrei",
      lastName: "Popescu",
      dateOfBirth: "1995-07-20",
      addresses: [expect.objectContaining({ type: "home", city: "Bucharest" })],
      documents: [expect.objectContaining({ type: "passport", number: "TR12345" })],
    })

    const listRes = await app.request("/companions")
    expect(listRes.status).toBe(200)
    expect((await listRes.json()).data).toHaveLength(1)

    const updateRes = await app.request(`/companions/${created.id}`, {
      method: "PATCH",
      ...json({
        phone: "+40222222222",
        isPrimary: true,
      }),
    })

    expect(updateRes.status).toBe(200)
    expect((await updateRes.json()).data.phone).toBe("+40222222222")

    const stored = await identityService.listNamedContactsForEntity(db, "person", person.id)
    expect(stored[0]?.metadata).toMatchObject({ kind: "companion" })

    const deleteRes = await app.request(`/companions/${created.id}`, {
      method: "DELETE",
    })

    expect(deleteRes.status).toBe(200)
    expect(
      (await app.request("/companions").then((response) => response.json())).data,
    ).toHaveLength(0)
  })

  it("imports booking travelers as companions with duplicate detection", async () => {
    const person = await seedLinkedCustomer()

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextBookingNumber(),
        personId: person.id,
        status: "confirmed",
        sellCurrency: "EUR",
      })
      .returning()

    await db.insert(bookingTravelers).values([
      {
        bookingId: booking.id,
        personId: person.id,
        participantType: "traveler",
        firstName: "Ana",
        lastName: "Popescu",
        email: "ana@example.com",
        isPrimary: true,
      },
      {
        bookingId: booking.id,
        participantType: "traveler",
        firstName: "Mihai",
        lastName: "Ionescu",
        email: "mihai@example.com",
        phone: "+40111111111",
      },
    ])
    await db.insert(bookingStaffAssignments).values({
      bookingId: booking.id,
      role: "service_assignee",
      firstName: "Guide",
      lastName: "Local",
    })

    await identityService.createNamedContact(db, {
      entityType: "person",
      entityId: person.id,
      role: "general",
      name: "Ana Popescu",
      email: "ana@example.com",
      phone: null,
      isPrimary: false,
      notes: null,
      title: null,
      metadata: { kind: "companion" },
    })

    const res = await app.request("/companions/import-booking-travelers", {
      method: "POST",
      ...json({ bookingIds: [booking.id] }),
    })

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({
      created: [
        expect.objectContaining({
          name: "Mihai Ionescu",
          email: "mihai@example.com",
          phone: "+40111111111",
          person: expect.objectContaining({
            firstName: "Mihai",
            lastName: "Ionescu",
          }),
          metadata: expect.objectContaining({
            source: "booking_participant_import",
            bookingId: booking.id,
            participantType: "traveler",
          }),
        }),
      ],
      skippedCount: 2,
    })
  })

  it("includes product title and payment status in booking summaries", async () => {
    const person = await seedLinkedCustomer()

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextBookingNumber(),
        personId: person.id,
        status: "confirmed",
        sellCurrency: "EUR",
        sellAmountCents: 24000,
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        pax: 2,
      })
      .returning()

    await db.insert(bookingTravelers).values({
      bookingId: booking.id,
      personId: person.id,
      firstName: "Ana",
      lastName: "Popescu",
      email: "ana@example.com",
      isPrimary: true,
    })

    await db.insert(bookingItems).values([
      {
        bookingId: booking.id,
        title: "Airport transfer",
        itemType: "service",
        sellCurrency: "EUR",
        totalSellAmountCents: 2000,
      },
      {
        bookingId: booking.id,
        title: "Danube package",
        itemType: "unit",
        sellCurrency: "EUR",
        totalSellAmountCents: 22000,
      },
    ])

    await db.insert(invoices).values({
      invoiceNumber: "INV-SUMMARY-1001",
      bookingId: booking.id,
      invoiceType: "proforma",
      status: "partially_paid",
      currency: "EUR",
      issueDate: "2026-05-01",
      dueDate: "2026-05-05",
      subtotalCents: 24000,
      taxCents: 0,
      totalCents: 24000,
      paidCents: 12000,
      balanceDueCents: 12000,
    })

    const res = await app.request("/bookings")

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([
      expect.objectContaining({
        bookingId: booking.id,
        productTitle: "Danube package",
        paymentStatus: "partially_paid",
      }),
    ])
  })

  it("exposes booking billing contact from wizard state with participant fallback", async () => {
    const person = await seedLinkedCustomer()

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextBookingNumber(),
        personId: person.id,
        status: "confirmed",
        sellCurrency: "EUR",
      })
      .returning()

    await db.insert(bookingTravelers).values({
      bookingId: booking.id,
      personId: person.id,
      firstName: "Ana",
      lastName: "Popescu",
      email: "ana@example.com",
      phone: "+40123456789",
      isPrimary: true,
    })

    await db.insert(bookingSessionStates).values({
      bookingId: booking.id,
      stateKey: "wizard",
      currentStep: "billing",
      completedSteps: ["travelers"],
      payload: {
        stepData: {
          billing: {
            billing: {
              firstName: "Anca",
              lastName: "Ionescu",
              email: "anca@example.com",
              phone: "+40999888777",
              country: "FR",
              state: "Ile-de-France",
              city: "Paris",
              addressLine1: "Rue de Rivoli 22",
              postalCode: "75001",
            },
          },
        },
      },
    })

    const billingRes = await app.request(`/bookings/${booking.id}/billing-contact`)
    expect(billingRes.status).toBe(200)
    expect((await billingRes.json()).data).toEqual({
      email: "anca@example.com",
      phone: "+40999888777",
      firstName: "Anca",
      lastName: "Ionescu",
      country: "FR",
      state: "Ile-de-France",
      city: "Paris",
      address1: "Rue de Rivoli 22",
      postal: "75001",
    })
  })

  it("lists and reads only bookings accessible to the authenticated customer", async () => {
    const person = await seedLinkedCustomer()

    const [ownedBooking] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextBookingNumber(),
        personId: person.id,
        status: "confirmed",
        sellCurrency: "EUR",
        sellAmountCents: 24000,
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        pax: 2,
        confirmedAt: new Date("2026-05-01T00:00:00.000Z"),
      })
      .returning()

    const [ownedParticipant] = await db
      .insert(bookingTravelers)
      .values({
        bookingId: ownedBooking.id,
        personId: person.id,
        firstName: "Ana",
        lastName: "Popescu",
        email: "ana@example.com",
        isPrimary: true,
      })
      .returning()

    await db.insert(bookingTravelers).values([
      {
        bookingId: ownedBooking.id,
        firstName: "Billing",
        lastName: "Contact",
        email: "billing@example.com",
        participantType: "contact",
        isPrimary: false,
      },
      {
        bookingId: ownedBooking.id,
        firstName: "Guide",
        lastName: "Local",
        email: "guide@example.com",
        participantType: "staff",
        isPrimary: false,
      },
    ])

    const [ownedItem] = await db
      .insert(bookingItems)
      .values({
        bookingId: ownedBooking.id,
        title: "Danube package",
        sellCurrency: "EUR",
        totalSellAmountCents: 24000,
      })
      .returning()

    await db.insert(bookingDocuments).values({
      bookingId: ownedBooking.id,
      participantId: ownedParticipant.id,
      type: "other",
      fileName: "voucher.pdf",
      fileUrl: "https://example.com/voucher.pdf",
    })

    const [contract] = await db
      .insert(contracts)
      .values({
        scope: "customer",
        status: "issued",
        title: "Travel contract",
        bookingId: ownedBooking.id,
        contractNumber: "CTR-1001",
        language: "ro",
      })
      .returning()

    await db.insert(contractAttachments).values({
      contractId: contract.id,
      kind: "document",
      name: "travel-contract.pdf",
      mimeType: "application/pdf",
      storageKey: `contracts/${contract.id}/travel-contract.pdf`,
    })

    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber: "INV-1001",
        bookingId: ownedBooking.id,
        invoiceType: "proforma",
        status: "partially_paid",
        currency: "EUR",
        issueDate: "2026-05-01",
        dueDate: "2026-05-05",
        subtotalCents: 24000,
        taxCents: 0,
        totalCents: 24000,
        paidCents: 12000,
        balanceDueCents: 12000,
      })
      .returning()

    await db.insert(invoiceRenditions).values({
      invoiceId: invoice.id,
      format: "pdf",
      status: "ready",
      storageKey: `finance/${invoice.id}/proforma-1001.pdf`,
      generatedAt: new Date("2026-05-02T00:00:00.000Z"),
    })

    await db.insert(payments).values({
      invoiceId: invoice.id,
      amountCents: 12000,
      currency: "EUR",
      paymentMethod: "bank_transfer",
      status: "completed",
      referenceNumber: "PAY-1001",
      paymentDate: "2026-05-03",
      notes: "Deposit received",
    })

    await db.insert(bookingFulfillments).values({
      bookingId: ownedBooking.id,
      bookingItemId: ownedItem.id,
      participantId: ownedParticipant.id,
      fulfillmentType: "voucher",
      deliveryChannel: "download",
      status: "issued",
      artifactUrl: "https://example.com/artifact.pdf",
    })

    const [emailBooking] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextBookingNumber(),
        status: "on_hold",
        sellCurrency: "EUR",
        sellAmountCents: 12000,
      })
      .returning()

    await db.insert(bookingTravelers).values({
      bookingId: emailBooking.id,
      firstName: "Ana",
      lastName: "Popescu",
      email: "ana@example.com",
      isPrimary: true,
    })

    const [otherBooking] = await db
      .insert(bookings)
      .values({
        bookingNumber: nextBookingNumber(),
        status: "confirmed",
        sellCurrency: "EUR",
        sellAmountCents: 99999,
      })
      .returning()

    await db.insert(bookingTravelers).values({
      bookingId: otherBooking.id,
      firstName: "Other",
      lastName: "Traveler",
      email: "other@example.com",
      isPrimary: true,
    })

    const listRes = await app.request("/bookings")
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.data).toHaveLength(2)
    expect(listBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingId: ownedBooking.id,
          productTitle: "Danube package",
          paymentStatus: "partially_paid",
        }),
        expect.objectContaining({
          bookingId: emailBooking.id,
          productTitle: null,
          paymentStatus: "unpaid",
        }),
      ]),
    )

    const detailRes = await app.request(`/bookings/${ownedBooking.id}`)
    expect(detailRes.status).toBe(200)
    const detail = (await detailRes.json()).data
    expect(detail.documents).toHaveLength(3)
    expect(detail.financials.documents).toEqual([
      expect.objectContaining({
        invoiceNumber: "INV-1001",
        invoiceType: "proforma",
        totalCents: 24000,
        paidCents: 12000,
        balanceDueCents: 12000,
        documentStatus: "ready",
        url: `https://signed.example.com/finance/${invoice.id}/proforma-1001.pdf`,
      }),
    ])
    expect(detail.financials.payments).toEqual([
      expect.objectContaining({
        invoiceNumber: "INV-1001",
        invoiceType: "proforma",
        amountCents: 12000,
        currency: "EUR",
        paymentMethod: "bank_transfer",
        status: "completed",
        referenceNumber: "PAY-1001",
      }),
    ])
    expect(detail.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "booking_document",
          type: "other",
          fileName: "voucher.pdf",
        }),
        expect.objectContaining({
          source: "legal",
          type: "contract",
          fileName: "travel-contract.pdf",
          fileUrl: `https://signed.example.com/contracts/${contract.id}/travel-contract.pdf`,
          reference: "CTR-1001",
        }),
        expect.objectContaining({
          source: "finance",
          type: "proforma",
          fileUrl: `https://signed.example.com/finance/${invoice.id}/proforma-1001.pdf`,
          reference: "INV-1001",
        }),
      ]),
    )
    expect(detail.fulfillments).toHaveLength(1)
    expect(detail.items[0]?.title).toBe("Danube package")
    expect(detail.travelers).toEqual([
      expect.objectContaining({
        id: ownedParticipant.id,
        participantType: "traveler",
        firstName: "Ana",
        lastName: "Popescu",
      }),
    ])

    const docsRes = await app.request(`/bookings/${ownedBooking.id}/documents`)
    expect(docsRes.status).toBe(200)
    expect((await docsRes.json()).data).toHaveLength(3)

    const forbiddenRes = await app.request(`/bookings/${otherBooking.id}`)
    expect(forbiddenRes.status).toBe(404)
  })

  describe("identity documents (/me/documents)", () => {
    it("auto-creates a linked person on first PII write when none exists", async () => {
      // Sanity: no person row should be linked yet for this auth user.
      const before = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.source, "auth.user"), eq(people.sourceRef, "user_customer_portal")))
      expect(before).toHaveLength(0)

      const res = await app.request("/me", {
        method: "PATCH",
        ...json({ dietary: "Vegan" }),
      })
      expect(res.status).toBe(200)

      const after = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.source, "auth.user"), eq(people.sourceRef, "user_customer_portal")))
      expect(after).toHaveLength(1)

      const meRes = await app.request("/me")
      const me = (await meRes.json()).data
      expect(me.dietary).toBe("Vegan")
    })

    it("creates, lists, updates, and deletes a profile document", async () => {
      await seedLinkedCustomer()

      const createRes = await app.request("/me/documents", {
        method: "POST",
        ...json({
          type: "passport",
          number: "AA111111",
          issuingCountry: "RO",
          expiryDate: "2030-01-01",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.type).toBe("passport")
      expect(created.number).toBe("AA111111")
      expect(created.isPrimary).toBe(true)

      const listRes = await app.request("/me/documents")
      const listBody = (await listRes.json()).data
      expect(listBody).toHaveLength(1)
      expect(listBody[0].number).toBe("AA111111")

      const patchRes = await app.request(`/me/documents/${created.id}`, {
        method: "PATCH",
        ...json({ number: "AA222222", expiryDate: "2031-01-01" }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.number).toBe("AA222222")
      expect(patched.expiryDate).toBe("2031-01-01")

      const deleteRes = await app.request(`/me/documents/${created.id}`, { method: "DELETE" })
      expect(deleteRes.status).toBe(200)
      const afterDelete = await app.request("/me/documents")
      expect((await afterDelete.json()).data).toHaveLength(0)
    })

    it("enforces a single primary document per type (set-primary toggles)", async () => {
      await seedLinkedCustomer()

      const create = (number: string, isPrimary: boolean) =>
        app.request("/me/documents", {
          method: "POST",
          ...json({ type: "passport", number, isPrimary }),
        })

      const first = (await (await create("AA111111", true)).json()).data
      const second = (await (await create("AA222222", false)).json()).data

      const listAfterCreate = (await (await app.request("/me/documents")).json()).data
      expect(listAfterCreate.filter((doc: { isPrimary: boolean }) => doc.isPrimary)).toHaveLength(1)

      const promoteRes = await app.request(`/me/documents/${second.id}/set-primary`, {
        method: "POST",
      })
      expect(promoteRes.status).toBe(200)

      const listAfterPromote = (await (await app.request("/me/documents")).json()).data
      const primaryIds = listAfterPromote
        .filter((doc: { isPrimary: boolean }) => doc.isPrimary)
        .map((doc: { id: string }) => doc.id)
      expect(primaryIds).toEqual([second.id])
      const demoted = listAfterPromote.find((doc: { id: string }) => doc.id === first.id)
      expect(demoted.isPrimary).toBe(false)
    })

    it("scopes deletes to the auth user's linked person", async () => {
      const linked = await seedLinkedCustomer()
      const otherPerson = await crmService.createPerson(db, {
        firstName: "Stranger",
        lastName: "Person",
        tags: [],
        status: "active",
        website: null,
      })
      if (!otherPerson) throw new Error("expected other person")

      const otherDoc = await crmService.createPersonDocument(db, otherPerson.id, {
        type: "passport",
        isPrimary: false,
      })
      if (!otherDoc) throw new Error("expected other document")

      const res = await app.request(`/me/documents/${otherDoc.id}`, { method: "DELETE" })
      expect(res.status).toBe(404)

      // Linked person's docs are unaffected.
      expect(linked.id).toBeTruthy()
      const stillThere = await crmService.getPersonDocument(db, otherDoc.id)
      expect(stillThere?.id).toBe(otherDoc.id)
    })
  })
})
