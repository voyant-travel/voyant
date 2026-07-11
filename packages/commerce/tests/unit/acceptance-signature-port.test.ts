import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import {
  type AcceptanceSignatureLegalPort,
  persistAcceptanceSignature,
} from "../../src/checkout/acceptance-signature.js"

describe("acceptance-signature Legal port", () => {
  it("keeps signature promotion idempotent when Legal already has a signature", async () => {
    const booking = {
      id: "booking_1",
      bookingNumber: "BK-1",
      contactFirstName: "Ada",
      contactLastName: "Lovelace",
      contactEmail: "ada@example.com",
      internalNotes: null,
    }
    const limit = vi.fn(async () => [booking])
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit }) }),
      }),
    } as unknown as PostgresJsDatabase
    const legal: AcceptanceSignatureLegalPort = {
      getContract: vi.fn(async () => ({
        id: "contract_1",
        bookingId: "booking_1",
        metadata: {
          acceptance: {
            templateId: "template_1",
            templateSlug: "terms",
            acceptedAt: "2026-07-11T12:00:00.000Z",
            acceptedMarketing: false,
            renderedHtmlLength: 1200,
          },
        },
        status: "issued",
      })),
      listSignatures: vi.fn(async () => [{ id: "signature_1" }]),
      sendContract: vi.fn(),
      signContract: vi.fn(),
    }

    await persistAcceptanceSignature(db, "contract_1", undefined, legal)

    expect(legal.getContract).toHaveBeenCalledWith(db, "contract_1")
    expect(legal.listSignatures).toHaveBeenCalledWith(db, "contract_1")
    expect(legal.sendContract).not.toHaveBeenCalled()
    expect(legal.signContract).not.toHaveBeenCalled()
  })
})
