import { createFileRoute } from "@tanstack/react-router"
import { getActivitiesQueryOptions } from "@voyantjs/crm-react"
import { ActivitiesPage } from "@voyantjs/crm-ui/components/activities-page"

const routeClient = {
  baseUrl: "",
  fetcher: (url: string, init?: RequestInit) => fetch(url, { credentials: "include", ...init }),
}

export const Route = createFileRoute("/_workspace/activities/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(getActivitiesQueryOptions(routeClient, { limit: 100 })),
  component: ActivitiesPage,
})
