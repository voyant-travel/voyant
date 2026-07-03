import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  capturedOptions: { current: undefined as unknown },
  handler: { entityModule: "products" },
  upsertPersonFromContact: vi.fn(),
}))

vi.mock("@voyant-travel/bookings/requirements", () => ({
  bookingRequirementsService: {
    listProductContactRequirements: vi.fn(),
  },
}))

vi.mock("@voyant-travel/commerce", () => ({
  extraPriceRules: {},
  optionPriceRules: {},
  optionUnitPriceRules: {},
  priceCatalogs: {},
  pricingCategories: {},
  pricingCategoryDependencies: {},
  resolveOptionPriceRulesForDate: vi.fn(),
}))

vi.mock("@voyant-travel/finance", () => ({
  createBooking: vi.fn(),
  resolveBookingSellTaxRate: vi.fn(),
}))

vi.mock("@voyant-travel/inventory/booking-engine", () => ({
  createProductsBookingHandler: vi.fn((options: unknown) => {
    mocks.capturedOptions.current = options
    return mocks.handler
  }),
}))

vi.mock("@voyant-travel/inventory/extras", () => ({
  productExtras: {},
}))

vi.mock("@voyant-travel/inventory/schema", () => ({
  optionUnits: {},
  productOptions: {},
}))

vi.mock("@voyant-travel/operations", () => ({
  availabilitySlots: {},
  extendAvailabilityHold: vi.fn(),
  placeAvailabilityHold: vi.fn(),
  releaseAvailabilityHold: vi.fn(),
}))

vi.mock("@voyant-travel/operator-settings", () => ({
  resolveBookingTaxSettings: vi.fn(),
}))

vi.mock("@voyant-travel/relationships", () => ({
  relationshipsService: {
    upsertPersonFromContact: mocks.upsertPersonFromContact,
  },
}))

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  or: vi.fn(),
}))

vi.mock("./booking-engine-db", () => ({
  asPostgresDb: (db: unknown) => db,
}))

vi.mock("./db", () => ({
  withDbFromEnv: (_env: unknown, callback: (db: unknown) => unknown) => callback("db"),
}))

vi.mock("./product-booking-handler-utils", () => ({
  deriveTravelerCategory: vi.fn(),
  humanizeFieldKey: (key: string) => key,
  persistBookingCreateTaxLines: vi.fn(),
  typeForFieldKey: vi.fn(),
}))

import { registerProductBookingHandler } from "./product-booking-handler"

describe("registerProductBookingHandler", () => {
  beforeEach(() => {
    mocks.capturedOptions.current = undefined
    mocks.upsertPersonFromContact.mockReset()
  })

  it("wires anonymous owned-product billing resolution through Relationships", async () => {
    const registry = { register: vi.fn() }

    registerProductBookingHandler(registry as never, {} as never)

    expect(registry.register).toHaveBeenCalledWith(mocks.handler)
    const options = mocks.capturedOptions.current as {
      resolveBillingPerson?: (
        contact: {
          firstName?: string | null
          lastName?: string | null
          email?: string | null
          phone?: string | null
        },
        ctx: { source: string; sourceRef: string },
      ) => Promise<string | null>
    }
    expect(options.resolveBillingPerson).toEqual(expect.any(Function))

    const contact = {
      firstName: "Guest",
      lastName: "Customer",
      email: "guest@example.com",
      phone: "+40700333444",
    }
    mocks.upsertPersonFromContact.mockResolvedValueOnce({ id: "pers_resolved" })

    const result = await options.resolveBillingPerson?.(contact, {
      source: "storefront-booking",
      sourceRef: "BK-TEST-1",
    })

    expect(result).toBe("pers_resolved")
    expect(mocks.upsertPersonFromContact).toHaveBeenCalledWith("db", contact, {
      source: "storefront-booking",
      sourceRef: "BK-TEST-1",
    })
  })
})
