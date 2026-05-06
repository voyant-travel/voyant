import type { DistributionUiMessages } from "./messages.js"

export const distributionUiEn = {
  common: {
    open: "Open",
    view: "View",
    clearFilters: "Clear Filters",
    searchPlaceholder: "Search distribution...",
    allChannels: "All channels",
    received: "Received",
    supplier: "Supplier",
    emptyValue: "-",
    dateTimeFallback: "Not available",
    active: "Active",
    inactive: "Inactive",
    channelKindLabels: {
      direct: "Direct",
      affiliate: "Affiliate",
      ota: "OTA",
      reseller: "Reseller",
      marketplace: "Marketplace",
      api_partner: "API Partner",
      connect: "Connect",
    },
    channelStatusLabels: {
      active: "Active",
      inactive: "Inactive",
      pending: "Pending",
      archived: "Archived",
    },
    contractStatusLabels: {
      draft: "Draft",
      active: "Active",
      expired: "Expired",
      terminated: "Terminated",
    },
    paymentOwnerLabels: {
      operator: "Operator",
      channel: "Channel",
      split: "Split",
    },
    commissionScopeLabels: {
      booking: "Booking",
      product: "Product",
      rate: "Rate",
      category: "Category",
    },
    commissionTypeLabels: {
      fixed: "Fixed",
      percentage: "Percentage",
    },
    webhookStatusLabels: {
      pending: "Pending",
      processed: "Processed",
      failed: "Failed",
      ignored: "Ignored",
    },
  },
  overview: {
    metrics: {
      activeChannels: {
        title: "Active Channels",
        description: "Live sales and reseller endpoints",
      },
      activeContracts: {
        title: "Active Contracts",
        description: "Commercial agreements currently in force",
      },
      activeMappings: {
        title: "Active Mappings",
        description: "Products exposed to external channels",
      },
      syncQueue: {
        title: "Sync Queue",
        description: "Pending or failed inbound events",
      },
    },
    webhookQueue: {
      title: "Webhook Queue",
      empty: "No pending or failed events in the queue.",
    },
    contractsToReview: {
      title: "Contracts To Review",
      empty: "All contracts are currently active.",
    },
    filters: {
      allChannelsPlaceholder: "All channels",
    },
  },
  tables: {
    channel: {
      channel: "Channel",
      kind: "Kind",
      status: "Status",
      website: "Website",
    },
    contract: {
      channel: "Channel",
      supplier: "Supplier",
      status: "Status",
      payment: "Payment",
      start: "Start",
    },
    commission: {
      contract: "Contract",
      scope: "Scope",
      product: "Product",
      type: "Type",
      amount: "Amount",
    },
    mapping: {
      channel: "Channel",
      product: "Product",
      externalProduct: "External Product",
      status: "Status",
    },
    bookingLink: {
      channel: "Channel",
      booking: "Booking",
      externalBooking: "External Booking",
      externalStatus: "External Status",
      synced: "Synced",
    },
    webhook: {
      channel: "Channel",
      eventType: "Event Type",
      status: "Status",
      received: "Received",
      processed: "Processed",
    },
  },
} satisfies DistributionUiMessages
