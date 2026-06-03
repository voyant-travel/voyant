import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs, useLocale } from "@voyantjs/admin"
import { getProductQueryOptions } from "@voyantjs/products-react"
import {
  getChannelsQueryOptions,
  getPricingCategoriesQueryOptions,
  getProductChannelMappingsQueryOptions,
  getProductMediaQueryOptions,
  getProductOptionsQueryOptions,
  getProductRulesQueryOptions,
  getProductSlotsQueryOptions,
  type ProductDetailBreadcrumb,
  ProductDetailHostProvider,
  type ProductDetailHostValue,
  ProductDetailPage,
  ProductDetailSkeleton,
} from "@voyantjs/products-ui/components/product-detail"
import { useMemo, useState } from "react"
import { OptionResourceTemplatesPanel } from "@/components/voyant/availability/option-resource-templates-panel"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// App-specific storage upload (cookie-auth, browser-side file upload). The page
// turns this result into a media record via the injected `api`.
const uploadMedia: NonNullable<ProductDetailHostValue["uploadMedia"]> = async (file) => {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch("/api/v1/uploads", {
    method: "POST",
    body: formData,
    credentials: "include",
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const upload = (await res.json()) as { key: string; url: string; mimeType: string; size: number }
  const mediaType: "image" | "video" | "document" = upload.mimeType.startsWith("video/")
    ? "video"
    : upload.mimeType.startsWith("image/")
      ? "image"
      : "document"
  return {
    url: upload.url,
    name: file.name,
    storageKey: upload.key,
    mimeType: upload.mimeType,
    fileSize: upload.size,
    mediaType,
  }
}

const renderOptionExtras = (productId: string, optionId: string) => (
  <OptionResourceTemplatesPanel productId={productId} optionId={optionId} />
)

// Critical path only: await the product itself so the header has data and the
// loader unblocks after one round-trip. Everything else is a background
// prefetch — the page's `useQuery` calls light up as data arrives.
export const Route = createFileRoute("/_workspace/products/$id")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    await context.queryClient.ensureQueryData(getProductQueryOptions(client, params.id))

    void context.queryClient.prefetchQuery(getProductOptionsQueryOptions(client, params.id))
    void context.queryClient.prefetchQuery(getProductSlotsQueryOptions(api, params.id))
    void context.queryClient.prefetchQuery(getProductRulesQueryOptions(api, params.id))
    void context.queryClient.prefetchQuery(getChannelsQueryOptions(api))
    void context.queryClient.prefetchQuery(getProductChannelMappingsQueryOptions(api, params.id))
    void context.queryClient.prefetchQuery(getProductMediaQueryOptions(api, params.id))
    void context.queryClient.prefetchQuery(getPricingCategoriesQueryOptions(client))
  },
  pendingComponent: ProductDetailSkeleton,
  component: ProductDetailRoute,
})

function ProductDetailRoute() {
  const { id } = Route.useParams()
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const navigate = useNavigate()
  const [breadcrumbs, setBreadcrumbs] = useState<ProductDetailBreadcrumb[]>([])
  useAdminBreadcrumbs(breadcrumbs)

  const navigation = useMemo<ProductDetailHostValue["navigate"]>(
    () => ({
      toProducts: () => void navigate({ to: "/products" }),
      toProduct: (productId) => void navigate({ to: "/products/$id", params: { id: productId } }),
      toNewBooking: (productId) =>
        void navigate({ to: "/bookings/$id", params: { id: "new" }, search: { productId } }),
      toAvailability: (slotId) =>
        void navigate({ to: "/availability/$id", params: { id: slotId } }),
    }),
    [navigate],
  )

  const host = useMemo<ProductDetailHostValue>(
    () => ({
      messages,
      api,
      locale: resolvedLocale,
      navigate: navigation,
      uploadMedia,
      setBreadcrumbs,
      renderOptionExtras,
    }),
    [messages, resolvedLocale, navigation],
  )

  return (
    <ProductDetailHostProvider value={host}>
      <ProductDetailPage id={id} />
    </ProductDetailHostProvider>
  )
}
