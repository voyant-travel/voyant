import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionButton,
} from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ArrowLeft, DollarSign, Loader2 } from "lucide-react"
import { useDistributionUiI18nOrDefault } from "../i18n/index.js"
import {
  distributionQueryKeys,
  fetchWithValidation,
  getChannelQueryOptions,
  getCommissionRulesQueryOptions,
  getContractQueryOptions,
  getProductsQueryOptions,
  getSupplierQueryOptions,
  successEnvelope,
  useVoyantDistributionContext,
} from "../index.js"
import {
  formatDistributionDate,
  formatDistributionDateTime,
  getContractStatusLabel,
  getPaymentOwnerLabel,
} from "./distribution-shared.js"

export interface ContractDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onChannelOpen?: (channelId: string) => void
  onCommissionRuleOpen?: (commissionRuleId: string) => void
}

const noop = () => {}

export function ContractDetailPage({
  id,
  className,
  onBack = noop,
  onDeleted = noop,
  onChannelOpen = noop,
  onCommissionRuleOpen = noop,
}: ContractDetailPageProps) {
  const i18n = useDistributionUiI18nOrDefault()
  const { messages } = i18n
  const detail = messages.details.contract
  const client = useVoyantDistributionContext()
  const queryClient = useQueryClient()

  const contractQuery = useQuery({
    ...getContractQueryOptions(client, id),
    select: (result) => result.data,
  })
  const contract = contractQuery.data

  const channelQuery = useQuery({
    ...getChannelQueryOptions(client, contract?.channelId),
    select: (result) => result.data,
    enabled: Boolean(contract?.channelId),
  })
  const supplierQuery = useQuery({
    ...getSupplierQueryOptions(client, contract?.supplierId),
    select: (result) => result.data,
    enabled: Boolean(contract?.supplierId),
  })
  const commissionRulesQuery = useQuery({
    ...getCommissionRulesQueryOptions(client, { contractId: id }),
    enabled: Boolean(id),
  })
  const productsQuery = useQuery(getProductsQueryOptions(client, { limit: 50, offset: 0 }))

  const remove = useMutation({
    mutationFn: () =>
      fetchWithValidation(`/v1/admin/distribution/contracts/${id}`, successEnvelope, client, {
        method: "DELETE", // i18n-literal-ok HTTP method
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: distributionQueryKeys.contracts() })
      void queryClient.invalidateQueries({ queryKey: distributionQueryKeys.commissionRules() })
      queryClient.removeQueries({ queryKey: distributionQueryKeys.contract(id) })
      onDeleted()
      onBack()
    },
  })

  if (contractQuery.isPending) {
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
        <Button variant="outline" onClick={onBack}>
          {messages.common.backToDistribution}
        </Button>
      </div>
    )
  }

  const productsById = new Map(
    (productsQuery.data?.data ?? []).map((product) => [product.id, product]),
  )

  return (
    <div data-slot="contract-detail-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{getContractStatusLabel(contract.status, messages)}</Badge>
            <Badge variant="secondary">{formatDistributionDate(contract.startsAt, i18n)}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onChannelOpen(contract.channelId)}>
            {detail.openChannel}
          </Button>
          <ConfirmActionButton
            buttonLabel={detail.deleteButton}
            confirmLabel={detail.deleteButton}
            title={detail.deleteConfirm}
            description={detail.deleteDescription}
            variant="destructive"
            confirmVariant="destructive"
            disabled={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync()
            }}
          />
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
              <span>{channelQuery.data?.name ?? contract.channelId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.supplier}:</span>{" "}
              <span>{supplierQuery.data?.name ?? contract.supplierId ?? messages.common.none}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.endsAt}:</span>{" "}
              <span>
                {contract.endsAt
                  ? formatDistributionDate(contract.endsAt, i18n)
                  : messages.common.openEnded}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.paymentOwner}:</span>{" "}
              <span>{getPaymentOwnerLabel(contract.paymentOwner, messages)}</span>
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
                onClick={() => onCommissionRuleOpen(rule.id)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {messages.common.commissionScopeLabels[rule.scope]}
                  </Badge>
                  <Badge variant="secondary">
                    {messages.common.commissionTypeLabels[rule.commissionType]}
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
                  {" - "}
                  {detail.labels.basisPoints}: {rule.percentBasisPoints ?? messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.rate}: {rule.externalRateId ?? messages.common.none}
                  {" - "}
                  {detail.labels.category}: {rule.externalCategoryId ?? messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.valid}:{" "}
                  {rule.validFrom
                    ? formatDistributionDate(rule.validFrom, i18n)
                    : messages.common.none}
                  {" to "}
                  {rule.validTo ? formatDistributionDate(rule.validTo, i18n) : messages.common.none}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
