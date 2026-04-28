import type { ColumnDef, OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import {
  formatSelectionLabel,
  labelById,
  type ProductOption,
  type ResourceAllocationRow,
  type ResourcePoolRow,
  type ResourceRow,
  type SupplierOption,
} from "@voyantjs/resources-react"
import { Badge, Button, ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { ExternalLink } from "lucide-react"
import { ResourcesSectionHeader } from "./resources-section-header"

type BulkFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  noun: string
  payload: Record<string, unknown>
  successVerb: string
  clearSelection: () => void
}) => Promise<void>

type DeleteFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  noun: string
  clearSelection: () => void
}) => Promise<void>

const resourceColumns = (
  suppliers: SupplierOption[],
  onView: (resourceId: string) => void,
): ColumnDef<ResourceRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Resource" />,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Kind" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.kind}
      </Badge>
    ),
  },
  {
    accessorKey: "supplierId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
    cell: ({ row }) => labelById(suppliers, row.original.supplierId),
  },
  {
    accessorKey: "capacity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Capacity" />,
    cell: ({ row }) => row.original.capacity ?? "-",
  },
  {
    accessorKey: "active",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "view",
    header: "View",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open
      </Button>
    ),
  },
]

const poolColumns = (
  products: ProductOption[],
  onView: (poolId: string) => void,
): ColumnDef<ResourcePoolRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pool" />,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Kind" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.kind}
      </Badge>
    ),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "sharedCapacity",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Shared Capacity" />,
    cell: ({ row }) => row.original.sharedCapacity ?? "-",
  },
  {
    id: "view",
    header: "View",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open
      </Button>
    ),
  },
]

const allocationColumns = (
  pools: ResourcePoolRow[],
  products: ProductOption[],
  onView: (allocationId: string) => void,
): ColumnDef<ResourceAllocationRow>[] => [
  {
    accessorKey: "poolId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pool" />,
    cell: ({ row }) => labelById(pools, row.original.poolId),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "allocationMode",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Mode" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.allocationMode}
      </Badge>
    ),
  },
  {
    accessorKey: "quantityRequired",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Qty Required" />,
  },
  {
    accessorKey: "priority",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Priority" />,
  },
  {
    id: "view",
    header: "View",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Open
      </Button>
    ),
  },
]

export function ResourcesTab(props: {
  suppliers: SupplierOption[]
  filteredResources: ResourceRow[]
  resourceSelection: RowSelectionState
  setResourceSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (resourceId: string) => void
  onEdit: (row: ResourceRow) => void
}) {
  return (
    <TabsContent value="resources" className="space-y-4">
      <ResourcesSectionHeader
        title="Resources"
        description="Guides, vehicles, rooms, and other assignable assets."
        actionLabel="New Resource"
        onAction={props.onCreate}
      />
      <DataTable
        columns={resourceColumns(props.suppliers, props.onOpenRoute)}
        data={props.filteredResources}
        emptyMessage="No resources match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.resourceSelection}
        onRowSelectionChange={props.setResourceSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Activate"
              confirmLabel="Activate Resources"
              title={`Activate ${formatSelectionLabel(selectedRows.length, "resource")}?`}
              description="This makes the selected resources available again for assignment and planning."
              disabled={props.bulkActionTarget === "resources-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/resources",
                  target: "resources-activate",
                  noun: "resource",
                  payload: { active: true },
                  successVerb: "Activated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Deactivate"
              confirmLabel="Deactivate Resources"
              title={`Deactivate ${formatSelectionLabel(selectedRows.length, "resource")}?`}
              description="This preserves the selected resources but removes them from active operational use."
              disabled={props.bulkActionTarget === "resources-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/resources",
                  target: "resources-deactivate",
                  noun: "resource",
                  payload: { active: false },
                  successVerb: "Deactivated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Resources"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "resource")}?`}
              description="This permanently removes the selected resources. Use Deactivate if you only need to take them out of rotation."
              disabled={props.bulkActionTarget === "resources-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/resources",
                  target: "resources-delete",
                  noun: "resource",
                  clearSelection,
                })
              }
            />
          </SelectionActionBar>
        )}
        onRowClick={(row) => props.onEdit(row.original)}
      />
    </TabsContent>
  )
}

export function PoolsTab(props: {
  products: ProductOption[]
  filteredPools: ResourcePoolRow[]
  poolSelection: RowSelectionState
  setPoolSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (poolId: string) => void
  onEdit: (row: ResourcePoolRow) => void
}) {
  return (
    <TabsContent value="pools" className="space-y-4">
      <ResourcesSectionHeader
        title="Pools"
        description="Shared capacity groups by product or operational need."
        actionLabel="New Pool"
        onAction={props.onCreate}
      />
      <DataTable
        columns={poolColumns(props.products, props.onOpenRoute)}
        data={props.filteredPools}
        emptyMessage="No pools match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.poolSelection}
        onRowSelectionChange={props.setPoolSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Activate"
              confirmLabel="Activate Pools"
              title={`Activate ${formatSelectionLabel(selectedRows.length, "pool")}?`}
              description="This re-enables the selected resource pools for live capacity planning."
              disabled={props.bulkActionTarget === "pools-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/pools",
                  target: "pools-activate",
                  noun: "pool",
                  payload: { active: true },
                  successVerb: "Activated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Deactivate"
              confirmLabel="Deactivate Pools"
              title={`Deactivate ${formatSelectionLabel(selectedRows.length, "pool")}?`}
              description="This keeps the selected pools for reference but removes them from active planning."
              disabled={props.bulkActionTarget === "pools-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/pools",
                  target: "pools-deactivate",
                  noun: "pool",
                  payload: { active: false },
                  successVerb: "Deactivated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Pools"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "pool")}?`}
              description="This permanently removes the selected pools and any pool-level grouping they provide."
              disabled={props.bulkActionTarget === "pools-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/pools",
                  target: "pools-delete",
                  noun: "pool",
                  clearSelection,
                })
              }
            />
          </SelectionActionBar>
        )}
        onRowClick={(row) => props.onEdit(row.original)}
      />
    </TabsContent>
  )
}

export function AllocationsTab(props: {
  pools: ResourcePoolRow[]
  products: ProductOption[]
  filteredAllocations: ResourceAllocationRow[]
  allocationSelection: RowSelectionState
  setAllocationSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (allocationId: string) => void
  onEdit: (row: ResourceAllocationRow) => void
}) {
  return (
    <TabsContent value="allocations" className="space-y-4">
      <ResourcesSectionHeader
        title="Allocations"
        description="Attach pools to products, rules, and start times."
        actionLabel="New Allocation"
        onAction={props.onCreate}
      />
      <DataTable
        columns={allocationColumns(props.pools, props.products, props.onOpenRoute)}
        data={props.filteredAllocations}
        emptyMessage="No allocations match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.allocationSelection}
        onRowSelectionChange={props.setAllocationSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Allocations"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "allocation")}?`}
              description="This permanently removes the selected allocation rules from resource planning."
              disabled={props.bulkActionTarget === "allocations-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/allocations",
                  target: "allocations-delete",
                  noun: "allocation",
                  clearSelection,
                })
              }
            />
          </SelectionActionBar>
        )}
        onRowClick={(row) => props.onEdit(row.original)}
      />
    </TabsContent>
  )
}
