import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getAllPaymentsQueryOptions } from "@voyantjs/finance-react"
import { PaymentsPage, PaymentsPageSkeleton } from "@voyantjs/finance-ui"
import { useSuppliers } from "@voyantjs/suppliers-react"
import { useState } from "react"

import { RecordPaymentDialog } from "@/components/voyant/finance/record-payment-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/finance/payments/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getAllPaymentsQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }),
    ),
  pendingComponent: PaymentsPageSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()
  const [supplierSearch, setSupplierSearch] = useState("")
  const suppliersQuery = useSuppliers({ search: supplierSearch || undefined, limit: 20 })
  const supplierOptions = suppliersQuery.data?.data ?? []

  return (
    <PaymentsPage
      supplierOptions={supplierOptions}
      onSupplierSearchChange={setSupplierSearch}
      onOpenPayment={(id) =>
        void navigate({
          to: "/finance/payments/$id",
          params: { id },
        })
      }
      renderRecordPaymentDialog={(props) => <RecordPaymentDialog {...props} />}
    />
  )
}
