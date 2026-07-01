/**
 * Owned-product catalog listability policy for the operator deployment.
 *
 * This is the deployment-owned rule the inventory document builder injects via
 * its `isPublicAudienceListable` hook. It decides whether an owned product
 * (already gated as active + public + activated upstream) should be emitted
 * into a public-audience search slice.
 *
 * Kept in its own module so the audience decision can be unit-tested without
 * dragging in the whole catalog-plane runtime graph (embeddings, policies,
 * projection extensions).
 */

import type { IndexerSlice } from "@voyant-travel/catalog"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { channelProductMappings, channels } from "@voyant-travel/distribution"
import { and, eq } from "drizzle-orm"

/**
 * True when the product has at least one active `channel_product_mappings`
 * row pointing at an active channel — i.e. it is published to a sales channel.
 */
export async function hasActiveSalesChannelMapping(
  db: AnyDrizzleDb,
  productId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: channelProductMappings.id })
    .from(channelProductMappings)
    .innerJoin(channels, eq(channels.id, channelProductMappings.channelId))
    .where(
      and(
        eq(channelProductMappings.productId, productId),
        eq(channelProductMappings.active, true),
        eq(channels.status, "active"),
      ),
    )
    .limit(1)

  return rows.length > 0
}

export type OwnedProductStorefrontListabilityInput = {
  audience: IndexerSlice["audience"]
  /** Resolves whether the product is published to an active sales channel. */
  hasActiveChannelMapping: () => boolean | Promise<boolean>
}

/**
 * Storefront/distribution listability predicate for owned products.
 *
 * The upstream inventory gate (`isPublicStorefrontProduct`) already requires
 * `status = active`, `activated = true`, and `visibility = public` before this
 * runs, so the caller only reaches here for an owned product that is otherwise
 * publicly sellable.
 *
 * The `customer` slice is the operator's *own direct storefront*. Owned
 * inventory that is active + public + activated is inherently sellable there —
 * its public detail, quote, and booking already resolve without any channel
 * mapping — so it MUST be listable in customer search without one. Requiring an
 * explicit `channel_product_mappings` row for the direct storefront made owned
 * products bookable-but-invisible (issue #2617).
 *
 * Channel mappings gate *distribution to external audiences* (partner /
 * supplier slices), not visibility on the operator's own storefront. See
 * docs/architecture/catalog-supply-models.md and federated-operating-mode.md:
 * owned "sellable inventory" is directly bookable/listable; the marketplace /
 * reseller channel graph governs everything downstream of the direct channel.
 */
export async function isOwnedProductStorefrontListable(
  input: OwnedProductStorefrontListabilityInput,
): Promise<boolean> {
  if (input.audience === "customer") return true
  return input.hasActiveChannelMapping()
}
