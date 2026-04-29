import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, DollarSign, Loader2, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import {
  getDistributionContractChannelQueryOptions,
  getDistributionContractCommissionRulesQueryOptions,
  getDistributionContractProductsQueryOptions,
  getDistributionContractQueryOptions,
  getDistributionContractSupplierQueryOptions,
} from "./distribution-detail-query-options"
import { formatDistributionDateTime } from "./distribution-shared"

type DistributionContractDetailPageProps = {
  id: string
}

export function DistributionContractDetailPage({ id }: DistributionContractDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const commonMessages = messages.distribution.details.common
  const detailMessages = messages.distribution.details.contract
  const valueMessages = messages.distribution.values
  const noValue = messages.distribution.table.noValue

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
        <p className="text-muted-foreground">{detailMessages.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          {commonMessages.back}
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
          <h1 className="text-2xl font-bold tracking-tight">{detailMessages.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {valueMessages.contractStatus[contract.status] ?? contract.status}
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
            {commonMessages.openChannel}
          </Button>
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.channel}:</span>{" "}
              <span>{channelQuery.data?.data.name ?? contract.channelId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.supplier}:</span>{" "}
              <span>{supplierQuery.data?.data.name ?? contract.supplierId ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.endsAt}:</span>{" "}
              <span>{contract.endsAt ?? detailMessages.openEnded}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.paymentOwner}:</span>{" "}
              <span>
                {valueMessages.paymentOwner[contract.paymentOwner] ?? contract.paymentOwner}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {detailMessages.fields.cancellationOwner}:
              </span>{" "}
              <span>
                {valueMessages.cancellationOwner[contract.cancellationOwner] ??
                  contract.cancellationOwner}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.created}:</span>{" "}
              <span>{formatDistributionDateTime(contract.createdAt, resolvedLocale, noValue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.updated}:</span>{" "}
              <span>{formatDistributionDateTime(contract.updatedAt, resolvedLocale, noValue)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.notesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div>
              <div className="mb-1 text-muted-foreground">
                {detailMessages.fields.settlementTerms}
              </div>
              <div className="whitespace-pre-wrap">{contract.settlementTerms ?? noValue}</div>
            </div>
            <div>
              <div className="mb-1 text-muted-foreground">{detailMessages.fields.notes}</div>
              <div className="whitespace-pre-wrap">{contract.notes ?? noValue}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <DollarSign className="h-4 w-4" />
          <CardTitle>{detailMessages.commissionRulesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(commissionRulesQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.noCommissionRules}</p>
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
                    {valueMessages.commissionScope[rule.scope] ?? rule.scope}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {valueMessages.commissionType[rule.commissionType] ?? rule.commissionType}
                  </Badge>
                </div>
                <div className="mt-2 text-muted-foreground">
                  {detailMessages.fields.product}:{" "}
                  {productsById.get(rule.productId ?? "")?.name ?? rule.productId ?? noValue}
                </div>
                <div className="text-muted-foreground">
                  {detailMessages.fields.amount}: {rule.amountCents ?? noValue} ·{" "}
                  {detailMessages.fields.basisPoints}: {rule.percentBasisPoints ?? noValue}
                </div>
                <div className="text-muted-foreground">
                  {detailMessages.fields.rate}: {rule.externalRateId ?? noValue} ·{" "}
                  {detailMessages.fields.category}: {rule.externalCategoryId ?? noValue}
                </div>
                <div className="text-muted-foreground">
                  {detailMessages.fields.valid}: {rule.validFrom ?? noValue} to{" "}
                  {rule.validTo ?? noValue}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
