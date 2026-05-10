import type { DistributionUiMessages } from "./messages.js"

export const distributionUiEn = {
  common: {
    open: "Open",
    view: "View",
    cancel: "Cancel",
    create: "Create",
    save: "Save",
    delete: "Delete",
    clearFilters: "Clear Filters",
    clearSelection: "Clear selection",
    backToDistribution: "Back to Distribution",
    loading: "Loading...",
    none: "-",
    openEnded: "Open-ended",
    noReference: "No reference",
    unmappedStatus: "Unmapped status",
    yes: "Yes",
    searchPlaceholder: "Search distribution...",
    allChannels: "All channels",
    received: "Received",
    supplier: "Supplier",
    channelLabel: "Channel",
    contractLabel: "Contract",
    productLabel: "Product",
    bookingLabel: "Booking",
    supplierLabel: "Supplier",
    createdLabel: "Created",
    updatedLabel: "Updated",
    emptyValue: "-",
    dateTimeFallback: "Not available",
    active: "Active",
    inactive: "Inactive",
    selectionSummary: "{count} selected",
    resultSummary: "{verb} {countLabel}.",
    deleteSummary: "Deleted {countLabel}.",
    entities: {
      channel: { one: "channel", other: "channels" },
      contract: { one: "contract", other: "contracts" },
      commissionRule: { one: "commission rule", other: "commission rules" },
      mapping: { one: "mapping", other: "mappings" },
      bookingLink: { one: "booking link", other: "booking links" },
      webhookEvent: { one: "webhook event", other: "webhook events" },
    },
    cancellationOwnerLabels: {
      operator: "Operator",
      channel: "Channel",
      mixed: "Mixed",
    },
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
  page: {
    title: "Distribution",
    description: "Manage sales channels, commercial contracts, external mappings, and sync events.",
    tabs: {
      channels: "Channels",
      contracts: "Contracts",
      commissions: "Commission Rules",
      mappings: "Product Mappings",
      bookingLinks: "Booking Links",
      webhooks: "Webhook Events",
    },
    bulkVerbs: {
      activated: "Activated",
      archived: "Archived",
      deleted: "Deleted",
      expired: "Expired",
      deactivated: "Deactivated",
      processed: "Processed",
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
  tabs: {
    channels: {
      title: "Channels",
      description: "Sales partners, affiliates, OTAs, marketplaces, and direct channels.",
      actionLabel: "New Channel",
      empty: "No channels match the current filters.",
      actions: {
        activate: {
          button: "Activate",
          confirm: "Activate Channels",
          title: "Activate {countLabel}?",
          description: "This enables the selected channels for live distribution again.",
        },
        archive: {
          button: "Archive",
          confirm: "Archive Channels",
          title: "Archive {countLabel}?",
          description:
            "This keeps the selected channels for history but removes them from active commercial use.",
        },
        delete: {
          button: "Delete Selected",
          confirm: "Delete Channels",
          title: "Delete {countLabel}?",
          description:
            "This permanently removes the selected channels. Use Archive if you only need to retire them from active use.",
        },
      },
    },
    contracts: {
      title: "Contracts",
      description: "Commercial terms per channel and supplier relationship.",
      actionLabel: "New Contract",
      empty: "No contracts match the current filters.",
      actions: {
        activate: {
          button: "Activate",
          confirm: "Activate Contracts",
          title: "Activate {countLabel}?",
          description: "This marks the selected contracts as commercially active.",
        },
        expire: {
          button: "Expire",
          confirm: "Expire Contracts",
          title: "Expire {countLabel}?",
          description:
            "This preserves the selected contracts but marks them as no longer in force.",
        },
        delete: {
          button: "Delete Selected",
          confirm: "Delete Contracts",
          title: "Delete {countLabel}?",
          description:
            "This permanently removes the selected contracts and their commercial setup.",
        },
      },
    },
    commissions: {
      title: "Commission Rules",
      description: "Define booking, product, rate, and category-based commission logic.",
      actionLabel: "New Commission Rule",
      empty: "No commission rules match the current filters.",
      actions: {
        delete: {
          button: "Delete Selected",
          confirm: "Delete Commission Rules",
          title: "Delete {countLabel}?",
          description:
            "This permanently removes the selected commission rules from channel pricing.",
        },
      },
    },
    mappings: {
      title: "Product Mappings",
      description: "Map Voyant products to external channel catalog identifiers.",
      actionLabel: "New Mapping",
      empty: "No product mappings match the current filters.",
      actions: {
        activate: {
          button: "Activate",
          confirm: "Activate Mappings",
          title: "Activate {countLabel}?",
          description:
            "This re-enables the selected external product mappings for live channel use.",
        },
        deactivate: {
          button: "Deactivate",
          confirm: "Deactivate Mappings",
          title: "Deactivate {countLabel}?",
          description:
            "This keeps the selected mappings for reference but removes them from active sync/distribution.",
        },
        delete: {
          button: "Delete Selected",
          confirm: "Delete Mappings",
          title: "Delete {countLabel}?",
          description: "This permanently removes the selected external product mappings.",
        },
      },
    },
    bookingLinks: {
      title: "Booking Links",
      description: "Track external booking IDs and sync state for channel-originated bookings.",
      actionLabel: "New Booking Link",
      empty: "No booking links match the current filters.",
      actions: {
        delete: {
          button: "Delete Selected",
          confirm: "Delete Booking Links",
          title: "Delete {countLabel}?",
          description:
            "This permanently removes the selected external booking references and sync links.",
        },
      },
    },
    webhooks: {
      title: "Webhook Events",
      description: "Inspect ingested partner events and replay/problem cases.",
      actionLabel: "New Webhook Event",
      empty: "No webhook events match the current filters.",
      actions: {
        markProcessed: {
          button: "Mark Processed",
          confirm: "Mark Processed",
          title: "Mark {countLabel} as processed?",
          description:
            "This marks the selected events as processed and removes them from the active sync queue.",
        },
        ignore: {
          button: "Ignore",
          confirm: "Ignore Events",
          title: "Ignore {countLabel}?",
          description:
            "This keeps the selected events in history but marks them as intentionally ignored.",
        },
        delete: {
          button: "Delete Selected",
          confirm: "Delete Events",
          title: "Delete {countLabel}?",
          description: "This permanently removes the selected webhook events from the event log.",
        },
      },
    },
  },
} satisfies DistributionUiMessages
