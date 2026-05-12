import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import type { PaymentPolicy } from "@voyantjs/finance"
import { PaymentPolicyForm, PaymentPolicyPreview } from "@voyantjs/finance-ui"
import type {
  Supplier,
  SupplierCustomerPaymentPolicy,
  UpdateSupplierInput,
} from "@voyantjs/suppliers-react"
import { SupplierDetailPage } from "@voyantjs/suppliers-ui"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  getSupplierNotesQueryOptions,
  getSupplierQueryOptions,
  getSupplierServiceRatesQueryOptions,
  getSupplierServicesQueryOptions,
} from "@/components/voyant/suppliers/shared"
import { SupplierDetailSkeleton } from "@/components/voyant/suppliers/supplier-detail-skeleton"

export const Route = createFileRoute("/_workspace/suppliers/$id")({
  loader: async ({ context, params }) => {
    const servicesData = await context.queryClient.ensureQueryData(
      getSupplierServicesQueryOptions(params.id),
    )

    await Promise.all([
      context.queryClient.ensureQueryData(getSupplierQueryOptions(params.id)),
      context.queryClient.ensureQueryData(getSupplierNotesQueryOptions(params.id)),
      ...servicesData.data.map((service) =>
        context.queryClient.ensureQueryData(
          getSupplierServiceRatesQueryOptions(params.id, service.id),
        ),
      ),
    ])
  },
  pendingComponent: SupplierDetailSkeleton,
  component: SupplierDetailRoute,
})

function SupplierDetailRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { resolvedLocale } = useLocale()

  return (
    <SupplierDetailPage
      id={id}
      locale={resolvedLocale}
      onBack={() => void navigate({ to: "/suppliers" })}
      onDeleted={() => void navigate({ to: "/suppliers" })}
      renderCustomerPaymentPolicy={(args) => <SupplierPaymentPolicy {...args} />}
    />
  )
}

function SupplierPaymentPolicy({
  supplier,
  updateSupplier,
  isUpdating,
}: {
  supplier: Supplier
  updateSupplier: (input: UpdateSupplierInput) => Promise<Supplier>
  isUpdating: boolean
}) {
  const persistedPolicy = (supplier.customerPaymentPolicy as PaymentPolicy | null) ?? null
  const [policyDraft, setPolicyDraft] = useState<PaymentPolicy | null>(persistedPolicy)

  useEffect(() => {
    setPolicyDraft(persistedPolicy)
  }, [persistedPolicy])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer payment policy</CardTitle>
        <CardDescription>
          When set, sourced bookings against this supplier inherit these terms instead of the
          operator default. Leave inheriting to fall back to the deployment-wide policy.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {supplier.defaultCurrency ? (
          <>
            <PaymentPolicyForm
              value={policyDraft}
              onChange={setPolicyDraft}
              inheritable={true}
              currency={supplier.defaultCurrency}
              disabled={isUpdating}
            />
            <div className="flex flex-col gap-3">
              <PaymentPolicyPreview policy={policyDraft} currency={supplier.defaultCurrency} />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={isUpdating}
                  onClick={() => {
                    void updateSupplier({
                      customerPaymentPolicy:
                        (policyDraft as SupplierCustomerPaymentPolicy | null) ?? null,
                    })
                      .then(() => toast.success("Customer payment policy saved"))
                      .catch((error: unknown) =>
                        toast.error(
                          error instanceof Error ? error.message : "Failed to save policy",
                        ),
                      )
                  }}
                >
                  {isUpdating ? <Loader2 className="animate-spin" /> : null}
                  Save policy
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground lg:col-span-2">
            Set the supplier's default currency above before defining a payment policy; amounts must
            be denominated in a known currency.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
