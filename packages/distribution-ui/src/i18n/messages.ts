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
export type CancellationOwner = ChannelContractRow["cancellationOwner"]
export type CommissionScope = ChannelCommissionRuleRow["scope"]
export type CommissionType = ChannelCommissionRuleRow["commissionType"]
export type WebhookStatus = ChannelWebhookEventRow["status"]
export type DistributionEntity =
  | "channel"
  | "contract"
  | "commissionRule"
  | "mapping"
  | "bookingLink"
  | "webhookEvent"

export type DistributionUiMessages = {
  common: {
    open: string
    view: string
    cancel: string
    create: string
    save: string
    delete: string
    clearFilters: string
    clearSelection: string
    backToDistribution: string
    loading: string
    none: string
    openEnded: string
    noReference: string
    unmappedStatus: string
    yes: string
    searchPlaceholder: string
    allChannels: string
    received: string
    supplier: string
    channelLabel: string
    contractLabel: string
    productLabel: string
    bookingLabel: string
    supplierLabel: string
    createdLabel: string
    updatedLabel: string
    emptyValue: string
    dateTimeFallback: string
    active: string
    inactive: string
    selectionSummary: string
    resultSummary: string
    deleteSummary: string
    entities: Record<
      DistributionEntity,
      {
        one: string
        other: string
      }
    >
    cancellationOwnerLabels: Record<CancellationOwner, string>
    channelKindLabels: Record<ChannelKind, string>
    channelStatusLabels: Record<ChannelStatus, string>
    contractStatusLabels: Record<ContractStatus, string>
    paymentOwnerLabels: Record<PaymentOwner, string>
    commissionScopeLabels: Record<CommissionScope, string>
    commissionTypeLabels: Record<CommissionType, string>
    webhookStatusLabels: Record<WebhookStatus, string>
  }
  page: {
    title: string
    description: string
    tabs: {
      channels: string
      contracts: string
      commissions: string
      mappings: string
      bookingLinks: string
      webhooks: string
    }
    bulkVerbs: {
      activated: string
      archived: string
      deleted: string
      expired: string
      deactivated: string
      processed: string
      ignored: string
    }
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
  tabs: {
    channels: DistributionBulkTabMessages<"activate" | "archive" | "delete">
    contracts: DistributionBulkTabMessages<"activate" | "expire" | "delete">
    commissions: DistributionBulkTabMessages<"delete">
    mappings: DistributionBulkTabMessages<"activate" | "deactivate" | "delete">
    bookingLinks: DistributionBulkTabMessages<"delete">
    webhooks: DistributionBulkTabMessages<"markProcessed" | "ignore" | "delete">
  }
  details: {
    channel: {
      notFound: string
      title: string
      deleteConfirm: string
      deleteDescription: string
      deleteButton: string
      sections: {
        details: string
        metadata: string
        contracts: string
        mappings: string
        bookingLinks: string
        webhooks: string
      }
      labels: {
        website: string
        contactName: string
        contactEmail: string
        supplier: string
        payment: string
        cancellation: string
        externalProduct: string
        externalBooking: string
        reference: string
        lastSynced: string
        rate: string
        category: string
        booking: string
      }
      empty: {
        metadata: string
        contracts: string
        mappings: string
        bookingLinks: string
        webhooks: string
      }
    }
  }
}

type DistributionBulkTabMessages<TAction extends string> = {
  title: string
  description: string
  actionLabel: string
  empty: string
  actions: Record<
    TAction,
    {
      button: string
      confirm: string
      title: string
      description: string
    }
  >
}
