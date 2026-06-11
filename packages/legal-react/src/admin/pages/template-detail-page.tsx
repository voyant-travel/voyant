import type { AdminRoutePageProps } from "@voyantjs/admin"

import { TemplateDetailHost } from "../template-detail-host.js"

/**
 * Route page for the `legal-templates-detail` contribution: binds the
 * matched route's `$id` param onto {@link TemplateDetailHost}.
 */
export default function TemplateDetailPage({ params }: AdminRoutePageProps) {
  return <TemplateDetailHost id={params.id ?? ""} />
}
