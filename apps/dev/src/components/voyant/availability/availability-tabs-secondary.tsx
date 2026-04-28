import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { SectionHeader } from "./availability-dialogs"
import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  ProductOption,
} from "./availability-shared"
import { closeoutColumns, formatSelectionLabel, pickupPointColumns } from "./availability-shared"

type DeleteFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  noun: string
  clearSelection: () => void
}) => Promise<void>

type BulkFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  noun: string
  payload: Record<string, unknown>
  successVerb: string
  clearSelection: () => void
}) => Promise<void>

export function AvailabilityCloseoutsTab(props: {
  products: ProductOption[]
  filteredCloseouts: AvailabilityCloseoutRow[]
  closeoutSelection: RowSelectionState
  setCloseoutSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onEdit: (row: AvailabilityCloseoutRow) => void
}) {
  return (
    <TabsContent value="closeouts" className="space-y-4">
      <SectionHeader
        title="Closeouts"
        description="Block product-level or slot-level availability for specific dates."
        actionLabel="New Closeout"
        onAction={props.onCreate}
      />
      <DataTable
        columns={closeoutColumns(props.products)}
        data={props.filteredCloseouts}
        emptyMessage="No closeouts match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.closeoutSelection}
        onRowSelectionChange={props.setCloseoutSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Closeouts"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "closeout")}?`}
              description="This permanently removes the selected closeouts and can reopen blocked dates if no other restriction applies."
              disabled={props.bulkActionTarget === "closeouts-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/closeouts",
                  target: "closeouts-delete",
                  noun: "closeout",
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

export function AvailabilityPickupPointsTab(props: {
  products: ProductOption[]
  filteredPickupPoints: AvailabilityPickupPointRow[]
  pickupPointSelection: RowSelectionState
  setPickupPointSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onEdit: (row: AvailabilityPickupPointRow) => void
}) {
  return (
    <TabsContent value="pickup-points" className="space-y-4">
      <SectionHeader
        title="Pickup Points"
        description="Operational pickup locations by product."
        actionLabel="New Pickup Point"
        onAction={props.onCreate}
      />
      <DataTable
        columns={pickupPointColumns(props.products)}
        data={props.filteredPickupPoints}
        emptyMessage="No pickup points match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.pickupPointSelection}
        onRowSelectionChange={props.setPickupPointSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Activate"
              confirmLabel="Activate Pickup Points"
              title={`Activate ${formatSelectionLabel(selectedRows.length, "pickup point")}?`}
              description="This makes the selected pickup points available again for operational planning."
              disabled={props.bulkActionTarget === "pickup-points-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-activate",
                  noun: "pickup point",
                  payload: { active: true },
                  successVerb: "Activated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Deactivate"
              confirmLabel="Deactivate Pickup Points"
              title={`Deactivate ${formatSelectionLabel(selectedRows.length, "pickup point")}?`}
              description="This removes the selected pickup points from active use without deleting their history."
              disabled={props.bulkActionTarget === "pickup-points-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-deactivate",
                  noun: "pickup point",
                  payload: { active: false },
                  successVerb: "Deactivated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Pickup Points"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "pickup point")}?`}
              description="This permanently removes the selected pickup points from the product setup."
              disabled={props.bulkActionTarget === "pickup-points-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-delete",
                  noun: "pickup point",
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
