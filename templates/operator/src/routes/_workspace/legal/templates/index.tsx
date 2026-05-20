import { createFileRoute } from "@tanstack/react-router"
import { getLegalContractTemplatesQueryOptions } from "@voyantjs/legal-react"
import { TemplatesPage } from "@voyantjs/legal-ui"
import { lazy, Suspense } from "react"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Lazy-load: the template dialog pulls tiptap + prosemirror (~600 KB raw).
// Keeping it out of the route chunk means the dialog modules + their
// dependencies only download when the user opens the dialog.
const TemplateDialog = lazy(() =>
  import("@/components/voyant/legal/template-dialog").then((m) => ({ default: m.TemplateDialog })),
)

export const Route = createFileRoute("/_workspace/legal/templates/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalContractTemplatesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
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
      renderTemplateDialog={(props) => (
        <Suspense fallback={null}>
          <TemplateDialog {...props} />
        </Suspense>
      )}
    />
  )
}
