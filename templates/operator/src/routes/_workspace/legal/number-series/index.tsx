import { createFileRoute } from "@tanstack/react-router"
import {
  loadNumberSeriesPage,
  NumberSeriesPage,
} from "@/components/voyant/legal/number-series-page"

export const Route = createFileRoute("/_workspace/legal/number-series/")({
  loader: ({ context }) => loadNumberSeriesPage(context.queryClient),
  component: NumberSeriesPage,
})
