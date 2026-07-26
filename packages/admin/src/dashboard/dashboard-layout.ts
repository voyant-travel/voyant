/**
 * Box sizes shared by {@link DashboardPage} and {@link DashboardSkeleton}.
 *
 * The dashboard renders behind a route-loader pending boundary, so the
 * skeleton is swapped for the real page in one paint. Any size the two
 * disagree on becomes a layout shift at that swap — these constants exist so
 * the two files cannot drift apart silently.
 */

/** Revenue trend and booking-status chart bodies. */
export const DASHBOARD_CHART_TALL = "h-[300px]"

/** Monthly bookings chart body. */
export const DASHBOARD_CHART_SHORT = "h-[250px]"

/** Upcoming-departures and outstanding-invoices list bodies. */
export const DASHBOARD_LIST_MIN = "min-h-[276px]"
