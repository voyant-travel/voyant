import { createFileRoute } from "@tanstack/react-router"
import { loadPoliciesPage, PoliciesPage } from "@/components/voyant/legal/policies-page"

export const Route = createFileRoute("/_workspace/legal/policies/")({
  loader: ({ context }) => loadPoliciesPage(context.queryClient),
  component: PoliciesPage,
})
