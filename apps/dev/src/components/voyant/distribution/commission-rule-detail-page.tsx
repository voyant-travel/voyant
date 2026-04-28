import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, DollarSign, Loader2, Package, Trash2 } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  getDistributionCommissionRuleChannelQueryOptions,
  getDistributionCommissionRuleContractQueryOptions,
  getDistributionCommissionRuleProductQueryOptions,
  getDistributionCommissionRuleQueryOptions,
} from "./distribution-detail-query-options"

type DistributionCommissionRuleDetailPageProps = {
  id: string
}

export function DistributionCommissionRuleDetailPage({
  id,
}: DistributionCommissionRuleDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: ruleData, isPending } = useQuery(getDistributionCommissionRuleQueryOptions(id))
  const rule = ruleData?.data

  const contractQuery = useQuery({
    ...getDistributionCommissionRuleContractQueryOptions(rule?.contractId ?? ""),
    enabled: Boolean(rule?.contractId),
  })
  const channelQuery = useQuery({
    ...getDistributionCommissionRuleChannelQueryOptions(contractQuery.data?.data.channelId ?? ""),
    enabled: Boolean(contractQuery.data?.data.channelId),
  })
  const productQuery = useQuery({
    ...getDistributionCommissionRuleProductQueryOptions(rule?.productId ?? ""),
    enabled: Boolean(rule?.productId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/distribution/commission-rules/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["distribution", "commission-rules"] })
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

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Commission rule not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          Back to Distribution
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/distribution" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Commission Rule</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {rule.scope}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {rule.commissionType}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/distribution/contracts/$id", params: { id: rule.contractId } })
            }
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Open Contract
          </Button>
          {rule.productId ? (
            <Button
              variant="outline"
              onClick={() =>
                void navigate({ to: "/products/$id", params: { id: rule.productId! } })
              }
            >
              <Package className="mr-2 h-4 w-4" />
              Open Product
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this commission rule?")) {
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

      <Card>
        <CardHeader>
          <CardTitle>Rule Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Contract:</span>{" "}
            <span>{contractQuery.data?.data.id ?? rule.contractId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Channel:</span>{" "}
            <span>{channelQuery.data?.data.name ?? contractQuery.data?.data.channelId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Product:</span>{" "}
            <span>{productQuery.data?.data.name ?? rule.productId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Amount:</span>{" "}
            <span>{rule.amountCents ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Basis Points:</span>{" "}
            <span>{rule.percentBasisPoints ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">External Rate:</span>{" "}
            <span>{rule.externalRateId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">External Category:</span>{" "}
            <span>{rule.externalCategoryId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Valid:</span>{" "}
            <span>
              {rule.validFrom ?? "-"} to {rule.validTo ?? "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>{" "}
            <span>{new Date(rule.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Updated:</span>{" "}
            <span>{new Date(rule.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
