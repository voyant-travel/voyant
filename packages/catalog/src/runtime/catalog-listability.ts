/**
 * Owned-product catalog listability policy for the operator deployment.
 *
 * This is the deployment-owned rule the inventory document builder injects via
 * its `isPublicAudienceListable` hook. It decides whether an owned product
 * (already gated as active upstream) should be emitted
 * into a public-audience search slice.
 *
 * Kept in its own module so the audience decision can be unit-tested without
 * dragging in the whole catalog-plane runtime graph (embeddings, policies,
 * projection extensions).
 */

import type { IndexerSlice } from "@voyant-travel/catalog-contracts/indexer/contract"

export type OwnedProductStorefrontListabilityInput = {
  audience: IndexerSlice["audience"]
  channel?: string
  /** Resolves whether the product is published to an active sales channel. */
  hasActiveChannelMapping: () => boolean | Promise<boolean>
}

/**
 * Storefront/distribution listability predicate for owned products.
 *
 * The upstream inventory gate already requires `status = active` before this
 * runs. Channel assignment is the distribution authority; the deprecated
 * product-level `visibility` and `activated` compatibility fields do not
 * participate in this decision.
 *
 * A channel-scoped slice requires an active mapping for that exact channel, so
 * a website surface and a B2B surface can expose different product sets. A
 * legacy unchannelled customer slice is listable only when the product has at
 * least one active channel mapping. It remains an aggregate compatibility
 * slice, not an implicit site-publication switch.
 *
 * External audiences (partner / supplier slices) also require channel
 * mappings. See docs/architecture/catalog-supply-models.md and
 * federated-operating-mode.md.
 */
export async function isOwnedProductStorefrontListable(
  input: OwnedProductStorefrontListabilityInput,
): Promise<boolean> {
  return input.hasActiveChannelMapping()
}
