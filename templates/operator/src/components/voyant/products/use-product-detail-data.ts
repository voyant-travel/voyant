import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { productsQueryKeys, useProduct, useProductItineraries } from "@voyantjs/products-react"
import { useMemo } from "react"

import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"

import {
  type AvailabilityRule,
  type ChannelInfo,
  type ChannelProductMapping,
  type DepartureSlot,
  getChannelsQueryOptions,
  getProductChannelMappingsQueryOptions,
  getProductMediaQueryOptions,
  getProductRulesQueryOptions,
  getProductSlotsQueryOptions,
  type ProductMediaItem,
} from "./product-detail-shared"

export interface UseProductDetailDataResult {
  product: ReturnType<typeof useProduct>["data"]
  isPending: boolean
  slots: DepartureSlot[]
  rules: AvailabilityRule[]
  channels: ChannelInfo[]
  mappings: ChannelProductMapping[]
  media: ProductMediaItem[]
  itineraryNameById: Map<string, string>
  refetch: {
    slots: () => void
    rules: () => void
    mappings: () => void
    media: () => void
  }
  mutations: {
    addChannelMapping: ReturnType<typeof useMutation<unknown, Error, string>>
    removeChannelMapping: ReturnType<typeof useMutation<unknown, Error, string>>
    duplicateProduct: ReturnType<typeof useMutation<{ data: { id: string } }, Error, void>>
    deleteProduct: ReturnType<typeof useMutation<unknown, Error, void>>
    deleteSlot: ReturnType<typeof useMutation<unknown, Error, string>>
    deleteRule: ReturnType<typeof useMutation<unknown, Error, string>>
    uploadMedia: ReturnType<typeof useMutation<unknown, Error, { file: File; dayId?: string }>>
    deleteMedia: ReturnType<typeof useMutation<unknown, Error, string>>
    setCover: ReturnType<typeof useMutation<unknown, Error, string>>
    generateBrochure: ReturnType<typeof useMutation<unknown, Error, void>>
  }
  invalidateProduct: () => void
}

export function useProductDetailData(productId: string): UseProductDetailDataResult {
  const queryClient = useQueryClient()
  const messages = useAdminMessages()
  const productMessages = messages.products.core

  const productQuery = useProduct(productId)
  const itinerariesQuery = useProductItineraries(productId)
  const productActionLedgerQueryKey = [...productsQueryKeys.product(productId), "action-ledger"]

  const slotsQuery = useQuery(getProductSlotsQueryOptions(productId))
  const rulesQuery = useQuery(getProductRulesQueryOptions(productId))
  const channelsQuery = useQuery(getChannelsQueryOptions())
  const mappingsQuery = useQuery(getProductChannelMappingsQueryOptions(productId))
  const mediaQuery = useQuery(getProductMediaQueryOptions(productId))

  const addChannelMapping = useMutation({
    mutationFn: (channelId: string) =>
      api.post("/v1/distribution/product-mappings", {
        channelId,
        productId,
        active: true,
      }),
    onSuccess: () => {
      void mappingsQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const removeChannelMapping = useMutation({
    mutationFn: (mappingId: string) => api.delete(`/v1/distribution/product-mappings/${mappingId}`),
    onSuccess: () => {
      void mappingsQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const deleteProduct = useMutation({
    mutationFn: () => api.delete(`/v1/products/${productId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const duplicateProduct = useMutation({
    mutationFn: () =>
      api.post<{ data: { id: string } }>(`/v1/admin/products/${productId}/duplicate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.products() })
    },
  })

  const deleteSlot = useMutation({
    mutationFn: (slotId: string) => api.delete(`/v1/availability/slots/${slotId}`),
    onSuccess: () => {
      void slotsQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) => api.delete(`/v1/availability/rules/${ruleId}`),
    onSuccess: () => {
      void rulesQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const uploadMedia = useMutation({
    mutationFn: async ({ file, dayId }: { file: File; dayId?: string }) => {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/v1/uploads", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      if (!uploadRes.ok) throw new Error(productMessages.uploadFailed)
      const upload = (await uploadRes.json()) as {
        key: string
        url: string
        mimeType: string
        size: number
      }

      const mediaType = upload.mimeType.startsWith("video/")
        ? "video"
        : upload.mimeType.startsWith("image/")
          ? "image"
          : "document"

      const endpoint = dayId
        ? `/v1/products/${productId}/days/${dayId}/media`
        : `/v1/products/${productId}/media`

      return api.post(endpoint, {
        mediaType,
        name: file.name,
        url: upload.url,
        storageKey: upload.key,
        mimeType: upload.mimeType,
        fileSize: upload.size,
      })
    },
    onSuccess: () => {
      void mediaQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const deleteMedia = useMutation({
    mutationFn: (mediaId: string) => api.delete(`/v1/products/media/${mediaId}`),
    onSuccess: () => {
      void mediaQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const setCover = useMutation({
    mutationFn: (mediaId: string) => api.patch(`/v1/products/media/${mediaId}/set-cover`, {}),
    onSuccess: () => {
      void mediaQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const generateBrochure = useMutation({
    mutationFn: () => api.post(`/v1/admin/products/${productId}/brochure/generate`, {}),
    onSuccess: () => {
      void mediaQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
    },
  })

  const itineraryNameById = useMemo(
    () =>
      new Map(
        (itinerariesQuery.data?.data ?? []).map(
          (itinerary) => [itinerary.id, itinerary.name] as const,
        ),
      ),
    [itinerariesQuery.data],
  )

  const invalidateProduct = () => {
    void queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(productId) })
    void queryClient.invalidateQueries({ queryKey: productsQueryKeys.products() })
    void queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })
  }

  return {
    product: productQuery.data,
    isPending: productQuery.isPending,
    slots: slotsQuery.data?.data ?? [],
    rules: rulesQuery.data?.data ?? [],
    channels: channelsQuery.data?.data ?? [],
    mappings: mappingsQuery.data?.data ?? [],
    media: mediaQuery.data?.data ?? [],
    itineraryNameById,
    refetch: {
      slots: () => void slotsQuery.refetch(),
      rules: () => void rulesQuery.refetch(),
      mappings: () => void mappingsQuery.refetch(),
      media: () => void mediaQuery.refetch(),
    },
    mutations: {
      addChannelMapping,
      removeChannelMapping,
      duplicateProduct,
      deleteProduct,
      deleteSlot,
      deleteRule,
      uploadMedia,
      deleteMedia,
      setCover,
      generateBrochure,
    },
    invalidateProduct,
  }
}
