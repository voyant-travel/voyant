import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getLegalContractTemplatesQueryOptions } from "@voyantjs/legal-react"
import { TemplatesPage } from "@voyantjs/legal-ui"

import { TemplateDialog } from "@/components/voyant/legal/template-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/legal/templates/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalContractTemplatesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        { search: "", scope: "all" },
      ),
    ),
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

  return (
    <TemplatesPage
      onOpenTemplate={(id) =>
        void navigate({
          to: "/legal/templates/$id",
          params: { id },
        })
      }
      renderTemplateDialog={(props) => <TemplateDialog {...props} />}
    />
  )
}
