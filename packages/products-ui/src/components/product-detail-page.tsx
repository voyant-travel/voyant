"use client"

import {
  type ProductDayRecord,
  type ProductDayServiceRecord,
  type ProductItineraryRecord,
  type ProductRecord,
  useProduct,
  useProductDayMutation,
  useProductItineraries,
  useProductItineraryDays,
  useProductItineraryMutation,
  useProductMutation,
} from "@voyantjs/products-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { cn } from "@voyantjs/ui/lib/utils"
import { ArrowLeft, Edit, FileText, Loader2, Plus, ReceiptText, Trash2 } from "lucide-react"
import * as React from "react"

import { useProductsUiI18nOrDefault, useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import { ProductDayDialog } from "./product-day-dialog.js"
import { ProductDialog } from "./product-dialog.js"
import {
  ProductItineraryDayRow,
  type ProductItineraryDayRowRenderContext,
} from "./product-itinerary-day-row.js"
import { ProductItineraryDialog } from "./product-itinerary-dialog.js"
import { ProductMediaSection, type ProductMediaSectionProps } from "./product-media-section.js"
import {
  ProductOptionsSection,
  type ProductOptionsSectionProps,
} from "./product-options-section.js"
import { ProductVersionsSection } from "./product-versions-section.js"

export type ProductDetailPageTab = "overview" | "media" | "itinerary" | "options" | "versions"

export interface ProductDetailPageSlots {
  header?: React.ReactNode
  afterHeader?: React.ReactNode
  overviewStart?: React.ReactNode
  overviewEnd?: React.ReactNode
  sidebar?: React.ReactNode
  mediaEnd?: React.ReactNode
  itineraryEnd?: React.ReactNode
  optionsEnd?: React.ReactNode
  versionsEnd?: React.ReactNode
}

export interface ProductDetailPageProps {
  id: string
  className?: string
  defaultTab?: ProductDetailPageTab
  onBack?: () => void
  onBookingCreate?: (product: ProductRecord) => void
  onDeleted?: () => void
  uploadMedia?: ProductMediaSectionProps["uploadMedia"]
  renderOptionDetails?: ProductOptionsSectionProps["renderOptionDetails"]
  renderItineraryDayDetails?: (context: ProductItineraryDayRowRenderContext) => React.ReactNode
  renderItineraryServiceActions?: (service: ProductDayServiceRecord) => React.ReactNode
  slots?: ProductDetailPageSlots
}

export function ProductDetailPage({
  id,
  className,
  defaultTab = "overview",
  onBack,
  onBookingCreate,
  onDeleted,
  uploadMedia,
  renderOptionDetails,
  renderItineraryDayDetails,
  renderItineraryServiceActions,
  slots,
}: ProductDetailPageProps) {
  const messages = useProductsUiMessagesOrDefault()
  const pageMessages = messages.productDetailPage
  const productQuery = useProduct(id)
  const { remove } = useProductMutation()
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  if (productQuery.isPending) {
    return <ProductDetailPageLoading className={className} />
  }

  if (productQuery.isError) {
    return (
      <ProductDetailPageState
        className={className}
        title={pageMessages.states.loadFailed}
        description={productQuery.error instanceof Error ? productQuery.error.message : undefined}
        onBack={onBack}
      />
    )
  }

  const product = productQuery.data
  if (!product) {
    return (
      <ProductDetailPageState
        className={className}
        title={pageMessages.states.notFoundTitle}
        description={pageMessages.states.notFoundDescription}
        onBack={onBack}
      />
    )
  }

  const handleDelete = async () => {
    setDeleteError(null)
    if (!confirm(pageMessages.states.deleteConfirm.replace("{name}", product.name))) return

    try {
      await remove.mutateAsync(product.id)
      onDeleted?.()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : pageMessages.states.deleteFailed)
    }
  }

  return (
    <div data-slot="product-detail-page" className={cn("flex flex-col gap-6", className)}>
      <ProductDetailHeader
        product={product}
        onBack={onBack}
        onEdit={() => setEditOpen(true)}
        onDelete={() => void handleDelete()}
        onBookingCreate={onBookingCreate ? () => onBookingCreate(product) : undefined}
        deleting={remove.isPending}
        actionsSlot={slots?.header}
      />

      {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
      {slots?.afterHeader}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">{pageMessages.tabs.overview}</TabsTrigger>
          <TabsTrigger value="media">{pageMessages.tabs.media}</TabsTrigger>
          <TabsTrigger value="itinerary">{pageMessages.tabs.itinerary}</TabsTrigger>
          <TabsTrigger value="options">{pageMessages.tabs.options}</TabsTrigger>
          <TabsTrigger value="versions">{pageMessages.tabs.versions}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-4">
              {slots?.overviewStart}
              <ProductOverviewCard product={product} />
              <ProductCommercialCard product={product} />
              {slots?.overviewEnd}
            </div>
            <div className="flex flex-col gap-4">
              <ProductDetailSidebar product={product} />
              {slots?.sidebar}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="media" className="mt-4 space-y-4">
          <ProductMediaSection productId={product.id} uploadMedia={uploadMedia} />
          {slots?.mediaEnd}
        </TabsContent>

        <TabsContent value="itinerary" className="mt-4 space-y-4">
          <ProductItinerarySection
            productId={product.id}
            renderDayDetails={renderItineraryDayDetails}
            renderServiceActions={renderItineraryServiceActions}
          />
          {slots?.itineraryEnd}
        </TabsContent>

        <TabsContent value="options" className="mt-4 space-y-4">
          <ProductOptionsSection productId={product.id} renderOptionDetails={renderOptionDetails} />
          {slots?.optionsEnd}
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          <ProductVersionsSection productId={product.id} />
          {slots?.versionsEnd}
        </TabsContent>
      </Tabs>

      <ProductDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={product}
        onSuccess={() => setEditOpen(false)}
      />
    </div>
  )
}

export interface ProductDetailHeaderProps {
  product: ProductRecord
  onBack?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onBookingCreate?: () => void
  deleting?: boolean
  actionsSlot?: React.ReactNode
  className?: string
}

export function ProductDetailHeader({
  product,
  onBack,
  onEdit,
  onDelete,
  onBookingCreate,
  deleting = false,
  actionsSlot,
  className,
}: ProductDetailHeaderProps) {
  const messages = useProductsUiMessagesOrDefault()

  return (
    <div
      data-slot="product-detail-header"
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          {onBack ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onBack}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="sr-only">{messages.productDetailPage.actions.back}</span>
            </Button>
          ) : null}
          <Badge
            variant={
              product.status === "active"
                ? "default"
                : product.status === "archived"
                  ? "secondary"
                  : "outline"
            }
          >
            {messages.common.productStatusLabels[product.status]}
          </Badge>
          <Badge variant="outline">
            {messages.common.productBookingModeLabels[product.bookingMode]}
          </Badge>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{product.id}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actionsSlot}
        {onBookingCreate ? (
          <Button type="button" variant="outline" onClick={onBookingCreate}>
            <ReceiptText className="mr-2 size-4" aria-hidden="true" />
            {messages.productDetailPage.actions.createBooking}
          </Button>
        ) : null}
        {onEdit ? (
          <Button type="button" variant="outline" onClick={onEdit}>
            <Edit className="mr-2 size-4" aria-hidden="true" />
            {messages.productDetailPage.actions.edit}
          </Button>
        ) : null}
        {onDelete ? (
          <Button type="button" variant="destructive" disabled={deleting} onClick={onDelete}>
            {deleting ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="mr-2 size-4" aria-hidden="true" />
            )}
            {messages.productDetailPage.actions.delete}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export interface ProductOverviewCardProps {
  product: ProductRecord
  className?: string
}

export function ProductOverviewCard({ product, className }: ProductOverviewCardProps) {
  const messages = useProductsUiMessagesOrDefault()
  const pageMessages = messages.productDetailPage

  return (
    <Card data-slot="product-overview-card" className={className}>
      <CardHeader>
        <CardTitle>{pageMessages.sections.overview.title}</CardTitle>
        <CardDescription>{pageMessages.sections.overview.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {product.description || pageMessages.states.noDescription}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProductField label={pageMessages.fields.visibility} value={product.visibility} />
          <ProductField label={pageMessages.fields.capacityMode} value={product.capacityMode} />
          <ProductField label={pageMessages.fields.timezone} value={product.timezone} />
          <ProductField label={pageMessages.fields.productType} value={product.productTypeId} />
          <ProductField label={pageMessages.fields.facility} value={product.facilityId} />
          <ProductField label={pageMessages.fields.taxClass} value={product.taxClassId} />
          <ProductField label={pageMessages.fields.startDate} value={product.startDate} />
          <ProductField label={pageMessages.fields.endDate} value={product.endDate} />
        </div>
      </CardContent>
    </Card>
  )
}

export function ProductCommercialCard({ product, className }: ProductOverviewCardProps) {
  const messages = useProductsUiMessagesOrDefault()
  const pageMessages = messages.productDetailPage
  const { formatCurrency, formatNumber } = useProductsUiI18nOrDefault()

  return (
    <Card data-slot="product-commercial-card" className={className}>
      <CardHeader>
        <CardTitle>{pageMessages.sections.commercial.title}</CardTitle>
        <CardDescription>{pageMessages.sections.commercial.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <ProductField
          label={pageMessages.fields.sellAmount}
          value={formatMoney(product.sellAmountCents, product.sellCurrency, formatCurrency)}
        />
        <ProductField
          label={pageMessages.fields.costAmount}
          value={formatMoney(product.costAmountCents, product.sellCurrency, formatCurrency)}
        />
        <ProductField
          label={pageMessages.fields.margin}
          value={product.marginPercent == null ? null : `${formatNumber(product.marginPercent)}%`}
        />
        <ProductField
          label={pageMessages.fields.pax}
          value={product.pax == null ? null : formatNumber(product.pax)}
        />
        <ProductField
          label={pageMessages.fields.reservationTimeout}
          value={
            product.reservationTimeoutMinutes == null
              ? null
              : pageMessages.states.minutes.replace(
                  "{count}",
                  formatNumber(product.reservationTimeoutMinutes),
                )
          }
        />
      </CardContent>
    </Card>
  )
}

export interface ProductDetailSidebarProps {
  product: ProductRecord
  className?: string
}

export function ProductDetailSidebar({ product, className }: ProductDetailSidebarProps) {
  const messages = useProductsUiMessagesOrDefault()
  const pageMessages = messages.productDetailPage
  const { formatDateTime } = useProductsUiI18nOrDefault()

  return (
    <Card data-slot="product-detail-sidebar" className={className}>
      <CardHeader>
        <CardTitle>{pageMessages.sections.sidebar.title}</CardTitle>
        <CardDescription>{pageMessages.sections.sidebar.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{messages.common.productStatusLabels[product.status]}</Badge>
          <Badge variant="outline">
            {messages.common.productBookingModeLabels[product.bookingMode]}
          </Badge>
          {product.activated ? <Badge variant="secondary">{messages.common.active}</Badge> : null}
        </div>
        <ProductField label={pageMessages.fields.tags} value={product.tags.join(", ")} />
        <ProductField
          label={pageMessages.fields.createdAt}
          value={formatDateTime(product.createdAt)}
        />
        <ProductField
          label={pageMessages.fields.updatedAt}
          value={formatDateTime(product.updatedAt)}
        />
      </CardContent>
    </Card>
  )
}

export interface ProductItinerarySectionProps {
  productId: string
  title?: string
  description?: string
  renderDayDetails?: (context: ProductItineraryDayRowRenderContext) => React.ReactNode
  renderServiceActions?: (service: ProductDayServiceRecord) => React.ReactNode
  className?: string
}

export function ProductItinerarySection({
  productId,
  title,
  description,
  renderDayDetails,
  renderServiceActions,
  className,
}: ProductItinerarySectionProps) {
  const messages = useProductsUiMessagesOrDefault()
  const pageMessages = messages.productDetailPage
  const itinerariesQuery = useProductItineraries(productId)
  const itineraries = React.useMemo(
    () => (itinerariesQuery.data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [itinerariesQuery.data?.data],
  )
  const [selectedItineraryId, setSelectedItineraryId] = React.useState<string | null>(null)
  const selectedItinerary =
    itineraries.find((itinerary) => itinerary.id === selectedItineraryId) ?? null
  const daysQuery = useProductItineraryDays(productId, selectedItineraryId, {
    enabled: Boolean(selectedItineraryId),
  })
  const days = React.useMemo(
    () => (daysQuery.data?.data ?? []).slice().sort((a, b) => a.dayNumber - b.dayNumber),
    [daysQuery.data?.data],
  )
  const itineraryMutation = useProductItineraryMutation()
  const dayMutation = useProductDayMutation()
  const [itineraryDialogOpen, setItineraryDialogOpen] = React.useState(false)
  const [editingItinerary, setEditingItinerary] = React.useState<ProductItineraryRecord | null>(
    null,
  )
  const [dayDialogOpen, setDayDialogOpen] = React.useState(false)
  const [editingDay, setEditingDay] = React.useState<ProductDayRecord | null>(null)
  const [expandedDayId, setExpandedDayId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (itineraries.length === 0) {
      setSelectedItineraryId(null)
      return
    }

    setSelectedItineraryId((current) => {
      if (current && itineraries.some((itinerary) => itinerary.id === current)) return current
      return itineraries.find((itinerary) => itinerary.isDefault)?.id ?? itineraries[0]?.id ?? null
    })
  }, [itineraries])

  const nextDayNumber = days.length > 0 ? Math.max(...days.map((day) => day.dayNumber)) + 1 : 1

  return (
    <Card data-slot="product-itinerary-section" className={className}>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <CardTitle>{title ?? pageMessages.sections.itinerary.title}</CardTitle>
          <CardDescription>
            {description ?? pageMessages.sections.itinerary.description}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {itineraries.length > 0 ? (
            <Select
              value={selectedItineraryId ?? undefined}
              onValueChange={(value) => setSelectedItineraryId(value)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itineraries.map((itinerary) => (
                  <SelectItem key={itinerary.id} value={itinerary.id}>
                    {itinerary.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditingItinerary(null)
              setItineraryDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {pageMessages.actions.addItinerary}
          </Button>
          {selectedItinerary ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingItinerary(selectedItinerary)
                  setItineraryDialogOpen(true)
                }}
              >
                <Edit className="mr-2 size-4" aria-hidden="true" />
                {pageMessages.actions.editItinerary}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (
                    !confirm(
                      pageMessages.states.deleteItineraryConfirm.replace(
                        "{name}",
                        selectedItinerary.name,
                      ),
                    )
                  ) {
                    return
                  }
                  void itineraryMutation.remove.mutateAsync({
                    productId,
                    itineraryId: selectedItinerary.id,
                  })
                }}
              >
                <Trash2 className="mr-2 size-4" aria-hidden="true" />
                {pageMessages.actions.deleteItinerary}
              </Button>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {itinerariesQuery.isPending ? (
          <div className="flex min-h-24 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : itinerariesQuery.isError ? (
          <p className="text-sm text-destructive">{pageMessages.states.loadFailed}</p>
        ) : itineraries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pageMessages.states.noItineraries}</p>
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  setEditingDay(null)
                  setDayDialogOpen(true)
                }}
                disabled={!selectedItineraryId}
              >
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {pageMessages.actions.addDay}
              </Button>
            </div>
            {daysQuery.isPending ? (
              <div className="flex min-h-24 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : daysQuery.isError ? (
              <p className="text-sm text-destructive">{pageMessages.states.loadFailed}</p>
            ) : days.length === 0 ? (
              <p className="text-sm text-muted-foreground">{pageMessages.states.noDays}</p>
            ) : (
              days.map((day) => (
                <ProductItineraryDayRow
                  key={day.id}
                  productId={productId}
                  day={day}
                  expanded={expandedDayId === day.id}
                  onToggle={() =>
                    setExpandedDayId((current) => (current === day.id ? null : day.id))
                  }
                  onEdit={() => {
                    setEditingDay(day)
                    setDayDialogOpen(true)
                  }}
                  onDelete={() => {
                    if (
                      !confirm(
                        pageMessages.states.deleteDayConfirm.replace(
                          "{dayNumber}",
                          String(day.dayNumber),
                        ),
                      )
                    ) {
                      return
                    }
                    void dayMutation.remove.mutateAsync({
                      productId,
                      dayId: day.id,
                      itineraryId: day.itineraryId,
                    })
                  }}
                  renderDayDetails={renderDayDetails}
                  renderServiceActions={renderServiceActions}
                />
              ))
            )}
          </>
        )}
      </CardContent>

      <ProductItineraryDialog
        open={itineraryDialogOpen}
        onOpenChange={setItineraryDialogOpen}
        productId={productId}
        itinerary={editingItinerary ?? undefined}
        itineraryCount={itineraries.length}
        onSuccess={(itineraryId) => setSelectedItineraryId(itineraryId)}
      />
      {selectedItineraryId ? (
        <ProductDayDialog
          open={dayDialogOpen}
          onOpenChange={setDayDialogOpen}
          productId={productId}
          itineraryId={selectedItineraryId}
          day={editingDay ?? undefined}
          nextDayNumber={nextDayNumber}
          onSuccess={(day) => {
            setExpandedDayId(day.id)
            setEditingDay(null)
          }}
        />
      ) : null}
    </Card>
  )
}

function ProductDetailPageLoading({ className }: { className?: string }) {
  const messages = useProductsUiMessagesOrDefault()

  return (
    <div
      data-slot="product-detail-page-loading"
      className={cn("flex min-h-48 items-center justify-center", className)}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {messages.productDetailPage.states.loading}
      </div>
    </div>
  )
}

function ProductDetailPageState({
  className,
  title,
  description,
  onBack,
}: {
  className?: string
  title: string
  description?: string
  onBack?: () => void
}) {
  const messages = useProductsUiMessagesOrDefault()

  return (
    <div data-slot="product-detail-page-state" className={cn("flex flex-col gap-4", className)}>
      {onBack ? (
        <Button type="button" variant="ghost" className="w-fit" onClick={onBack}>
          <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
          {messages.productDetailPage.actions.back}
        </Button>
      ) : null}
      <Card>
        <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
          <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

function ProductField({ label, value }: { label: string; value: React.ReactNode }) {
  const messages = useProductsUiMessagesOrDefault()
  const hasValue =
    value !== null &&
    value !== undefined &&
    !(typeof value === "string" && value.trim().length === 0)

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="break-words text-sm">{hasValue ? value : messages.common.none}</div>
    </div>
  )
}

function formatMoney(
  amountCents: number | null,
  currency: string,
  formatCurrency: (value: number, currency: string) => string,
) {
  return amountCents == null ? null : formatCurrency(amountCents / 100, currency)
}
