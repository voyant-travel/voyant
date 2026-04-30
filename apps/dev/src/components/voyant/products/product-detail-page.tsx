import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { productsQueryKeys, useProduct } from "@voyantjs/products-react"
import { ProductMediaSection } from "@voyantjs/products-ui/components/product-media-section"
import { ProductOptionsSection as OptionsSection } from "@voyantjs/products-ui/components/product-options-section"
import { ProductVersionsSection } from "@voyantjs/products-ui/components/product-versions-section"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { api } from "@/lib/api-client"
import { ProductAvailabilitySection } from "./product-availability-section"
import { ProductDialog } from "./product-detail-dialog"
import { ProductNotesCard } from "./product-detail-sections"
import {
  formatAmount,
  formatMargin,
  getProductNotesQueryOptions,
  statusVariant,
} from "./product-detail-shared"
import { ProductItinerarySection } from "./product-itinerary-section"

export function ProductDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")

  const { data: product, isPending } = useProduct(id)
  const { data: notesData, refetch: refetchNotes } = useQuery(getProductNotesQueryOptions(id))

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/products/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      void navigate({ to: "/products" })
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => api.post(`/v1/products/${id}/notes`, { content }),
    onSuccess: () => {
      setNoteContent("")
      void refetchNotes()
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Product not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/products" })}>
          Back to Products
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/products" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={statusVariant[product.status] ?? "secondary"} className="capitalize">
              {product.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this product?")) {
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
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {product.description ? (
              <div>
                <span className="text-muted-foreground">Description:</span>{" "}
                <span>{product.description}</span>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">Sell Currency:</span>{" "}
              <span>{product.sellCurrency}</span>
            </div>
            {product.sellAmountCents != null ? (
              <div>
                <span className="text-muted-foreground">Sell Amount:</span>{" "}
                <span className="font-mono">
                  {formatAmount(product.sellAmountCents, product.sellCurrency)}
                </span>
              </div>
            ) : null}
            {product.costAmountCents != null ? (
              <div>
                <span className="text-muted-foreground">Cost Amount:</span>{" "}
                <span className="font-mono">
                  {formatAmount(product.costAmountCents, product.sellCurrency)}
                </span>
              </div>
            ) : null}
            {product.marginPercent != null ? (
              <div>
                <span className="text-muted-foreground">Margin:</span>{" "}
                <span className="font-mono">{formatMargin(product.marginPercent)}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{new Date(product.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{" "}
              <span>{new Date(product.updatedAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-2 border-t pt-3 text-xs text-muted-foreground">
              Products are templates. Individual departures are managed in the Departures section
              below.
            </p>
          </CardContent>
        </Card>
      </div>

      <ProductAvailabilitySection productId={id} />
      <ProductItinerarySection productId={id} />
      <OptionsSection productId={id} />
      <ProductMediaSection productId={id} />
      <ProductVersionsSection productId={id} />
      <ProductNotesCard
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        isAdding={addNoteMutation.isPending}
        onAddNote={() => addNoteMutation.mutate(noteContent.trim())}
        notes={notesData?.data ?? []}
      />

      <ProductDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={product}
        onSuccess={() => {
          setEditOpen(false)
          void queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(id) })
          void queryClient.invalidateQueries({ queryKey: productsQueryKeys.products() })
        }}
      />
    </div>
  )
}
