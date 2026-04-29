import type { ChannelContractRow } from "@voyantjs/distribution-react"

export type CancellationOwner = ChannelContractRow["cancellationOwner"]

export type RegistryDistributionEntity =
  | "channel"
  | "contract"
  | "commissionRule"
  | "mapping"
  | "bookingLink"
  | "webhookEvent"

export type RegistryDistributionMessages = {
  common: {
    cancel: string
    create: string
    save: string
    delete: string
    clearSelection: string
    backToDistribution: string
    loading: string
    none: string
    openEnded: string
    noReference: string
    unmappedStatus: string
    yes: string
    active: string
    inactive: string
    selectionSummary: string
    resultSummary: string
    deleteSummary: string
    createdLabel: string
    updatedLabel: string
    channelLabel: string
    contractLabel: string
    productLabel: string
    bookingLabel: string
    supplierLabel: string
    entities: Record<
      RegistryDistributionEntity,
      {
        one: string
        other: string
      }
    >
    cancellationOwnerLabels: Record<CancellationOwner, string>
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
  tabs: {
    channels: {
      title: string
      description: string
      actionLabel: string
      empty: string
      actions: {
        activate: {
          button: string
          confirm: string
          title: string
          description: string
        }
        archive: {
          button: string
          confirm: string
          title: string
          description: string
        }
        delete: {
          button: string
          confirm: string
          title: string
          description: string
        }
      }
    }
    contracts: {
      title: string
      description: string
      actionLabel: string
      empty: string
      actions: {
        activate: {
          button: string
          confirm: string
          title: string
          description: string
        }
        expire: {
          button: string
          confirm: string
          title: string
          description: string
        }
        delete: {
          button: string
          confirm: string
          title: string
          description: string
        }
      }
    }
    commissions: {
      title: string
      description: string
      actionLabel: string
      empty: string
      actions: {
        delete: {
          button: string
          confirm: string
          title: string
          description: string
        }
      }
    }
    mappings: {
      title: string
      description: string
      actionLabel: string
      empty: string
      actions: {
        activate: {
          button: string
          confirm: string
          title: string
          description: string
        }
        deactivate: {
          button: string
          confirm: string
          title: string
          description: string
        }
        delete: {
          button: string
          confirm: string
          title: string
          description: string
        }
      }
    }
    bookingLinks: {
      title: string
      description: string
      actionLabel: string
      empty: string
      actions: {
        delete: {
          button: string
          confirm: string
          title: string
          description: string
        }
      }
    }
    webhooks: {
      title: string
      description: string
      actionLabel: string
      empty: string
      actions: {
        markProcessed: {
          button: string
          confirm: string
          title: string
          description: string
        }
        ignore: {
          button: string
          confirm: string
          title: string
          description: string
        }
        delete: {
          button: string
          confirm: string
          title: string
          description: string
        }
      }
    }
  }
  dialogs: {
    channel: {
      titleNew: string
      titleEdit: string
      create: string
      save: string
      validation: {
        nameRequired: string
      }
      fields: {
        name: string
        kind: string
        status: string
        website: string
        contactName: string
        contactEmail: string
        metadataJson: string
      }
      placeholders: {
        name: string
        website: string
        contactName: string
        contactEmail: string
        metadataJson: string
      }
    }
    contract: {
      titleNew: string
      titleEdit: string
      create: string
      save: string
      validation: {
        channelRequired: string
        startsAtRequired: string
      }
      fields: {
        channel: string
        supplier: string
        status: string
        startsAt: string
        endsAt: string
        paymentOwner: string
        cancellationOwner: string
        settlementTerms: string
        notes: string
      }
      placeholders: {
        selectChannel: string
        noSupplier: string
        startsAt: string
        endsAt: string
        settlementTerms: string
        notes: string
      }
    }
    commissionRule: {
      titleNew: string
      titleEdit: string
      create: string
      save: string
      validation: {
        contractRequired: string
      }
      fields: {
        contract: string
        scope: string
        product: string
        commissionType: string
        amountCents: string
        percentBasisPoints: string
        externalRateId: string
        externalCategoryId: string
        validFrom: string
        validTo: string
      }
      placeholders: {
        selectContract: string
        noProduct: string
        externalRateId: string
        externalCategoryId: string
        validFrom: string
        validTo: string
      }
    }
    mapping: {
      titleNew: string
      titleEdit: string
      create: string
      save: string
      validation: {
        channelRequired: string
        productRequired: string
        externalProductRequired: string
      }
      fields: {
        channel: string
        product: string
        externalProductId: string
        externalRateId: string
        externalCategoryId: string
        activeTitle: string
        activeDescription: string
      }
      placeholders: {
        selectChannel: string
        selectProduct: string
        externalProductId: string
        externalRateId: string
        externalCategoryId: string
      }
    }
    bookingLink: {
      titleNew: string
      titleEdit: string
      create: string
      save: string
      validation: {
        channelRequired: string
        bookingRequired: string
      }
      fields: {
        channel: string
        booking: string
        externalBookingId: string
        externalReference: string
        externalStatus: string
        bookedAtExternal: string
        lastSyncedAt: string
      }
      placeholders: {
        selectChannel: string
        selectBooking: string
        externalBookingId: string
        externalReference: string
        externalStatus: string
        bookedAtExternal: string
        lastSyncedAt: string
      }
    }
    webhookEvent: {
      titleNew: string
      titleEdit: string
      create: string
      save: string
      validation: {
        channelRequired: string
        eventTypeRequired: string
        payloadRequired: string
      }
      fields: {
        channel: string
        eventType: string
        externalEventId: string
        payloadJson: string
        receivedAt: string
        processedAt: string
        status: string
        errorMessage: string
      }
      placeholders: {
        selectChannel: string
        eventType: string
        externalEventId: string
        receivedAt: string
        processedAt: string
        errorMessage: string
      }
    }
  }
  details: {
    channel: {
      notFound: string
      title: string
      deleteConfirm: string
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
    contract: {
      notFound: string
      title: string
      deleteConfirm: string
      deleteButton: string
      openChannel: string
      sections: {
        details: string
        notes: string
        commissionRules: string
      }
      labels: {
        supplier: string
        endsAt: string
        paymentOwner: string
        cancellationOwner: string
        settlementTerms: string
        notes: string
        amount: string
        basisPoints: string
        rate: string
        category: string
        valid: string
      }
      empty: {
        commissionRules: string
      }
    }
    commissionRule: {
      notFound: string
      title: string
      deleteConfirm: string
      deleteButton: string
      openContract: string
      openProduct: string
      sections: {
        details: string
      }
      labels: {
        amount: string
        basisPoints: string
        externalRate: string
        externalCategory: string
        valid: string
      }
    }
    mapping: {
      notFound: string
      title: string
      deleteConfirm: string
      deleteButton: string
      openChannel: string
      openProduct: string
      sections: {
        details: string
      }
      labels: {
        externalProduct: string
        externalRate: string
        externalCategory: string
      }
    }
    bookingLink: {
      notFound: string
      title: string
      deleteConfirm: string
      deleteButton: string
      openChannel: string
      openBooking: string
      sections: {
        details: string
      }
      labels: {
        externalBooking: string
        reference: string
        bookedAtExternal: string
        lastSynced: string
      }
    }
    webhookEvent: {
      notFound: string
      title: string
      deleteConfirm: string
      deleteButton: string
      openChannel: string
      sections: {
        details: string
        payload: string
      }
      labels: {
        externalEvent: string
        received: string
        processed: string
        error: string
      }
    }
  }
}
