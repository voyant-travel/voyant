import { describe, expect, it, vi } from "vitest"
import {
  noDepositPolicy,
  type PaymentPolicy,
  resolveEffectivePaymentPolicy,
} from "../../src/payment-policy.js"
import {
  createPaymentPolicyCascade,
  type PaymentPolicyCascadeReaders,
  type PaymentPolicyEntityContext,
  readPolicySourceFromInternalNotes,
  stampPolicySourceOnBooking,
} from "../../src/payment-policy-cascade.js"
import type { PostgresJsDatabase } from "../../src/service-shared.js"

const supplier: PaymentPolicy = {
  deposit: { kind: "percent", percent: 10 },
  minDaysBeforeDepartureForDeposit: 1,
  balanceDueDaysBeforeDeparture: 1,
  balanceDueMinDaysFromNow: 1,
}
const category: PaymentPolicy = {
  deposit: { kind: "percent", percent: 20 },
  minDaysBeforeDepartureForDeposit: 1,
  balanceDueDaysBeforeDeparture: 1,
  balanceDueMinDaysFromNow: 1,
}
const listing: PaymentPolicy = {
  deposit: { kind: "percent", percent: 30 },
  minDaysBeforeDepartureForDeposit: 1,
  balanceDueDaysBeforeDeparture: 1,
  balanceDueMinDaysFromNow: 1,
}

function makeReaders(
  overrides: Partial<PaymentPolicyCascadeReaders> = {},
): PaymentPolicyCascadeReaders {
  return {
    resolveSupplierPolicy: vi.fn(async () => null),
    resolveCategoryPolicy: vi.fn(async () => null),
    resolveListingPolicy: vi.fn(async () => null),
    resolveSupplierPolicyForEntity: vi.fn(async () => null),
    resolveCategoryPolicyForEntity: vi.fn(async () => null),
    resolveListingPolicyForEntity: vi.fn(async () => null),
    ...overrides,
  }
}

const db = {} as PostgresJsDatabase

describe("createPaymentPolicyCascade — booking-level layers feed resolveEffectivePaymentPolicy", () => {
  it("supplier wins over operator default", async () => {
    const cascade = createPaymentPolicyCascade({
      readers: makeReaders({ resolveSupplierPolicy: vi.fn(async () => supplier) }),
    })

    const layers = {
      supplierPolicy: await cascade.resolveSupplierPolicy(db, "bk_1"),
      categoryPolicy: await cascade.resolveCategoryPolicy(db, "bk_1"),
      listingPolicy: await cascade.resolveListingPolicy(db, "bk_1"),
      operatorDefault: noDepositPolicy,
    }

    const resolved = resolveEffectivePaymentPolicy(layers)
    expect(resolved.source).toBe("supplier")
    expect(resolved.policy).toBe(supplier)
  })

  it("category wins over supplier", async () => {
    const cascade = createPaymentPolicyCascade({
      readers: makeReaders({
        resolveSupplierPolicy: vi.fn(async () => supplier),
        resolveCategoryPolicy: vi.fn(async () => category),
      }),
    })

    const resolved = resolveEffectivePaymentPolicy({
      supplierPolicy: await cascade.resolveSupplierPolicy(db, "bk_1"),
      categoryPolicy: await cascade.resolveCategoryPolicy(db, "bk_1"),
      listingPolicy: await cascade.resolveListingPolicy(db, "bk_1"),
      operatorDefault: noDepositPolicy,
    })
    expect(resolved.source).toBe("category")
    expect(resolved.policy).toBe(category)
  })

  it("listing wins over category and supplier", async () => {
    const cascade = createPaymentPolicyCascade({
      readers: makeReaders({
        resolveSupplierPolicy: vi.fn(async () => supplier),
        resolveCategoryPolicy: vi.fn(async () => category),
        resolveListingPolicy: vi.fn(async () => listing),
      }),
    })

    const resolved = resolveEffectivePaymentPolicy({
      supplierPolicy: await cascade.resolveSupplierPolicy(db, "bk_1"),
      categoryPolicy: await cascade.resolveCategoryPolicy(db, "bk_1"),
      listingPolicy: await cascade.resolveListingPolicy(db, "bk_1"),
      operatorDefault: noDepositPolicy,
    })
    expect(resolved.source).toBe("listing")
    expect(resolved.policy).toBe(listing)
  })

  it("falls through to operator default when every reader returns null", async () => {
    const cascade = createPaymentPolicyCascade({ readers: makeReaders() })

    const resolved = resolveEffectivePaymentPolicy({
      supplierPolicy: await cascade.resolveSupplierPolicy(db, "bk_1"),
      categoryPolicy: await cascade.resolveCategoryPolicy(db, "bk_1"),
      listingPolicy: await cascade.resolveListingPolicy(db, "bk_1"),
      operatorDefault: noDepositPolicy,
    })
    expect(resolved.source).toBe("operator_default")
    expect(resolved.policy).toBe(noDepositPolicy)
  })
})

describe("createPaymentPolicyCascade — per-entity (storefront preview) layers", () => {
  it("forwards the entity context to the per-entity readers and resolves the listing layer", async () => {
    const ctx: PaymentPolicyEntityContext = {
      entityModule: "cruises",
      entityId: "crz_1",
      sailingId: "sail_1",
    }
    const readers = makeReaders({
      resolveListingPolicyForEntity: vi.fn(async () => listing),
    })
    const cascade = createPaymentPolicyCascade({ readers })

    const resolved = resolveEffectivePaymentPolicy({
      supplierPolicy: await cascade.resolveSupplierPolicyForEntity(db, ctx),
      categoryPolicy: await cascade.resolveCategoryPolicyForEntity(db, ctx),
      listingPolicy: await cascade.resolveListingPolicyForEntity(db, ctx),
      operatorDefault: noDepositPolicy,
    })

    expect(resolved.source).toBe("listing")
    expect(resolved.policy).toBe(listing)
    expect(readers.resolveListingPolicyForEntity).toHaveBeenCalledWith(db, ctx)
    expect(readers.resolveSupplierPolicyForEntity).toHaveBeenCalledWith(db, ctx)
    expect(readers.resolveCategoryPolicyForEntity).toHaveBeenCalledWith(db, ctx)
  })
})

describe("stampPolicySourceOnBooking", () => {
  /**
   * Minimal drizzle stub for the stamp path:
   * `.select().from().where().limit()` resolves to the configured booking row,
   * and `.update().set().where()` is a thenable terminator that records the set
   * payload so we can assert the rewritten internalNotes.
   */
  function stubDb(internalNotes: string | null) {
    let updatePayload: { internalNotes?: string } | null = null
    const selectChain = {
      from: () => selectChain,
      where: () => selectChain,
      limit: () => Promise.resolve([{ internalNotes }]),
    }
    const whereThenable = {
      // biome-ignore lint/suspicious/noThenProperty: test stub mimics a thenable drizzle query builder -- owner: finance.
      then: (resolve: (v: unknown) => void) => resolve(undefined),
    }
    const updateChain = {
      set: (payload: { internalNotes?: string }) => {
        updatePayload = payload
        return { where: () => whereThenable }
      },
    }
    const db = {
      select: () => selectChain,
      update: () => updateChain,
    } as unknown as PostgresJsDatabase
    return { db, getUpdate: () => updatePayload }
  }

  it("appends a fresh marker when none exists", async () => {
    const { db, getUpdate } = stubDb("customer note")
    await stampPolicySourceOnBooking(db, "bk_1", "supplier")
    expect(getUpdate()?.internalNotes).toBe("customer note\n__payment_policy_source__:supplier")
  })

  it("replaces an existing marker (idempotent across re-confirmations)", async () => {
    const { db, getUpdate } = stubDb("note\n__payment_policy_source__:category")
    await stampPolicySourceOnBooking(db, "bk_1", "listing")
    expect(getUpdate()?.internalNotes).toBe("note\n__payment_policy_source__:listing")
  })
})

describe("readPolicySourceFromInternalNotes", () => {
  it("returns the stamped payment policy source", () => {
    expect(
      readPolicySourceFromInternalNotes(
        ["customer note", "__payment_policy_source__:supplier", "other note"].join("\n"),
      ),
    ).toBe("supplier")
  })

  it("ignores unknown or missing policy source markers", () => {
    expect(readPolicySourceFromInternalNotes("__payment_policy_source__:legacy")).toBeNull()
    expect(readPolicySourceFromInternalNotes("customer note")).toBeNull()
    expect(readPolicySourceFromInternalNotes(null)).toBeNull()
  })
})
