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
import { ArrowLeft, DollarSign, Loader2, Package } from "lucide-react"
import { useDistributionUiI18nOrDefault } from "../i18n/index.js"
import {
  distributionQueryKeys,
  fetchWithValidation,
  getChannelQueryOptions,
  getCommissionRuleQueryOptions,
  getContractQueryOptions,
  getProductQueryOptions,
  successEnvelope,
  useVoyantDistributionContext,
} from "../index.js"
import { formatDistributionDate, formatDistributionDateTime } from "./distribution-shared.js"

export interface CommissionRuleDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onContractOpen?: (contractId: string) => void
  onProductOpen?: (productId: string) => void
}

const noop = () => {}

export function CommissionRuleDetailPage({
  id,
  className,
  onBack = noop,
  onDeleted = noop,
  onContractOpen = noop,
  onProductOpen = noop,
}: CommissionRuleDetailPageProps) {
  const i18n = useDistributionUiI18nOrDefault()
  const { messages } = i18n
  const detail = messages.details.commissionRule
  const client = useVoyantDistributionContext()
  const queryClient = useQueryClient()

  const ruleQuery = useQuery({
    ...getCommissionRuleQueryOptions(client, id),
    select: (result) => result.data,
  })
  const rule = ruleQuery.data

  const contractQuery = useQuery({
    ...getContractQueryOptions(client, rule?.contractId),
    select: (result) => result.data,
    enabled: Boolean(rule?.contractId),
  })
  const contract = contractQuery.data

  const channelQuery = useQuery({
    ...getChannelQueryOptions(client, contract?.channelId),
    select: (result) => result.data,
    enabled: Boolean(contract?.channelId),
  })
  const productQuery = useQuery({
    ...getProductQueryOptions(client, rule?.productId),
    select: (result) => result.data,
    enabled: Boolean(rule?.productId),
  })

  const remove = useMutation({
    mutationFn: () =>
      fetchWithValidation(
        `/v1/admin/distribution/commission-rules/${id}`,
        successEnvelope,
        client,
        {
          method: "DELETE", // i18n-literal-ok HTTP method
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: distributionQueryKeys.commissionRules() })
      queryClient.removeQueries({ queryKey: distributionQueryKeys.commissionRule(id) })
      onDeleted()
      onBack()
    },
  })

  if (ruleQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detail.notFound}</p>
        <Button variant="outline" onClick={onBack}>
          {messages.common.backToDistribution}
        </Button>
      </div>
    )
  }

  return (
    <div data-slot="commission-rule-detail-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{messages.common.commissionScopeLabels[rule.scope]}</Badge>
            <Badge variant="secondary">
              {messages.common.commissionTypeLabels[rule.commissionType]}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onContractOpen(rule.contractId)}>
            <DollarSign className="mr-2 h-4 w-4" />
            {detail.openContract}
          </Button>
          {rule.productId ? (
            <Button variant="outline" onClick={() => onProductOpen(rule.productId!)}>
              <Package className="mr-2 h-4 w-4" />
              {detail.openProduct}
            </Button>
          ) : null}
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

      <Card>
        <CardHeader>
          <CardTitle>{detail.sections.details}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{messages.common.contractLabel}:</span>{" "}
            <span>{contract?.id ?? rule.contractId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.channelLabel}:</span>{" "}
            <span>{channelQuery.data?.name ?? contract?.channelId ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.productLabel}:</span>{" "}
            <span>{productQuery.data?.name ?? rule.productId ?? messages.common.none}</span>
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
              {rule.validFrom ? formatDistributionDate(rule.validFrom, i18n) : messages.common.none}
              {" to "}
              {rule.validTo ? formatDistributionDate(rule.validTo, i18n) : messages.common.none}
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
