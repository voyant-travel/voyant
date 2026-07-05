/**
 * catalog-listability — owned-product storefront listability predicate.
 *
 * Regression cover for issue #2617: an active + public + activated owned
 * product that is directly bookable must be listable in the *customer*
 * (direct storefront) search slice without an explicit channel mapping.
 * Channel mappings gate distribution to external audiences and channel-aware
 * customer slices, but not legacy unchannelled customer slices.
 */

import { describe, expect, it, vi } from "vitest"

import { isOwnedProductStorefrontListable } from "./catalog-listability"

describe("isOwnedProductStorefrontListable", () => {
  it("lists an owned product in the customer slice without a channel mapping", async () => {
    // Legacy customer slices carry no channel. They remain listable for
    // backwards compatibility; channel-aware storefront slices below are gated
    // by the requested sales channel.
    const hasActiveChannelMapping = vi.fn(async () => false)

    const listable = await isOwnedProductStorefrontListable({
      audience: "customer",
      hasActiveChannelMapping,
    })

    expect(listable).toBe(true)
    expect(hasActiveChannelMapping).not.toHaveBeenCalled()
  })

  it("requires an active channel mapping for channel-scoped customer slices", async () => {
    const withMapping = await isOwnedProductStorefrontListable({
      audience: "customer",
      channel: "chan_website",
      hasActiveChannelMapping: async () => true,
    })
    const withoutMapping = await isOwnedProductStorefrontListable({
      audience: "customer",
      channel: "chan_b2b",
      hasActiveChannelMapping: async () => false,
    })

    expect(withMapping).toBe(true)
    expect(withoutMapping).toBe(false)
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
