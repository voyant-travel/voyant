import { getTableName } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"

import { createOwnedBookingHandlerRegistry, type OwnedBookingHandler } from "./owned-handler.js"
import { createSelfServiceBookingSourceProvider } from "./self-service-source.js"

const FUTURE = new Date(Date.now() + 60 * 60 * 1000)
const PAST = new Date(Date.now() - 60 * 1000)

/**
 * Everything a public caller supplies is an identifier, so these assert the
 * verification gates rather than the derivation (which the vertical owns).
 */
describe("self-service booking source provider", () => {
  it("resolves a valid draft and quote into a derived command", async () => {
    const result = await resolve()

    expect(result).toMatchObject({
      status: "ok",
      command: { productId: "prod_1" },
    })
  })

  it.each([
    ["draft is missing", { draft: null }, "draft_not_found"],
    ["draft is already consumed", { draft: { consumed_booking_id: "book_0" } }, "draft_consumed"],
    ["quote is missing", { quote: null }, "quote_not_found"],
    ["quote is already consumed", { quote: { consumed_booking_id: "book_0" } }, "quote_consumed"],
    ["quote has expired", { quote: { expires_at: PAST } }, "quote_expired"],
    ["the hold has lapsed", { draft: { hold_expires_at: PAST } }, "hold_expired"],
    ["the quote is for another entity", { quote: { entity_id: "prod_other" } }, "entity_mismatch"],
    [
      "the quote is not the draft's current one",
      { draft: { current_quote_id: "cquo_other" } },
      "price_changed",
    ],
  ])("refuses when %s", async (_label, patch, reason) => {
    expect(await resolve(patch)).toEqual({ status: "rejected", reason })
  })

  it("refuses a challenge verified for a different contact", async () => {
    const result = await resolve({ caller: { verifiedEmail: "someone-else@example.com" } })

    expect(result).toEqual({ status: "rejected", reason: "contact_mismatch" })
  })

  it("refuses a vertical with no derivation primitive", async () => {
    const result = await resolve({
      handler: {
        entityModule: "products",
        async computeQuote() {
          return { available: true }
        },
      },
    })

    expect(result).toEqual({ status: "rejected", reason: "unsupported_vertical" })
  })

  it("never resolves a billing person for a party the create would reject", async () => {
    const resolveBillingPerson = vi.fn(async () => "per_new")

    // No travelers: the create command would reject this party, so resolving
    // would persist a CRM person that nothing ever references. Must be a guest
    // caller — an authenticated one is already the billing party.
    const result = await resolve({
      caller: { verifiedEmail: "guest@example.com" },
      payload: { travelers: [] },
      resolveBillingPerson,
    })

    expect(result).toEqual({ status: "rejected", reason: "incomplete_draft" })
    expect(resolveBillingPerson).not.toHaveBeenCalled()
  })

  it("resolves a billing person once the whole party would pass", async () => {
    const resolveBillingPerson = vi.fn(async () => "per_new")

    await resolve({ caller: { verifiedEmail: "guest@example.com" }, resolveBillingPerson })

    expect(resolveBillingPerson).toHaveBeenCalledWith(
      expect.objectContaining({ email: "guest@example.com" }),
      expect.objectContaining({ source: "storefront-self-service" }),
    )
  })

  it("consumes the draft and quote together", async () => {
    const updates: string[] = []
    const provider = createSelfServiceBookingSourceProvider({
      ownedHandlers: createOwnedBookingHandlerRegistry(),
    })
    const tx = {
      update: (table: Parameters<typeof getTableName>[0]) => ({
        set: () => ({
          where: async () => {
            updates.push(getTableName(table))
          },
        }),
      }),
    }

    await provider.consumeBookingSource(tx as never, {
      draftId: "bdrf_1",
      quoteId: "cquo_1",
      bookingId: "book_1",
    })

    expect(updates).toHaveLength(2)
  })
})

async function resolve(
  patch: {
    draft?: Record<string, unknown> | null
    quote?: Record<string, unknown> | null
    caller?: Record<string, unknown>
    payload?: Record<string, unknown>
    handler?: Partial<OwnedBookingHandler>
    resolveBillingPerson?: (...args: never[]) => Promise<string | null>
  } = {},
) {
  const ownedHandlers = createOwnedBookingHandlerRegistry()
  // `patch.handler` replaces the handler outright rather than merging, so a
  // test can register one that genuinely lacks `deriveSelfServiceCommand`.
  ownedHandlers.register(
    (patch.handler ?? {
      entityModule: "products",
      async computeQuote() {
        return { available: true }
      },
      async deriveSelfServiceCommand() {
        return { status: "ok", command: { productId: "prod_1" } }
      },
    }) as OwnedBookingHandler,
  )

  const provider = createSelfServiceBookingSourceProvider({
    ownedHandlers,
    ...(patch.resolveBillingPerson
      ? { resolveBillingPerson: patch.resolveBillingPerson as never }
      : {}),
  })

  const draft =
    patch.draft === null
      ? null
      : {
          id: "bdrf_1",
          entity_module: "products",
          entity_id: "prod_1",
          current_quote_id: "cquo_1",
          hold_expires_at: FUTURE,
          consumed_booking_id: null,
          draft_payload: {
            billing: {
              contact: {
                firstName: "Ada",
                lastName: "L",
                email: "guest@example.com",
                phone: null,
              },
            },
            travelers: [{ firstName: "Ada" }],
            ...patch.payload,
          },
          ...patch.draft,
        }

  const quote =
    patch.quote === null
      ? null
      : {
          id: "cquo_1",
          entity_module: "products",
          entity_id: "prod_1",
          expires_at: FUTURE,
          consumed_booking_id: null,
          pricing_base_amount: "100",
          pricing_currency: "EUR",
          ...patch.quote,
        }

  return provider.resolveBookingSource({
    db: selectDb({ booking_drafts: draft, catalog_quotes: quote }),
    draftId: "bdrf_1",
    quoteId: "cquo_1",
    caller: (patch.caller ?? { personId: "per_1" }) as never,
  })
}

/** Returns the row matching whichever table the query selects from. */
function selectDb(rows: Record<string, unknown>) {
  return {
    select: () => ({
      from: (table: Parameters<typeof getTableName>[0]) => ({
        where: () => ({
          limit: async () => {
            const row = rows[getTableName(table)]
            return row ? [row] : []
          },
        }),
      }),
    }),
  } as never
}
