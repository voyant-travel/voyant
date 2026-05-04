import { useNavigate } from "@tanstack/react-router"
import { BookingDialog } from "@voyantjs/bookings-ui/components/booking-dialog"
import { ProductOptionsSection } from "@voyantjs/products-ui/components/product-options-section"
import { Button } from "@voyantjs/ui/components"
import { useAdminMessages } from "@/lib/admin-i18n"
import { DepartureDialog } from "./product-departure-dialog"
import { ProductDialog } from "./product-detail-dialog"
import { ProductDetailHeader } from "./product-detail-header"
import { ProductDetailItinerarySection } from "./product-detail-itinerary-section"
import {
  ProductChannelsSection,
  ProductDeparturesSection,
  ProductDetailsSection,
  ProductMediaSection,
  ProductOrganizeSection,
  ProductSchedulesSection,
} from "./product-detail-sections"
import { ProductDetailSkeleton } from "./product-detail-skeleton"
import { ProductPaymentPolicySection } from "./product-payment-policy-section"
import { ScheduleDialog } from "./product-schedule-dialog"
import { ProductSourcedContentSection } from "./product-sourced-content-section"
import { useProductDetailData } from "./use-product-detail-data"
import { useProductDetailDialogs } from "./use-product-detail-dialogs"

export function ProductDetailPage({ id }: { id: string }) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  const navigate = useNavigate()

  const data = useProductDetailData(id)
  const dialogs = useProductDetailDialogs()

  const { product, isPending, slots, rules, channels, mappings, media, itineraryNameById } = data
  const { mutations, refetch, invalidateProduct } = data

  if (isPending) {
    return <ProductDetailSkeleton />
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{productMessages.detailNotFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/products" })}>
          {productMessages.backToProducts}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <ProductDetailHeader
        product={product}
        isDeleting={mutations.deleteProduct.isPending}
        onEdit={dialogs.edit.openNow}
        onAddBooking={dialogs.bookingCreate.openNow}
        onDelete={() => {
          if (confirm(productMessages.deleteConfirm)) {
            mutations.deleteProduct.mutate(undefined, {
              onSuccess: () => void navigate({ to: "/products" }),
            })
          }
        }}
      />

      {/* Content — two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Left column (main) ── */}
        <div className="flex min-w-0 flex-col gap-6">
          <ProductDetailsSection product={product} onEdit={dialogs.edit.openNow} />

          <ProductMediaSection
            productId={id}
            media={media}
            isUploading={mutations.uploadMedia.isPending}
            onUpload={(file) => mutations.uploadMedia.mutate({ file })}
            onSetCover={(mediaId) => mutations.setCover.mutate(mediaId)}
            onDelete={(mediaId) => {
              if (confirm(productMessages.deleteMediaConfirm)) {
                mutations.deleteMedia.mutate(mediaId)
              }
            }}
          />

          <ProductDeparturesSection
            slots={slots}
            itineraryNameById={itineraryNameById}
            onCreate={dialogs.departure.openNew}
            onEdit={dialogs.departure.openEdit}
            onDelete={(slotId) => {
              if (confirm(productMessages.deleteDepartureConfirm)) {
                mutations.deleteSlot.mutate(slotId)
              }
            }}
          />

          <ProductSchedulesSection
            rules={rules}
            onCreate={dialogs.schedule.openNew}
            onEdit={dialogs.schedule.openEdit}
            onDelete={(ruleId) => {
              if (confirm(productMessages.deleteScheduleConfirm)) {
                mutations.deleteRule.mutate(ruleId)
              }
            }}
          />

          <ProductDetailItinerarySection productId={id} />

          <ProductOptionsSection productId={id} />

          <ProductPaymentPolicySection product={product} onSuccess={invalidateProduct} />
        </div>

        {/* ── Right column (sidebar) ── */}
        <div className="flex flex-col gap-6">
          <ProductChannelsSection
            allChannels={channels}
            mappings={mappings}
            onAddChannel={(channelId) => mutations.addChannelMapping.mutate(channelId)}
            onRemoveChannel={(mappingId) => mutations.removeChannelMapping.mutate(mappingId)}
          />

          <ProductOrganizeSection product={product} onEdit={dialogs.edit.openNow} />

          <ProductSourcedContentSection productId={id} />
        </div>
      </div>

      {/* Dialogs */}
      <BookingDialog
        open={dialogs.bookingCreate.open}
        onOpenChange={dialogs.bookingCreate.setOpen}
        defaultProductId={id}
        onSuccess={(booking) => {
          dialogs.bookingCreate.close()
          void navigate({ to: "/bookings/$id", params: { id: booking.id } })
        }}
      />

      <ProductDialog
        open={dialogs.edit.open}
        onOpenChange={dialogs.edit.setOpen}
        product={product}
        onSuccess={() => {
          dialogs.edit.close()
          invalidateProduct()
        }}
      />

      <DepartureDialog
        open={dialogs.departure.open}
        onOpenChange={dialogs.departure.setOpen}
        productId={id}
        slot={dialogs.departure.editing}
        onSuccess={() => {
          dialogs.departure.close()
          refetch.slots()
        }}
      />

      <ScheduleDialog
        open={dialogs.schedule.open}
        onOpenChange={dialogs.schedule.setOpen}
        productId={id}
        rule={dialogs.schedule.editing}
        onSuccess={() => {
          dialogs.schedule.close()
          refetch.rules()
        }}
      />
    </div>
  )
}
