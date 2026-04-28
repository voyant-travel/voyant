import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, DollarSign, Loader2, Trash2 } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  getDistributionContractChannelQueryOptions,
  getDistributionContractCommissionRulesQueryOptions,
  getDistributionContractProductsQueryOptions,
  getDistributionContractQueryOptions,
  getDistributionContractSupplierQueryOptions,
} from "./distribution-detail-query-options"

type DistributionContractDetailPageProps = {
  id: string
}

export function DistributionContractDetailPage({ id }: DistributionContractDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: contractData, isPending } = useQuery(getDistributionContractQueryOptions(id))
  const contract = contractData?.data

  const channelQuery = useQuery({
    ...getDistributionContractChannelQueryOptions(contract?.channelId ?? ""),
    enabled: Boolean(contract?.channelId),
  })
  const supplierQuery = useQuery({
    ...getDistributionContractSupplierQueryOptions(contract?.supplierId ?? ""),
    enabled: Boolean(contract?.supplierId),
  })
  const commissionRulesQuery = useQuery(getDistributionContractCommissionRulesQueryOptions(id))
  const productsQuery = useQuery(getDistributionContractProductsQueryOptions())

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/distribution/contracts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["distribution", "contracts"] })
      void navigate({ to: "/distribution" })
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Contract not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          Back to Distribution
        </Button>
      </div>
    )
  }

  const productsById = new Map(
    (productsQuery.data?.data ?? []).map((product) => [product.id, product]),
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/distribution" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Channel Contract</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {contract.status}
            </Badge>
            <Badge variant="secondary">{contract.startsAt}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/distribution/$id", params: { id: contract.channelId } })
            }
          >
            Open Channel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this contract?")) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contract Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Channel:</span>{" "}
              <span>{channelQuery.data?.data.name ?? contract.channelId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Supplier:</span>{" "}
              <span>{supplierQuery.data?.data.name ?? contract.supplierId ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ends At:</span>{" "}
              <span>{contract.endsAt ?? "Open-ended"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Payment Owner:</span>{" "}
              <span>{contract.paymentOwner}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Cancellation Owner:</span>{" "}
              <span>{contract.cancellationOwner}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{new Date(contract.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{" "}
              <span>{new Date(contract.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commercial Notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div>
              <div className="mb-1 text-muted-foreground">Settlement Terms</div>
              <div className="whitespace-pre-wrap">{contract.settlementTerms ?? "-"}</div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground">Notes</div>
              <div className="whitespace-pre-wrap">{contract.notes ?? "-"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <DollarSign className="h-4 w-4" />
          <CardTitle>Commission Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(commissionRulesQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No commission rules on this contract.</p>
          ) : (
            commissionRulesQuery.data?.data.map((rule) => (
              <button
                key={rule.id}
                type="button"
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() =>
                  void navigate({
                    to: "/distribution/commission-rules/$id",
                    params: { id: rule.id },
                  })
                }
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {rule.scope}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {rule.commissionType}
                  </Badge>
                </div>
                <div className="mt-2 text-muted-foreground">
                  Product: {productsById.get(rule.productId ?? "")?.name ?? rule.productId ?? "-"}
                </div>
                <div className="text-muted-foreground">
                  Amount: {rule.amountCents ?? "-"} · Basis Points: {rule.percentBasisPoints ?? "-"}
                </div>
                <div className="text-muted-foreground">
                  Rate: {rule.externalRateId ?? "-"} · Category: {rule.externalCategoryId ?? "-"}
                </div>
                <div className="text-muted-foreground">
                  Valid: {rule.validFrom ?? "-"} to {rule.validTo ?? "-"}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
