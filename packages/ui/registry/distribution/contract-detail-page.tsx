import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, DollarSign, Loader2, Trash2 } from "lucide-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { api } from "@/lib/api-client"
import {
  formatDistributionDateTime,
  getContractStatusLabel,
  getPaymentOwnerLabel,
} from "../../../distribution-ui/src/components/distribution-shared"
import { useDistributionUiI18nOrDefault } from "../../../distribution-ui/src/index"
import {
  getDistributionContractChannelQueryOptions,
  getDistributionContractCommissionRulesQueryOptions,
  getDistributionContractProductsQueryOptions,
  getDistributionContractQueryOptions,
  getDistributionContractSupplierQueryOptions,
} from "./distribution-detail-query-options"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"
import { formatRegistryDistributionDate } from "./i18n/utils"

type DistributionContractDetailPageProps = {
  id: string
}

export function DistributionContractDetailPage({ id }: DistributionContractDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const i18n = useDistributionUiI18nOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const detail = messages.details.contract

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
        <p className="text-muted-foreground">{detail.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          {messages.common.backToDistribution}
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
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">
              {getContractStatusLabel(contract.status, i18n.messages)}
            </Badge>
            <Badge variant="secondary">
              {formatRegistryDistributionDate(i18n, contract.startsAt)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/distribution/$id", params: { id: contract.channelId } })
            }
          >
            {detail.openChannel}
          </Button>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detail.sections.details}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.common.channelLabel}:</span>{" "}
              <span>{channelQuery.data?.data.name ?? contract.channelId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.supplier}:</span>{" "}
              <span>
                {supplierQuery.data?.data.name ?? contract.supplierId ?? messages.common.none}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.endsAt}:</span>{" "}
              <span>
                {contract.endsAt
                  ? formatRegistryDistributionDate(i18n, contract.endsAt)
                  : messages.common.openEnded}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.paymentOwner}:</span>{" "}
              <span>{getPaymentOwnerLabel(contract.paymentOwner, i18n.messages)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.cancellationOwner}:</span>{" "}
              <span>{messages.common.cancellationOwnerLabels[contract.cancellationOwner]}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.common.createdLabel}:</span>{" "}
              <span>{formatDistributionDateTime(contract.createdAt, i18n)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.common.updatedLabel}:</span>{" "}
              <span>{formatDistributionDateTime(contract.updatedAt, i18n)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detail.sections.notes}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div>
              <div className="mb-1 text-muted-foreground">{detail.labels.settlementTerms}</div>
              <div className="whitespace-pre-wrap">
                {contract.settlementTerms ?? messages.common.none}
              </div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground">{detail.labels.notes}</div>
              <div className="whitespace-pre-wrap">{contract.notes ?? messages.common.none}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <DollarSign className="h-4 w-4" />
          <CardTitle>{detail.sections.commissionRules}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(commissionRulesQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detail.empty.commissionRules}</p>
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
                  <Badge variant="outline">
                    {i18n.messages.common.commissionScopeLabels[rule.scope]}
                  </Badge>
                  <Badge variant="secondary">
                    {i18n.messages.common.commissionTypeLabels[rule.commissionType]}
                  </Badge>
                </div>
                <div className="mt-2 text-muted-foreground">
                  {messages.common.productLabel}:{" "}
                  {productsById.get(rule.productId ?? "")?.name ??
                    rule.productId ??
                    messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.amount}: {rule.amountCents ?? messages.common.none}
                  {" · "}
                  {detail.labels.basisPoints}: {rule.percentBasisPoints ?? messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.rate}: {rule.externalRateId ?? messages.common.none}
                  {" · "}
                  {detail.labels.category}: {rule.externalCategoryId ?? messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.valid}:{" "}
                  {rule.validFrom
                    ? formatRegistryDistributionDate(i18n, rule.validFrom)
                    : messages.common.none}
                  {" to "}
                  {rule.validTo
                    ? formatRegistryDistributionDate(i18n, rule.validTo)
                    : messages.common.none}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
