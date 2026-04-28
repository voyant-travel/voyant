import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { ConfirmActionButton, SelectionActionBar } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { SectionHeader } from "@/components/voyant/resources/resources-section-header"
import type {
  BookingOption,
  ResourceCloseoutRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  SlotOption,
} from "./resources-shared"
import { assignmentColumns, closeoutColumns, formatSelectionLabel } from "./resources-shared"

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

export function AssignmentsTab(props: {
  slots: SlotOption[]
  resources: ResourceRow[]
  bookings: BookingOption[]
  filteredAssignments: ResourceSlotAssignmentRow[]
  assignmentSelection: RowSelectionState
  setAssignmentSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (assignmentId: string) => void
  onEdit: (row: ResourceSlotAssignmentRow) => void
}) {
  return (
    <TabsContent value="assignments" className="space-y-4">
      <SectionHeader
        title="Slot Assignments"
        description="Reserve or assign specific resources against live slots and bookings."
        actionLabel="New Assignment"
        onAction={props.onCreate}
      />
      <DataTable
        columns={assignmentColumns(props.slots, props.resources, props.bookings, props.onOpenRoute)}
        data={props.filteredAssignments}
        emptyMessage="No assignments match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.assignmentSelection}
        onRowSelectionChange={props.setAssignmentSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Assign"
              confirmLabel="Mark Assigned"
              title={`Mark ${formatSelectionLabel(selectedRows.length, "assignment")} as assigned?`}
              description="This marks the selected reservations as actively assigned without deleting any linkage."
              disabled={props.bulkActionTarget === "assignments-assigned"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/slot-assignments",
                  target: "assignments-assigned",
                  noun: "assignment",
                  payload: { status: "assigned" },
                  successVerb: "Updated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Release"
              confirmLabel="Release Assignments"
              title={`Release ${formatSelectionLabel(selectedRows.length, "assignment")}?`}
              description="This marks the selected reservations as released while keeping the assignment history intact."
              disabled={props.bulkActionTarget === "assignments-released"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/slot-assignments",
                  target: "assignments-released",
                  noun: "assignment",
                  payload: { status: "released" },
                  successVerb: "Released",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Assignments"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "assignment")}?`}
              description="This permanently removes the selected slot assignments. Use Release if you only need to free the resource."
              disabled={props.bulkActionTarget === "assignments-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/slot-assignments",
                  target: "assignments-delete",
                  noun: "assignment",
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

export function CloseoutsTab(props: {
  resources: ResourceRow[]
  filteredCloseouts: ResourceCloseoutRow[]
  closeoutSelection: RowSelectionState
  setCloseoutSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onEdit: (row: ResourceCloseoutRow) => void
}) {
  return (
    <TabsContent value="closeouts" className="space-y-4">
      <SectionHeader
        title="Resource Closeouts"
        description="Block assets for maintenance, charter use, or operational conflicts."
        actionLabel="New Closeout"
        onAction={props.onCreate}
      />
      <DataTable
        columns={closeoutColumns(props.resources)}
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
              description="This permanently removes the selected closeouts and may return the resources to operational use."
              disabled={props.bulkActionTarget === "closeouts-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/closeouts",
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
