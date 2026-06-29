import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { NotificationReminderRuleDetailHost } from "../notification-reminder-rule-detail-host.js"

/**
 * Route page for the `notifications-reminder-rules-detail` contribution:
 * binds the matched route's `$id` param onto
 * {@link NotificationReminderRuleDetailHost}.
 */
// fallow-ignore-next-line unused-export
export default function NotificationReminderRuleDetailPage({ params }: AdminRoutePageProps) {
  return <NotificationReminderRuleDetailHost id={params.id ?? ""} />
}
