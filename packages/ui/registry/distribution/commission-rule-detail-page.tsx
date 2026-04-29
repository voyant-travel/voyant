import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, DollarSign, Loader2, Package, Trash2 } from "lucide-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { api } from "@/lib/api-client"
import { formatDistributionDateTime } from "../../../distribution-ui/src/components/distribution-shared"
import { useDistributionUiI18nOrDefault } from "../../../distribution-ui/src/index"
import {
  getDistributionCommissionRuleChannelQueryOptions,
  getDistributionCommissionRuleContractQueryOptions,
  getDistributionCommissionRuleProductQueryOptions,
  getDistributionCommissionRuleQueryOptions,
} from "./distribution-detail-query-options"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"
import { formatRegistryDistributionDate } from "./i18n/utils"

type DistributionCommissionRuleDetailPageProps = { id: string }

export function DistributionCommissionRuleDetailPage({
  id,
}: DistributionCommissionRuleDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const i18n = useDistributionUiI18nOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const detail = messages.details.commissionRule
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

  if (isPending)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detail.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          {messages.common.backToDistribution}
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
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">
              {i18n.messages.common.commissionScopeLabels[rule.scope]}
            </Badge>
            <Badge variant="secondary">
              {i18n.messages.common.commissionTypeLabels[rule.commissionType]}
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
            {detail.openContract}
          </Button>
          {rule.productId ? (
            <Button
              variant="outline"
              onClick={() =>
                void navigate({ to: "/products/$id", params: { id: rule.productId! } })
              }
            >
              <Package className="mr-2 h-4 w-4" />
              {detail.openProduct}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detail.deleteConfirm)) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {detail.deleteButton}
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{detail.sections.details}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{messages.common.contractLabel}:</span>{" "}
            <span>{contractQuery.data?.data.id ?? rule.contractId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.channelLabel}:</span>{" "}
            <span>
              {channelQuery.data?.data.name ??
                contractQuery.data?.data.channelId ??
                messages.common.none}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.productLabel}:</span>{" "}
            <span>{productQuery.data?.data.name ?? rule.productId ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.amount}:</span>{" "}
            <span>{rule.amountCents ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.basisPoints}:</span>{" "}
            <span>{rule.percentBasisPoints ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.externalRate}:</span>{" "}
            <span>{rule.externalRateId ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.externalCategory}:</span>{" "}
            <span>{rule.externalCategoryId ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.valid}:</span>{" "}
            <span>
              {rule.validFrom
                ? formatRegistryDistributionDate(i18n, rule.validFrom)
                : messages.common.none}{" "}
              to{" "}
              {rule.validTo
                ? formatRegistryDistributionDate(i18n, rule.validTo)
                : messages.common.none}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.createdLabel}:</span>{" "}
            <span>{formatDistributionDateTime(rule.createdAt, i18n)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.updatedLabel}:</span>{" "}
            <span>{formatDistributionDateTime(rule.updatedAt, i18n)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
