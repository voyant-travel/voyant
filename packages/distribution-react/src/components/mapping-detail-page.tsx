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
import { ArrowLeft, Link2, Loader2, Package } from "lucide-react"
import { useDistributionUiI18nOrDefault } from "../i18n/index.js"
import {
  distributionQueryKeys,
  fetchWithValidation,
  getChannelQueryOptions,
  getMappingQueryOptions,
  getProductQueryOptions,
  successEnvelope,
  useVoyantDistributionContext,
} from "../index.js"
import { formatDistributionDateTime } from "./distribution-shared.js"

export interface MappingDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onChannelOpen?: (channelId: string) => void
  onProductOpen?: (productId: string) => void
}

const noop = () => {}

export function MappingDetailPage({
  id,
  className,
  onBack = noop,
  onDeleted = noop,
  onChannelOpen = noop,
  onProductOpen = noop,
}: MappingDetailPageProps) {
  const i18n = useDistributionUiI18nOrDefault()
  const { messages } = i18n
  const detail = messages.details.mapping
  const client = useVoyantDistributionContext()
  const queryClient = useQueryClient()

  const mappingQuery = useQuery({
    ...getMappingQueryOptions(client, id),
    select: (result) => result.data,
  })
  const mapping = mappingQuery.data

  const channelQuery = useQuery({
    ...getChannelQueryOptions(client, mapping?.channelId),
    select: (result) => result.data,
    enabled: Boolean(mapping?.channelId),
  })
  const productQuery = useQuery({
    ...getProductQueryOptions(client, mapping?.productId),
    select: (result) => result.data,
    enabled: Boolean(mapping?.productId),
  })

  const remove = useMutation({
    mutationFn: () =>
      fetchWithValidation(
        `/v1/admin/distribution/product-mappings/${id}`,
        successEnvelope,
        client,
        {
          method: "DELETE", // i18n-literal-ok HTTP method
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: distributionQueryKeys.mappings() })
      queryClient.removeQueries({ queryKey: distributionQueryKeys.mapping(id) })
      onDeleted()
      onBack()
    },
  })

  if (mappingQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!mapping) {
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
    <div data-slot="mapping-detail-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={mapping.active ? "default" : "secondary"}>
              {mapping.active ? messages.common.active : messages.common.inactive}
            </Badge>
            <Badge variant="outline">{mapping.externalProductId}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onChannelOpen(mapping.channelId)}>
            <Link2 className="mr-2 h-4 w-4" />
            {detail.openChannel}
          </Button>
          <Button variant="outline" onClick={() => onProductOpen(mapping.productId)}>
            <Package className="mr-2 h-4 w-4" />
            {detail.openProduct}
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

      <Card>
        <CardHeader>
          <CardTitle>{detail.sections.details}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{messages.common.channelLabel}:</span>{" "}
            <span>{channelQuery.data?.name ?? mapping.channelId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.productLabel}:</span>{" "}
            <span>{productQuery.data?.name ?? mapping.productId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.externalProduct}:</span>{" "}
            <span>{mapping.externalProductId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.externalRate}:</span>{" "}
            <span>{mapping.externalRateId ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.externalCategory}:</span>{" "}
            <span>{mapping.externalCategoryId ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.createdLabel}:</span>{" "}
            <span>{formatDistributionDateTime(mapping.createdAt, i18n)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.updatedLabel}:</span>{" "}
            <span>{formatDistributionDateTime(mapping.updatedAt, i18n)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
