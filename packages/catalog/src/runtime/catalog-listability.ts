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

import type { IndexerSlice } from "@voyant-travel/catalog/indexer/contract"

export type OwnedProductStorefrontListabilityInput = {
  audience: IndexerSlice["audience"]
  channel?: string
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
 * Legacy customer slices have no `channel`, so they keep the old direct
 * storefront behavior for backward compatibility. Channel-scoped customer
 * slices require an active mapping for that exact channel, so a website surface
 * and a B2B surface can expose different product sets.
 *
 * External audiences (partner / supplier slices) also require channel
 * mappings. See docs/architecture/catalog-supply-models.md and
 * federated-operating-mode.md.
 */
export async function isOwnedProductStorefrontListable(
  input: OwnedProductStorefrontListabilityInput,
): Promise<boolean> {
  if (input.audience === "customer" && !input.channel) return true
  return input.hasActiveChannelMapping()
}
