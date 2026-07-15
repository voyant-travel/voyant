import { useQueryClient } from "@tanstack/react-query"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyant-travel/ui/components"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@voyant-travel/ui/components/alert-dialog"
import { Copy, MoreHorizontal, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  type ProductDayRecord,
  type ProductDayServiceRecord,
  type ProductItineraryRecord,
  productsQueryKeys,
  useProductDayMutation,
  useProductItineraries,
  useProductItineraryDays,
  useProductItineraryMutation,
} from "../../index.js"
import { useVoyantProductsContext } from "../../provider.js"
import { ProductItineraryDialog } from "../product-itinerary-dialog.js"
import { useProductDetailApi, useProductDetailMessages } from "./host.js"
import { ProductDaySheet } from "./product-day-sheet.js"
import { ProductDetailDayRow } from "./product-detail-day-row.js"
import { ActionMenu, EmptyState, Section } from "./product-detail-sections.js"
import { ServiceDialog } from "./product-service-dialog.js"
import { createDayMediaUploadHandler } from "./upload-day-media.js"

export function ProductDetailItinerarySection({ productId }: { productId: string }) {
  const messages = useProductDetailMessages()
  const api = useProductDetailApi()
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const productMessages = messages.products.core
  const queryClient = useQueryClient()
  const itineraryQuery = useProductItineraries(productId)
  const itineraryMutation = useProductItineraryMutation()
  const dayMutation = useProductDayMutation()
  const productActionLedgerQueryKey = [...productsQueryKeys.product(productId), "action-ledger"]
  const invalidateProductActionLedger = () =>
    queryClient.invalidateQueries({ queryKey: productActionLedgerQueryKey })

  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [selectedItineraryId, setSelectedItineraryId] = useState<string | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = useState(false)
  const [editingDay, setEditingDay] = useState<ProductDayRecord | undefined>()
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [serviceDialogDayId, setServiceDialogDayId] = useState("")
  const [editingService, setEditingService] = useState<ProductDayServiceRecord | undefined>()
  const [itineraryDialogOpen, setItineraryDialogOpen] = useState(false)
  const [editingItinerary, setEditingItinerary] = useState<ProductItineraryRecord | undefined>()
  const [deleteItineraryTarget, setDeleteItineraryTarget] = useState<ProductItineraryRecord | null>(
    null,
  )
  const uploadDayMediaToStorage = useMemo(
    () => createDayMediaUploadHandler({ baseUrl, fetcher }),
    [baseUrl, fetcher],
  )

  const itineraries = useMemo(() => itineraryQuery.data?.data ?? [], [itineraryQuery.data?.data])
  const hasMultiple = itineraries.length > 1

  useEffect(() => {
    if (itineraries.length === 0) {
      setSelectedItineraryId(null)
      return
    }

    setSelectedItineraryId((current) => {
      if (current && itineraries.some((itinerary) => itinerary.id === current)) {
        return current
      }

      return itineraries.find((itinerary) => itinerary.isDefault)?.id ?? itineraries[0]?.id ?? null
    })
  }, [itineraries])

  const selectedItinerary = useMemo(
    () => itineraries.find((itinerary) => itinerary.id === selectedItineraryId),
    [itineraries, selectedItineraryId],
  )

  const daysQuery = useProductItineraryDays(productId, selectedItineraryId, {
    enabled: Boolean(selectedItineraryId),
  })
  const days = useMemo(
    () =>
      (daysQuery.data?.data ?? []).slice().sort((left, right) => left.dayNumber - right.dayNumber),
    [daysQuery.data?.data],
  )
  const nextDayNumber = days.length > 0 ? Math.max(...days.map((day) => day.dayNumber)) + 1 : 1

  const openCreateItinerary = () => {
    setEditingItinerary(undefined)
    setItineraryDialogOpen(true)
  }

  const openRenameItinerary = (itinerary: ProductItineraryRecord) => {
    setEditingItinerary(itinerary)
    setItineraryDialogOpen(true)
  }

  const handleSetDefault = async (itinerary: ProductItineraryRecord) => {
    if (itinerary.isDefault) return
    await itineraryMutation.update.mutateAsync({
      productId,
      itineraryId: itinerary.id,
      input: { isDefault: true },
    })
    void invalidateProductActionLedger()
  }

  const handleDuplicate = async (itinerary: ProductItineraryRecord) => {
    const result = await itineraryMutation.duplicate.mutateAsync({
      productId,
      itineraryId: itinerary.id,
    })
    setExpandedDayId(null)
    setSelectedItineraryId(result.itinerary.id)
    void invalidateProductActionLedger()
  }

  const handleConfirmDelete = async () => {
    if (!deleteItineraryTarget) return
    await itineraryMutation.remove.mutateAsync({
      productId,
      itineraryId: deleteItineraryTarget.id,
    })
    setDeleteItineraryTarget(null)
    void invalidateProductActionLedger()
  }

  const sectionTitle = hasMultiple
    ? productMessages.itinerariesTitle
    : productMessages.itineraryTitle

  return (
    <>
      <Section
        title={sectionTitle}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!selectedItinerary}
              onClick={() => {
                setEditingDay(undefined)
                setDayDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {productMessages.addDay}
            </Button>
            <ActionMenu label={productMessages.itineraryOptionsLabel}>
              <DropdownMenuItem onClick={openCreateItinerary}>
                <Plus className="h-4 w-4" />
                {productMessages.newItinerary}
              </DropdownMenuItem>
              {selectedItinerary && !hasMultiple ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openRenameItinerary(selectedItinerary)}>
                    <Pencil className="h-4 w-4" />
                    {productMessages.renameItinerary}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleDuplicate(selectedItinerary)}>
                    <Copy className="h-4 w-4" />
                    {productMessages.duplicateItinerary}
                  </DropdownMenuItem>
                </>
              ) : null}
            </ActionMenu>
          </div>
        }
      >
        {itineraryQuery.isPending ? (
          <EmptyState message="…" />
        ) : itineraryQuery.isError ? (
          <p className="py-6 text-center text-sm text-destructive">Failed to load itineraries.</p>
        ) : itineraries.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-6">
            <p className="text-sm text-muted-foreground">{productMessages.noItinerariesYet}</p>
            <Button variant="outline" size="sm" onClick={openCreateItinerary}>
              <Plus className="mr-2 h-4 w-4" />
              {productMessages.newItinerary}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {hasMultiple ? (
              <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
                {itineraries.map((itinerary) => {
                  const isSelected = itinerary.id === selectedItineraryId
                  return (
                    <div
                      key={itinerary.id}
                      className={`flex items-center gap-1 rounded-sm pl-2 pr-1 transition-colors ${
                        isSelected ? "bg-background shadow-sm" : "hover:bg-background/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedDayId(null)
                          setSelectedItineraryId(itinerary.id)
                        }}
                        className="flex items-center gap-2 py-1.5 text-sm"
                      >
                        <span className={isSelected ? "font-medium" : "text-muted-foreground"}>
                          {itinerary.name}
                        </span>
                        {itinerary.isDefault ? (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            {productMessages.defaultBadge}
                          </Badge>
                        ) : null}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={formatMessage(productMessages.itineraryRowOptionsLabel, {
                              name: itinerary.name,
                            })}
                            className="h-6 w-6 text-muted-foreground"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openRenameItinerary(itinerary)}>
                            <Pencil className="h-4 w-4" />
                            {productMessages.renameItinerary}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void handleDuplicate(itinerary)}>
                            <Copy className="h-4 w-4" />
                            {productMessages.duplicateItinerary}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={itinerary.isDefault}
                            onClick={() => handleSetDefault(itinerary)}
                          >
                            <Star className="h-4 w-4" />
                            {productMessages.setDefaultItinerary}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={itinerary.isDefault && itineraries.length > 1}
                            onClick={() => setDeleteItineraryTarget(itinerary)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {productMessages.deleteItinerary}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {daysQuery.isPending ? (
              <EmptyState message="…" />
            ) : daysQuery.isError ? (
              <p className="py-6 text-center text-sm text-destructive">
                {messages.products.operations.itineraries.daysLoadFailed}
              </p>
            ) : days.length === 0 ? (
              <EmptyState message={productMessages.itineraryEmpty} />
            ) : (
              <div className="flex flex-col gap-2">
                {days.map((day) => (
                  <ProductDetailDayRow
                    key={day.id}
                    day={day}
                    productId={productId}
                    expanded={expandedDayId === day.id}
                    onToggle={() =>
                      setExpandedDayId((current) => (current === day.id ? null : day.id))
                    }
                    onEdit={() => {
                      setEditingDay(day)
                      setDayDialogOpen(true)
                    }}
                    onDelete={() => {
                      if (window.confirm(productMessages.deleteDayConfirm)) {
                        dayMutation.remove.mutate(
                          {
                            productId,
                            itineraryId: selectedItineraryId ?? undefined,
                            dayId: day.id,
                          },
                          {
                            onSuccess: () => void invalidateProductActionLedger(),
                          },
                        )
                      }
                    }}
                    onAddService={() => {
                      setServiceDialogDayId(day.id)
                      setEditingService(undefined)
                      setServiceDialogOpen(true)
                    }}
                    onEditService={(service) => {
                      setServiceDialogDayId(day.id)
                      setEditingService(service)
                      setServiceDialogOpen(true)
                    }}
                    onDeleteService={(serviceId) => {
                      if (window.confirm(productMessages.deleteServiceConfirm)) {
                        void api
                          .delete(
                            `/v1/admin/products/${productId}/days/${day.id}/services/${serviceId}`,
                          )
                          .then(async () => {
                            await queryClient.invalidateQueries({
                              queryKey: ["product-day-services", productId, day.id],
                            })
                            await invalidateProductActionLedger()
                          })
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <ProductDaySheet
        open={dayDialogOpen}
        onOpenChange={setDayDialogOpen}
        productId={productId}
        itineraryId={selectedItineraryId ?? ""}
        day={editingDay}
        nextDayNumber={nextDayNumber}
        uploadMedia={uploadDayMediaToStorage}
        onSuccess={() => {
          setDayDialogOpen(false)
          setEditingDay(undefined)
          if (selectedItineraryId) {
            void queryClient.invalidateQueries({
              queryKey: ["products", productId, "itineraries", selectedItineraryId, "days"],
            })
          }
          void invalidateProductActionLedger()
        }}
      />

      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        productId={productId}
        dayId={serviceDialogDayId}
        service={editingService}
        onSuccess={() => {
          setServiceDialogOpen(false)
          setEditingService(undefined)
          void queryClient.invalidateQueries({
            queryKey: ["product-day-services", productId, serviceDialogDayId],
          })
          void invalidateProductActionLedger()
        }}
      />

      <ProductItineraryDialog
        open={itineraryDialogOpen}
        onOpenChange={(open) => {
          setItineraryDialogOpen(open)
          if (!open) setEditingItinerary(undefined)
        }}
        productId={productId}
        itinerary={editingItinerary}
        itineraryCount={itineraries.length}
        onSuccess={(itineraryId) => {
          if (!editingItinerary) setSelectedItineraryId(itineraryId)
          void invalidateProductActionLedger()
        }}
      />

      <AlertDialog
        open={!!deleteItineraryTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteItineraryTarget(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{productMessages.deleteItineraryTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteItineraryTarget
                ? formatMessage(productMessages.deleteItineraryDescription, {
                    name: deleteItineraryTarget.name,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{productMessages.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleConfirmDelete()}>
              {productMessages.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
