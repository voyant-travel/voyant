import { useQueries } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ProductActionLedgerCard } from "@voyantjs/products-ui/components/product-action-ledger-card"
import { ProductOptionsSection } from "@voyantjs/products-ui/components/product-options-section"
import { Button } from "@voyantjs/ui/components"
import { useMemo } from "react"
import { OptionResourceTemplatesPanel } from "@/components/voyant/availability/option-resource-templates-panel"
import { useAdminMessages } from "@/lib/admin-i18n"
import { DepartureDialog } from "./product-departure-dialog"
import { DeparturePricingOverrideDialog } from "./product-departure-pricing-override-dialog"
import { ProductDialog } from "./product-detail-dialog"
import { ProductDetailHeader } from "./product-detail-header"
import { ProductDetailItinerarySection } from "./product-detail-itinerary-section"
import {
  ProductBrochureSection,
  ProductChannelsSection,
  ProductDeparturesSection,
  ProductDetailsSection,
  ProductMediaSection,
  ProductOrganizeSection,
  ProductSchedulesSection,
} from "./product-detail-sections"
import { ProductDetailSkeleton } from "./product-detail-skeleton"
import { ProductExtrasSection } from "./product-extras-section"
import { PricingPanel } from "./product-options-pricing"
import { getDeparturePriceOverridesQueryOptions } from "./product-options-shared"
import { ProductPaymentPolicySection } from "./product-payment-policy-section"
import { ScheduleDialog } from "./product-schedule-dialog"
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

  const overrideQueries = useQueries({
    queries: slots.map((slot) => ({
      ...getDeparturePriceOverridesQueryOptions(slot.id),
      enabled: !!slot.id,
    })),
  })

  const slotIdsWithOverrides = useMemo(() => {
    const set = new Set<string>()
    slots.forEach((slot, index) => {
      const result = overrideQueries[index]
      const items = result?.data?.data ?? []
      if (items.some((o) => o.active)) set.add(slot.id)
    })
    return set
  }, [slots, overrideQueries])
  const brochure =
    media.find((item) => item.isBrochure && item.isBrochureCurrent) ??
    media.find((item) => item.isBrochure) ??
    null
  const galleryMedia = media.filter((item) => !item.isBrochure)

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
        onAddBooking={() =>
          void navigate({
            to: "/bookings/$id",
            params: { id: "new" },
            search: { productId: id },
          })
        }
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
            media={galleryMedia}
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
            slotIdsWithOverrides={slotIdsWithOverrides}
            onCreate={dialogs.departure.openNew}
            onEdit={dialogs.departure.openEdit}
            onOverridePrice={dialogs.departureOverride.openEdit}
            onManageAvailability={(slot) =>
              void navigate({ to: "/availability/$id", params: { id: slot.id } })
            }
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

          <ProductOptionsSection
            productId={id}
            renderOptionDetails={(option) => (
              <div className="flex flex-col gap-4">
                <PricingPanel
                  productId={id}
                  optionId={option.id}
                  productCurrency={product.sellCurrency}
                />
                <OptionResourceTemplatesPanel productId={id} optionId={option.id} />
              </div>
            )}
          />

          <ProductExtrasSection productId={id} />

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

          <ProductActionLedgerCard productId={id} />

          <ProductBrochureSection
            brochure={brochure}
            isGenerating={mutations.generateBrochure.isPending}
            onGenerate={() => mutations.generateBrochure.mutate()}
          />
        </div>
      </div>

      {/* Dialogs */}
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

      <DeparturePricingOverrideDialog
        open={dialogs.departureOverride.open}
        onOpenChange={dialogs.departureOverride.setOpen}
        departureId={dialogs.departureOverride.editing?.id ?? null}
        optionId={dialogs.departureOverride.editing?.optionId ?? null}
        onSuccess={() => {
          dialogs.departureOverride.close()
        }}
      />
    </div>
  )
}
