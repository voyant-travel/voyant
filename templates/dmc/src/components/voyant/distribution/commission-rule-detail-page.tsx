import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { useLocale } from "@voyantjs/voyant-admin"
import { ArrowLeft, DollarSign, Loader2, Package, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import {
  getDistributionCommissionRuleChannelQueryOptions,
  getDistributionCommissionRuleContractQueryOptions,
  getDistributionCommissionRuleProductQueryOptions,
  getDistributionCommissionRuleQueryOptions,
} from "./distribution-detail-query-options"
import { formatDistributionDateTime } from "./distribution-shared"

type DistributionCommissionRuleDetailPageProps = {
  id: string
}

export function DistributionCommissionRuleDetailPage({
  id,
}: DistributionCommissionRuleDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const commonMessages = messages.distribution.details.common
  const detailMessages = messages.distribution.details.commission
  const valueMessages = messages.distribution.values
  const noValue = messages.distribution.table.noValue

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
        <p className="text-muted-foreground">{detailMessages.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          {commonMessages.back}
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
          <h1 className="text-2xl font-bold tracking-tight">{detailMessages.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {valueMessages.commissionScope[rule.scope] ?? rule.scope}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {valueMessages.commissionType[rule.commissionType] ?? rule.commissionType}
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
            {commonMessages.openContract}
          </Button>
          {rule.productId ? (
            <Button
              variant="outline"
              onClick={() =>
                void navigate({ to: "/products/$id", params: { id: rule.productId! } })
              }
            >
              <Package className="mr-2 h-4 w-4" />
              {commonMessages.openProduct}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.deleteConfirm)) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {commonMessages.delete}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{detailMessages.detailsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.contract}:</span>{" "}
            <span>{contractQuery.data?.data.id ?? rule.contractId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.channel}:</span>{" "}
            <span>
              {channelQuery.data?.data.name ?? contractQuery.data?.data.channelId ?? noValue}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.product}:</span>{" "}
            <span>{productQuery.data?.data.name ?? rule.productId ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.amount}:</span>{" "}
            <span>{rule.amountCents ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.basisPoints}:</span>{" "}
            <span>{rule.percentBasisPoints ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.externalRate}:</span>{" "}
            <span>{rule.externalRateId ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.externalCategory}:</span>{" "}
            <span>{rule.externalCategoryId ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.valid}:</span>{" "}
            <span>
              {rule.validFrom ?? noValue} to {rule.validTo ?? noValue}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.created}:</span>{" "}
            <span>{formatDistributionDateTime(rule.createdAt, resolvedLocale, noValue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.updated}:</span>{" "}
            <span>{formatDistributionDateTime(rule.updatedAt, resolvedLocale, noValue)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
