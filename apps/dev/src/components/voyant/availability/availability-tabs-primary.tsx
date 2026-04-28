import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { SectionHeader } from "./availability-dialogs"
import type {
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  ProductOption,
} from "./availability-shared"
import {
  formatSelectionLabel,
  ruleColumns,
  slotColumns,
  startTimeColumns,
} from "./availability-shared"

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

export function AvailabilitySlotsTab(props: {
  products: ProductOption[]
  filteredSlots: AvailabilitySlotRow[]
  slotSelection: RowSelectionState
  setSlotSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (slotId: string) => void
  onEdit: (row: AvailabilitySlotRow) => void
}) {
  return (
    <TabsContent value="slots" className="space-y-4">
      <SectionHeader
        title="Departure Slots"
        description="Dated availability instances with live capacity and cutoff state."
        actionLabel="New Slot"
        onAction={props.onCreate}
      />
      <DataTable
        columns={slotColumns(props.products, props.onOpenRoute)}
        data={props.filteredSlots}
        emptyMessage="No slots match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.slotSelection}
        onRowSelectionChange={props.setSlotSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Open"
              confirmLabel="Open Slots"
              title={`Open ${formatSelectionLabel(selectedRows.length, "slot")}?`}
              description="This will mark the selected departures as open and bookable again."
              disabled={props.bulkActionTarget === "slots-open"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/slots",
                  target: "slots-open",
                  noun: "slot",
                  payload: { status: "open" },
                  successVerb: "Opened",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Close"
              confirmLabel="Close Slots"
              title={`Close ${formatSelectionLabel(selectedRows.length, "slot")}?`}
              description="This keeps the selected departures in place but stops them from being bookable."
              disabled={props.bulkActionTarget === "slots-close"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/slots",
                  target: "slots-close",
                  noun: "slot",
                  payload: { status: "closed" },
                  successVerb: "Closed",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Slots"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "slot")}?`}
              description="This permanently removes the selected departures. Use Close if you only need to stop new bookings."
              disabled={props.bulkActionTarget === "slots-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/slots",
                  target: "slots-delete",
                  noun: "slot",
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

export function AvailabilityRulesTab(props: {
  products: ProductOption[]
  filteredRules: AvailabilityRuleRow[]
  ruleSelection: RowSelectionState
  setRuleSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (ruleId: string) => void
  onEdit: (row: AvailabilityRuleRow) => void
}) {
  return (
    <TabsContent value="rules" className="space-y-4">
      <SectionHeader
        title="Availability Rules"
        description="Recurring operating patterns, timezone, cutoff, and baseline capacity."
        actionLabel="New Rule"
        onAction={props.onCreate}
      />
      <DataTable
        columns={ruleColumns(props.products, props.onOpenRoute)}
        data={props.filteredRules}
        emptyMessage="No rules match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.ruleSelection}
        onRowSelectionChange={props.setRuleSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Activate"
              confirmLabel="Activate Rules"
              title={`Activate ${formatSelectionLabel(selectedRows.length, "rule")}?`}
              description="This enables the selected availability rules for scheduling and downstream operations."
              disabled={props.bulkActionTarget === "rules-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-activate",
                  noun: "rule",
                  payload: { active: true },
                  successVerb: "Activated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Deactivate"
              confirmLabel="Deactivate Rules"
              title={`Deactivate ${formatSelectionLabel(selectedRows.length, "rule")}?`}
              description="This keeps the rules for reference but removes them from active operating coverage."
              disabled={props.bulkActionTarget === "rules-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-deactivate",
                  noun: "rule",
                  payload: { active: false },
                  successVerb: "Deactivated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Rules"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "rule")}?`}
              description="This permanently removes the selected availability rules and any rule-specific operating setup."
              disabled={props.bulkActionTarget === "rules-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-delete",
                  noun: "rule",
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

export function AvailabilityStartTimesTab(props: {
  products: ProductOption[]
  filteredStartTimes: AvailabilityStartTimeRow[]
  startTimeSelection: RowSelectionState
  setStartTimeSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (startTimeId: string) => void
  onEdit: (row: AvailabilityStartTimeRow) => void
}) {
  return (
    <TabsContent value="start-times" className="space-y-4">
      <SectionHeader
        title="Start Times"
        description="Bookable departure times attached to products."
        actionLabel="New Start Time"
        onAction={props.onCreate}
      />
      <DataTable
        columns={startTimeColumns(props.products, props.onOpenRoute)}
        data={props.filteredStartTimes}
        emptyMessage="No start times match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.startTimeSelection}
        onRowSelectionChange={props.setStartTimeSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Activate"
              confirmLabel="Activate Start Times"
              title={`Activate ${formatSelectionLabel(selectedRows.length, "start time")}?`}
              description="This makes the selected departure times available again anywhere they are referenced."
              disabled={props.bulkActionTarget === "start-times-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-activate",
                  noun: "start time",
                  payload: { active: true },
                  successVerb: "Activated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Deactivate"
              confirmLabel="Deactivate Start Times"
              title={`Deactivate ${formatSelectionLabel(selectedRows.length, "start time")}?`}
              description="This keeps the selected times for reference but removes them from active operating use."
              disabled={props.bulkActionTarget === "start-times-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-deactivate",
                  noun: "start time",
                  payload: { active: false },
                  successVerb: "Deactivated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Start Times"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "start time")}?`}
              description="This permanently removes the selected departure times from the catalog."
              disabled={props.bulkActionTarget === "start-times-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-delete",
                  noun: "start time",
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
