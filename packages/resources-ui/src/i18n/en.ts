import type { ResourcesUiMessages } from "./messages"

export const resourcesUiEn: ResourcesUiMessages = {
  common: {
    open: "Open",
    view: "View",
    cancel: "Cancel",
    clearSelection: "Clear Selection",
    clearFilters: "Clear Filters",
    selectionSummary: "{count} selected",
    selectionLabel: "{count} {noun}",
    slotLabel: "{date} · {time}",
    dateTimeFallback: "-",
    resourceKindLabels: {
      guide: "Guide",
      vehicle: "Vehicle",
      room: "Room",
      boat: "Boat",
      equipment: "Equipment",
      other: "Other",
    },
    allocationModeLabels: {
      shared: "Shared",
      exclusive: "Exclusive",
    },
    assignmentStatusLabels: {
      reserved: "Reserved",
      assigned: "Assigned",
      released: "Released",
      cancelled: "Cancelled",
      completed: "Completed",
    },
    active: "Active",
    inactive: "Inactive",
    allKinds: "All kinds",
    selectionNouns: {
      resource: { singular: "resource", plural: "resources" },
      pool: { singular: "pool", plural: "pools" },
      allocation: { singular: "allocation", plural: "allocations" },
      assignment: { singular: "assignment", plural: "assignments" },
      closeout: { singular: "closeout", plural: "closeouts" },
    },
  },
  overview: {
    metrics: {
      activeResources: {
        title: "Active Resources",
        description: "Assignable assets ready for use",
      },
      activePools: {
        title: "Active Pools",
        description: "Shared-capacity pools live",
      },
      liveAssignments: {
        title: "Live Assignments",
        description: "Reserved or assigned slot coverage",
      },
      closeouts: {
        title: "Closeouts",
        description: "Active maintenance or conflict blocks",
      },
    },
    assignmentGaps: {
      title: "Assignment Gaps",
      empty: "Every live reservation has a named resource.",
      statusBooking: "Status: {status} · Booking: {booking}",
    },
    ownershipGaps: {
      title: "Ownership Gaps",
      empty: "Every resource is linked to a supplier.",
      detail: "{kind} · Capacity {capacity} · No supplier assigned",
    },
    filters: {
      searchPlaceholder: "Search resources...",
      allKindsPlaceholder: "All kinds",
    },
    labels: {
      status: "Status",
      booking: "Booking",
      capacity: "Capacity",
      noSupplierAssigned: "No supplier assigned",
    },
  },
  tabsPrimary: {
    columns: {
      resources: {
        name: "Resource",
        kind: "Kind",
        supplier: "Supplier",
        capacity: "Capacity",
        status: "Status",
        view: "View",
      },
      pools: {
        name: "Pool",
        kind: "Kind",
        product: "Product",
        sharedCapacity: "Shared Capacity",
        view: "View",
      },
      allocations: {
        pool: "Pool",
        product: "Product",
        mode: "Mode",
        quantityRequired: "Qty Required",
        priority: "Priority",
        view: "View",
      },
    },
    sections: {
      resources: {
        title: "Resources",
        description: "Guides, vehicles, rooms, and other assignable assets.",
        actionLabel: "New Resource",
        emptyMessage: "No resources match the current filters.",
        actions: {
          activate: {
            buttonLabel: "Activate",
            confirmLabel: "Activate Resources",
            title: "Activate {selection}?",
            description:
              "This makes the selected resources available again for assignment and planning.",
            successVerb: "Activated",
          },
          deactivate: {
            buttonLabel: "Deactivate",
            confirmLabel: "Deactivate Resources",
            title: "Deactivate {selection}?",
            description:
              "This preserves the selected resources but removes them from active operational use.",
            successVerb: "Deactivated",
          },
          delete: {
            buttonLabel: "Delete Selected",
            confirmLabel: "Delete Resources",
            title: "Delete {selection}?",
            description:
              "This permanently removes the selected resources. Use Deactivate if you only need to take them out of rotation.",
            successVerb: "Deleted",
          },
        },
      },
      pools: {
        title: "Pools",
        description: "Shared capacity groups by product or operational need.",
        actionLabel: "New Pool",
        emptyMessage: "No pools match the current filters.",
        actions: {
          activate: {
            buttonLabel: "Activate",
            confirmLabel: "Activate Pools",
            title: "Activate {selection}?",
            description: "This re-enables the selected resource pools for live capacity planning.",
            successVerb: "Activated",
          },
          deactivate: {
            buttonLabel: "Deactivate",
            confirmLabel: "Deactivate Pools",
            title: "Deactivate {selection}?",
            description:
              "This keeps the selected pools for reference but removes them from active planning.",
            successVerb: "Deactivated",
          },
          delete: {
            buttonLabel: "Delete Selected",
            confirmLabel: "Delete Pools",
            title: "Delete {selection}?",
            description:
              "This permanently removes the selected pools and any pool-level grouping they provide.",
            successVerb: "Deleted",
          },
        },
      },
      allocations: {
        title: "Allocations",
        description: "Attach pools to products, rules, and start times.",
        actionLabel: "New Allocation",
        emptyMessage: "No allocations match the current filters.",
        actions: {
          delete: {
            buttonLabel: "Delete Selected",
            confirmLabel: "Delete Allocations",
            title: "Delete {selection}?",
            description:
              "This permanently removes the selected allocation rules from resource planning.",
            successVerb: "Deleted",
          },
        },
      },
    },
  },
  tabsSecondary: {
    columns: {
      assignments: {
        slot: "Slot",
        resource: "Resource",
        booking: "Booking",
        status: "Status",
        released: "Released",
        view: "View",
      },
      closeouts: {
        resource: "Resource",
        date: "Date",
        starts: "Starts",
        ends: "Ends",
        reason: "Reason",
      },
    },
    sections: {
      assignments: {
        title: "Slot Assignments",
        description: "Reserve or assign specific resources against live slots and bookings.",
        actionLabel: "New Assignment",
        emptyMessage: "No assignments match the current filters.",
        actions: {
          assign: {
            buttonLabel: "Assign",
            confirmLabel: "Mark Assigned",
            title: "Mark {selection} as assigned?",
            description:
              "This marks the selected reservations as actively assigned without deleting any linkage.",
            successVerb: "Updated",
          },
          release: {
            buttonLabel: "Release",
            confirmLabel: "Release Assignments",
            title: "Release {selection}?",
            description:
              "This marks the selected reservations as released while keeping the assignment history intact.",
            successVerb: "Released",
          },
          delete: {
            buttonLabel: "Delete Selected",
            confirmLabel: "Delete Assignments",
            title: "Delete {selection}?",
            description:
              "This permanently removes the selected slot assignments. Use Release if you only need to free the resource.",
            successVerb: "Deleted",
          },
        },
      },
      closeouts: {
        title: "Resource Closeouts",
        description: "Block assets for maintenance, charter use, or operational conflicts.",
        actionLabel: "New Closeout",
        emptyMessage: "No closeouts match the current filters.",
        actions: {
          delete: {
            buttonLabel: "Delete Selected",
            confirmLabel: "Delete Closeouts",
            title: "Delete {selection}?",
            description:
              "This permanently removes the selected closeouts and may return the resources to operational use.",
            successVerb: "Deleted",
          },
        },
      },
    },
  },
}
