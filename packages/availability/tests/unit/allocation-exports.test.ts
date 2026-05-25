import { describe, expect, it } from "vitest"
import type { SlotAllocationManifest } from "../../src/service-allocation.js"
import {
  buildAllocationPassengersCsv,
  buildAllocationRoomingCsv,
} from "../../src/service-allocation-exports.js"

function manifest(): SlotAllocationManifest {
  return {
    slot: {
      id: "avsl_123",
      productId: "prod_abcdef",
      startsAt: "2026-05-12T10:00:00.000Z",
      endsAt: null,
    },
    bookings: [
      {
        id: "book_1",
        bookingNumber: "B-001",
        status: "confirmed",
        contactFirstName: "Ana",
        contactLastName: "Pop",
        contactEmail: "ana@example.com",
        contactPhone: "+40",
        sellCurrency: "EUR",
        pax: 2,
        travelers: [
          {
            id: "trav_1",
            bookingId: "book_1",
            bookingNumber: "B-001",
            bookingStatus: "confirmed",
            firstName: "Ana",
            lastName: "Pop",
            fullName: "Ana Pop",
            email: "ana@example.com",
            phone: "+40",
            isLeadTraveler: true,
            isPrimary: true,
            sharingGroupId: "sg_1",
            roomTypeId: null,
            bedPreference: null,
            allocations: { room: "room_1" },
            travelerCategory: null,
            participantType: "adult",
            hasAccessibilityNeeds: false,
            hasDietaryRequirements: true,
          },
          {
            id: "trav_2",
            bookingId: "book_1",
            bookingNumber: "B-001",
            bookingStatus: "confirmed",
            firstName: "Bo",
            lastName: "Pop",
            fullName: "Bo Pop",
            email: null,
            phone: null,
            isLeadTraveler: false,
            isPrimary: false,
            sharingGroupId: null,
            roomTypeId: null,
            bedPreference: null,
            allocations: {},
            travelerCategory: "child",
            participantType: "child",
            hasAccessibilityNeeds: false,
            hasDietaryRequirements: false,
          },
        ],
      },
    ],
    resources: [
      {
        id: "room_1",
        slotId: "avsl_123",
        kind: "room",
        refType: null,
        refId: null,
        label: "Room 1",
        capacity: 2,
        flags: {},
        parentId: null,
        sortOrder: 1,
        createdAt: new Date("2026-05-12T09:00:00.000Z"),
        updatedAt: new Date("2026-05-12T09:00:00.000Z"),
      },
    ],
    sharingGroupLabels: {
      sg_1: "Friends",
    },
    summary: {
      bookingCount: 1,
      travelerCount: 2,
      leadTravelerCount: 1,
      bookingsByStatus: { confirmed: 1 },
    },
  }
}

describe("allocation CSV exports", () => {
  it("builds a passenger manifest with sharing group labels and flags", () => {
    const csv = buildAllocationPassengersCsv(manifest())

    expect(csv).toContain("Booking,Booking status,Traveler")
    expect(csv).toContain(
      "B-001,confirmed,Ana Pop,yes,yes,ana@example.com,+40,adult,,Friends,no,yes",
    )
    expect(csv).toContain("B-001,confirmed,Bo Pop,no,no,,,child,child,,no,no")
  })

  it("builds a rooming list with unallocated travelers and totals", () => {
    const csv = buildAllocationRoomingCsv(manifest())

    expect(csv).toContain("Room 1,2,Ana Pop,1")
    expect(csv).toContain("Unallocated,,Bo Pop,1")
    expect(csv).toContain("Total,,,2")
  })

  it("omits expired bookings from the rooming list", () => {
    const data = manifest()
    data.bookings[0]!.status = "expired"
    const csv = buildAllocationRoomingCsv(data)

    expect(csv).not.toContain("Ana Pop")
    expect(csv).not.toContain("Bo Pop")
    expect(csv).toContain("Total,,,0")
  })

  it("omits draft bookings from the rooming list", () => {
    const data = manifest()
    data.bookings[0]!.status = "draft"
    const csv = buildAllocationRoomingCsv(data)

    expect(csv).not.toContain("Ana Pop")
    expect(csv).not.toContain("Bo Pop")
    expect(csv).toContain("Total,,,0")
  })
})
