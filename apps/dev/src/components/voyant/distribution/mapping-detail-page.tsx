import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Link2, Loader2, Package, Trash2 } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  getDistributionMappingChannelQueryOptions,
  getDistributionMappingProductQueryOptions,
  getDistributionMappingQueryOptions,
} from "./distribution-detail-query-options"

type DistributionMappingDetailPageProps = {
  id: string
}

export function DistributionMappingDetailPage({ id }: DistributionMappingDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: mappingData, isPending } = useQuery(getDistributionMappingQueryOptions(id))
  const mapping = mappingData?.data

  const channelQuery = useQuery({
    ...getDistributionMappingChannelQueryOptions(mapping?.channelId ?? ""),
    enabled: Boolean(mapping?.channelId),
  })
  const productQuery = useQuery({
    ...getDistributionMappingProductQueryOptions(mapping?.productId ?? ""),
    enabled: Boolean(mapping?.productId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/distribution/product-mappings/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["distribution", "product-mappings"] })
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

  if (!mapping) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Product mapping not found</p>
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
          <h1 className="text-2xl font-bold tracking-tight">Product Mapping</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={mapping.active ? "default" : "secondary"}>
              {mapping.active ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline">{mapping.externalProductId}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/distribution/$id", params: { id: mapping.channelId } })
            }
          >
            <Link2 className="mr-2 h-4 w-4" />
            Open Channel
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/products/$id", params: { id: mapping.productId } })
            }
          >
            <Package className="mr-2 h-4 w-4" />
            Open Product
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this product mapping?")) {
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
          <CardTitle>Mapping Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Channel:</span>{" "}
            <span>{channelQuery.data?.data.name ?? mapping.channelId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Product:</span>{" "}
            <span>{productQuery.data?.data.name ?? mapping.productId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">External Product:</span>{" "}
            <span>{mapping.externalProductId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">External Rate:</span>{" "}
            <span>{mapping.externalRateId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">External Category:</span>{" "}
            <span>{mapping.externalCategoryId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>{" "}
            <span>{new Date(mapping.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Updated:</span>{" "}
            <span>{new Date(mapping.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
