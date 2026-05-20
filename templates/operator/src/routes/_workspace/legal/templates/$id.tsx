import { createFileRoute } from "@tanstack/react-router"
import {
  getLegalContractTemplateQueryOptions,
  getLegalContractTemplateVersionsQueryOptions,
} from "@voyantjs/legal-react"
import { TemplateDetailPage } from "@voyantjs/legal-ui"
import { lazy, Suspense } from "react"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Lazy: both dialogs use the RichTextEditor (tiptap + prosemirror).
const TemplateDialog = lazy(() =>
  import("@/components/voyant/legal/template-dialog").then((m) => ({ default: m.TemplateDialog })),
)
const TemplateVersionDialog = lazy(() =>
  import("@/components/voyant/legal/template-version-dialog").then((m) => ({
    default: m.TemplateVersionDialog,
  })),
)

export const Route = createFileRoute("/_workspace/legal/templates/$id")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    await context.queryClient.ensureQueryData(
      getLegalContractTemplateQueryOptions(client, params.id),
    )

    void context.queryClient.prefetchQuery(
      getLegalContractTemplateVersionsQueryOptions(client, { templateId: params.id }),
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <TemplateDetailPage
      id={id}
      onBackToTemplates={() => void navigate({ to: "/legal/templates" })}
      renderTemplateDialog={(props) => (
        <Suspense fallback={null}>
          <TemplateDialog {...props} />
        </Suspense>
      )}
      renderTemplateVersionDialog={(props) => (
        <Suspense fallback={null}>
          <TemplateVersionDialog {...props} />
        </Suspense>
      )}
    />
  )
}
