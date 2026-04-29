import type {
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ChannelRow,
  ChannelWebhookEventRow,
} from "@voyantjs/distribution-react"

export type ChannelKind = ChannelRow["kind"]
export type ChannelStatus = ChannelRow["status"]
export type ContractStatus = ChannelContractRow["status"]
export type PaymentOwner = ChannelContractRow["paymentOwner"]
export type CommissionScope = ChannelCommissionRuleRow["scope"]
export type CommissionType = ChannelCommissionRuleRow["commissionType"]
export type WebhookStatus = ChannelWebhookEventRow["status"]

export type DistributionUiMessages = {
  common: {
    open: string
    view: string
    clearFilters: string
    searchPlaceholder: string
    allChannels: string
    received: string
    supplier: string
    emptyValue: string
    dateTimeFallback: string
    active: string
    inactive: string
    channelKindLabels: Record<ChannelKind, string>
    channelStatusLabels: Record<ChannelStatus, string>
    contractStatusLabels: Record<ContractStatus, string>
    paymentOwnerLabels: Record<PaymentOwner, string>
    commissionScopeLabels: Record<CommissionScope, string>
    commissionTypeLabels: Record<CommissionType, string>
    webhookStatusLabels: Record<WebhookStatus, string>
  }
  overview: {
    metrics: {
      activeChannels: {
        title: string
        description: string
      }
      activeContracts: {
        title: string
        description: string
      }
      activeMappings: {
        title: string
        description: string
      }
      syncQueue: {
        title: string
        description: string
      }
    }
    webhookQueue: {
      title: string
      empty: string
    }
    contractsToReview: {
      title: string
      empty: string
    }
    filters: {
      allChannelsPlaceholder: string
    }
  }
  tables: {
    channel: {
      channel: string
      kind: string
      status: string
      website: string
    }
    contract: {
      channel: string
      supplier: string
      status: string
      payment: string
      start: string
    }
    commission: {
      contract: string
      scope: string
      product: string
      type: string
      amount: string
    }
    mapping: {
      channel: string
      product: string
      externalProduct: string
      status: string
    }
    bookingLink: {
      channel: string
      booking: string
      externalBooking: string
      externalStatus: string
      synced: string
    }
    webhook: {
      channel: string
      eventType: string
      status: string
      received: string
      processed: string
    }
  }
}
