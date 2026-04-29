import type {
  ResourceAllocationRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
} from "@voyantjs/resources-react"

export type ResourceKind = ResourceRow["kind"]
export type AllocationMode = ResourceAllocationRow["allocationMode"]
export type AssignmentStatus = ResourceSlotAssignmentRow["status"]

type SelectionNoun = {
  singular: string
  plural: string
}

type BulkActionMessages = {
  buttonLabel: string
  confirmLabel: string
  title: string
  description: string
  successVerb: string
}

export type ResourcesUiMessages = {
  common: {
    open: string
    view: string
    cancel: string
    clearSelection: string
    clearFilters: string
    selectionSummary: string
    selectionLabel: string
    slotLabel: string
    dateTimeFallback: string
    resourceKindLabels: Record<ResourceKind, string>
    allocationModeLabels: Record<AllocationMode, string>
    assignmentStatusLabels: Record<AssignmentStatus, string>
    active: string
    inactive: string
    allKinds: string
    selectionNouns: {
      resource: SelectionNoun
      pool: SelectionNoun
      allocation: SelectionNoun
      assignment: SelectionNoun
      closeout: SelectionNoun
    }
  }
  overview: {
    metrics: {
      activeResources: {
        title: string
        description: string
      }
      activePools: {
        title: string
        description: string
      }
      liveAssignments: {
        title: string
        description: string
      }
      closeouts: {
        title: string
        description: string
      }
    }
    assignmentGaps: {
      title: string
      empty: string
      statusBooking: string
    }
    ownershipGaps: {
      title: string
      empty: string
      detail: string
    }
    filters: {
      searchPlaceholder: string
      allKindsPlaceholder: string
    }
    labels: {
      status: string
      booking: string
      capacity: string
      noSupplierAssigned: string
    }
  }
  tabsPrimary: {
    columns: {
      resources: {
        name: string
        kind: string
        supplier: string
        capacity: string
        status: string
        view: string
      }
      pools: {
        name: string
        kind: string
        product: string
        sharedCapacity: string
        view: string
      }
      allocations: {
        pool: string
        product: string
        mode: string
        quantityRequired: string
        priority: string
        view: string
      }
    }
    sections: {
      resources: {
        title: string
        description: string
        actionLabel: string
        emptyMessage: string
        actions: {
          activate: BulkActionMessages
          deactivate: BulkActionMessages
          delete: BulkActionMessages
        }
      }
      pools: {
        title: string
        description: string
        actionLabel: string
        emptyMessage: string
        actions: {
          activate: BulkActionMessages
          deactivate: BulkActionMessages
          delete: BulkActionMessages
        }
      }
      allocations: {
        title: string
        description: string
        actionLabel: string
        emptyMessage: string
        actions: {
          delete: BulkActionMessages
        }
      }
    }
  }
  tabsSecondary: {
    columns: {
      assignments: {
        slot: string
        resource: string
        booking: string
        status: string
        released: string
        view: string
      }
      closeouts: {
        resource: string
        date: string
        starts: string
        ends: string
        reason: string
      }
    }
    sections: {
      assignments: {
        title: string
        description: string
        actionLabel: string
        emptyMessage: string
        actions: {
          assign: BulkActionMessages
          release: BulkActionMessages
          delete: BulkActionMessages
        }
      }
      closeouts: {
        title: string
        description: string
        actionLabel: string
        emptyMessage: string
        actions: {
          delete: BulkActionMessages
        }
      }
    }
  }
}
