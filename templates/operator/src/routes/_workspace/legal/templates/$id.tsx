import { createFileRoute } from "@tanstack/react-router"
import {
  defaultFetcher,
  getLegalContractTemplateQueryOptions,
  getLegalContractTemplateVersionsQueryOptions,
} from "@voyantjs/legal-react"
import { TemplateDetailPage } from "@voyantjs/legal-ui"

import { TemplateDialog } from "@/components/voyant/legal/template-dialog"
import { TemplateVersionDialog } from "@/components/voyant/legal/template-version-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/legal/templates/$id")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getLegalContractTemplateQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          params.id,
        ),
      ),
      context.queryClient.ensureQueryData(
        getLegalContractTemplateVersionsQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          { templateId: params.id },
        ),
      ),
    ]),
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <TemplateDetailPage
      id={id}
      onBackToTemplates={() => void navigate({ to: "/legal/templates" })}
      renderTemplateDialog={(props) => <TemplateDialog {...props} />}
      renderTemplateVersionDialog={(props) => <TemplateVersionDialog {...props} />}
    />
  )
}
