import type { AdminRoutePageProps } from "@voyantjs/admin"

import { TripDetailHost } from "../trip-detail-host.js"

/**
 * Param-taking page for the `trip-composer-detail` contribution: reads the
 * trip envelope id off {@link AdminRoutePageProps} and binds it onto the
 * packaged host. Resolved lazily through the contribution's `page` loader so
 * the detail page (and the composer behind its Edit mode) lands in its own
 * chunk.
 */
export default function TripDetailPage({ params }: AdminRoutePageProps) {
  return <TripDetailHost id={params.id ?? ""} />
}
