/**
 * catalog-listability — owned-product storefront listability predicate.
 *
 * Regression cover for issue #2617: an active + public + activated owned
 * product that is directly bookable must be listable in the *customer*
 * (direct storefront) search slice without an explicit channel mapping.
 * Channel mappings only gate distribution to external audiences
 * (partner / supplier).
 */

import { describe, expect, it, vi } from "vitest"

import { isOwnedProductStorefrontListable } from "./catalog-listability"

describe("isOwnedProductStorefrontListable", () => {
  it("lists an owned product in the customer slice without a channel mapping", async () => {
    // The customer audience is the operator's own direct storefront: no channel
    // lookup, always listable (the upstream gate already asserted
    // active + public + activated).
    const hasActiveChannelMapping = vi.fn(async () => false)

    const listable = await isOwnedProductStorefrontListable({
      audience: "customer",
      hasActiveChannelMapping,
    })

    expect(listable).toBe(true)
    expect(hasActiveChannelMapping).not.toHaveBeenCalled()
  })

  it("requires an active channel mapping for external (partner) slices", async () => {
    const withMapping = await isOwnedProductStorefrontListable({
      audience: "partner",
      hasActiveChannelMapping: async () => true,
    })
    const withoutMapping = await isOwnedProductStorefrontListable({
      audience: "partner",
      hasActiveChannelMapping: async () => false,
    })

    expect(withMapping).toBe(true)
    expect(withoutMapping).toBe(false)
  })
})
