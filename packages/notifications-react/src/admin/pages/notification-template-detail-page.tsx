import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { NotificationTemplateDetailHost } from "../notification-template-detail-host.js"

/**
 * Route page for the `notifications-templates-detail` contribution: binds
 * the matched route's `$id` param onto {@link NotificationTemplateDetailHost}.
 */
export default function NotificationTemplateDetailPage({ params }: AdminRoutePageProps) {
  return <NotificationTemplateDetailHost id={params.id ?? ""} />
}
