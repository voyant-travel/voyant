/**
 * catalog-listability — owned-product storefront listability predicate.
 *
 * Channel assignments are the sole distribution authority for owned products.
 * Product lifecycle status is gated by inventory before this predicate runs.
 */

import { describe, expect, it, vi } from "vitest"
import { isOwnedProductStorefrontListable } from "./catalog-listability.js"

describe("isOwnedProductStorefrontListable", () => {
  it("requires any active mapping for the legacy unchannelled customer slice", async () => {
    const hasActiveChannelMapping = vi.fn(async () => false)

    const listable = await isOwnedProductStorefrontListable({
      audience: "customer",
      hasActiveChannelMapping,
    })

    expect(listable).toBe(false)
    expect(hasActiveChannelMapping).toHaveBeenCalledOnce()

    await expect(
      isOwnedProductStorefrontListable({
        audience: "customer",
        hasActiveChannelMapping: async () => true,
      }),
    ).resolves.toBe(true)
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
