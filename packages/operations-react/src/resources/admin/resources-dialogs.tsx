"use client"

import type {
  BookingOption,
  ProductOption,
  ResourceAllocationRow,
  ResourceCloseoutRow,
  ResourcePoolRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  RuleOption,
  SlotOption,
  StartTimeOption,
  SupplierOption,
} from "../index.js"

import { ResourceAllocationDialog } from "./resources-dialog-allocation.js"
import { ResourceDialog, ResourcePoolDialog } from "./resources-dialogs-core.js"
import { ResourceCloseoutDialog, ResourceSlotAssignmentDialog } from "./resources-dialogs-ops.js"

export function ResourcesDialogs({
  resourceDialogOpen,
  setResourceDialogOpen,
  editingResource,
  poolDialogOpen,
  setPoolDialogOpen,
  editingPool,
  allocationDialogOpen,
  setAllocationDialogOpen,
  editingAllocation,
  assignmentDialogOpen,
  setAssignmentDialogOpen,
  editingAssignment,
  closeoutDialogOpen,
  setCloseoutDialogOpen,
  editingCloseout,
  suppliers,
  products,
  rules,
  startTimes,
  resources,
  pools,
  slots,
  bookings,
  refreshAll,
}: {
  resourceDialogOpen: boolean
  setResourceDialogOpen: (open: boolean) => void
  editingResource: ResourceRow | undefined
  poolDialogOpen: boolean
  setPoolDialogOpen: (open: boolean) => void
  editingPool: ResourcePoolRow | undefined
  allocationDialogOpen: boolean
  setAllocationDialogOpen: (open: boolean) => void
  editingAllocation: ResourceAllocationRow | undefined
  assignmentDialogOpen: boolean
  setAssignmentDialogOpen: (open: boolean) => void
  editingAssignment: ResourceSlotAssignmentRow | undefined
  closeoutDialogOpen: boolean
  setCloseoutDialogOpen: (open: boolean) => void
  editingCloseout: ResourceCloseoutRow | undefined
  suppliers: SupplierOption[]
  products: ProductOption[]
  rules: RuleOption[]
  startTimes: StartTimeOption[]
  resources: ResourceRow[]
  pools: ResourcePoolRow[]
  slots: SlotOption[]
  bookings: BookingOption[]
  refreshAll: () => Promise<void>
}) {
  return (
    <>
      <ResourceDialog
        open={resourceDialogOpen}
        onOpenChange={setResourceDialogOpen}
        resource={editingResource}
        suppliers={suppliers}
        onSuccess={() => {
          setResourceDialogOpen(false)
          void refreshAll()
        }}
      />
      <ResourcePoolDialog
        open={poolDialogOpen}
        onOpenChange={setPoolDialogOpen}
        pool={editingPool}
        products={products}
        onSuccess={() => {
          setPoolDialogOpen(false)
          void refreshAll()
        }}
      />
      <ResourceAllocationDialog
        open={allocationDialogOpen}
        onOpenChange={setAllocationDialogOpen}
        allocation={editingAllocation}
        pools={pools}
        products={products}
        rules={rules}
        startTimes={startTimes}
        onSuccess={() => {
          setAllocationDialogOpen(false)
          void refreshAll()
        }}
      />
      <ResourceSlotAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        assignment={editingAssignment}
        slots={slots}
        pools={pools}
        resources={resources}
        bookings={bookings}
        products={products}
        onSuccess={() => {
          setAssignmentDialogOpen(false)
          void refreshAll()
        }}
      />
      <ResourceCloseoutDialog
        open={closeoutDialogOpen}
        onOpenChange={setCloseoutDialogOpen}
        closeout={editingCloseout}
        resources={resources}
        onSuccess={() => {
          setCloseoutDialogOpen(false)
          void refreshAll()
        }}
      />
    </>
  )
}
