import type {
  BookingOption,
  ChannelBookingLinkRow,
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
  ProductOption,
  SupplierOption,
} from "@voyantjs/distribution-ui/components/distribution-shared"
import {
  ChannelBookingLinkDialog,
  ChannelCommissionRuleDialog,
  ChannelContractDialog,
  ChannelDialog,
  ChannelProductMappingDialog,
  ChannelWebhookEventDialog,
} from "./distribution-dialog-barrel"

export function DistributionDialogs({
  channelDialogOpen,
  setChannelDialogOpen,
  editingChannel,
  contractDialogOpen,
  setContractDialogOpen,
  editingContract,
  commissionDialogOpen,
  setCommissionDialogOpen,
  editingCommission,
  mappingDialogOpen,
  setMappingDialogOpen,
  editingMapping,
  bookingLinkDialogOpen,
  setBookingLinkDialogOpen,
  editingBookingLink,
  webhookDialogOpen,
  setWebhookDialogOpen,
  editingWebhook,
  channels,
  suppliers,
  contracts,
  products,
  bookings,
  refreshAll,
}: {
  channelDialogOpen: boolean
  setChannelDialogOpen: (open: boolean) => void
  editingChannel: ChannelRow | undefined
  contractDialogOpen: boolean
  setContractDialogOpen: (open: boolean) => void
  editingContract: ChannelContractRow | undefined
  commissionDialogOpen: boolean
  setCommissionDialogOpen: (open: boolean) => void
  editingCommission: ChannelCommissionRuleRow | undefined
  mappingDialogOpen: boolean
  setMappingDialogOpen: (open: boolean) => void
  editingMapping: ChannelProductMappingRow | undefined
  bookingLinkDialogOpen: boolean
  setBookingLinkDialogOpen: (open: boolean) => void
  editingBookingLink: ChannelBookingLinkRow | undefined
  webhookDialogOpen: boolean
  setWebhookDialogOpen: (open: boolean) => void
  editingWebhook: ChannelWebhookEventRow | undefined
  channels: ChannelRow[]
  suppliers: SupplierOption[]
  contracts: ChannelContractRow[]
  products: ProductOption[]
  bookings: BookingOption[]
  refreshAll: () => Promise<void>
}) {
  return (
    <>
      <ChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channel={editingChannel}
        onSuccess={() => {
          setChannelDialogOpen(false)
          void refreshAll()
        }}
      />
      <ChannelContractDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        contract={editingContract}
        channels={channels}
        suppliers={suppliers}
        onSuccess={() => {
          setContractDialogOpen(false)
          void refreshAll()
        }}
      />
      <ChannelCommissionRuleDialog
        open={commissionDialogOpen}
        onOpenChange={setCommissionDialogOpen}
        commissionRule={editingCommission}
        contracts={contracts}
        products={products}
        onSuccess={() => {
          setCommissionDialogOpen(false)
          void refreshAll()
        }}
      />
      <ChannelProductMappingDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        mapping={editingMapping}
        channels={channels}
        products={products}
        onSuccess={() => {
          setMappingDialogOpen(false)
          void refreshAll()
        }}
      />
      <ChannelBookingLinkDialog
        open={bookingLinkDialogOpen}
        onOpenChange={setBookingLinkDialogOpen}
        bookingLink={editingBookingLink}
        channels={channels}
        bookings={bookings}
        onSuccess={() => {
          setBookingLinkDialogOpen(false)
          void refreshAll()
        }}
      />
      <ChannelWebhookEventDialog
        open={webhookDialogOpen}
        onOpenChange={setWebhookDialogOpen}
        webhookEvent={editingWebhook}
        channels={channels}
        onSuccess={() => {
          setWebhookDialogOpen(false)
          void refreshAll()
        }}
      />
    </>
  )
}
