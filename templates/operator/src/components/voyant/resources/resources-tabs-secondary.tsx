import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/admin"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { ConfirmActionButton, SelectionActionBar } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { SectionHeader } from "@/components/voyant/resources/resources-section-header"
import { useAdminMessages } from "@/lib/admin-i18n"
import type {
  BookingOption,
  ResourceCloseoutRow,
  ResourceRow,
  ResourceSlotAssignmentRow,
  SlotOption,
} from "./resources-shared"
import {
  assignmentColumns,
  closeoutColumns,
  formatLocalizedSelectionLabel,
} from "./resources-shared"

type BulkFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  nounSingular: string
  nounPlural: string
  payload: Record<string, unknown>
  successVerb: string
  clearSelection: () => void
}) => Promise<void>

type DeleteFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  nounSingular: string
  nounPlural: string
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
  const messages = useAdminMessages()
  const assignmentsMessages = messages.resources.tabs.assignments
  return (
    <TabsContent value="assignments" className="space-y-4">
      <SectionHeader
        title={assignmentsMessages.title}
        description={assignmentsMessages.description}
        actionLabel={assignmentsMessages.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={assignmentColumns(
          props.slots,
          props.resources,
          props.bookings,
          props.onOpenRoute,
          messages,
        )}
        data={props.filteredAssignments}
        emptyMessage={assignmentsMessages.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.assignmentSelection}
        onRowSelectionChange={props.setAssignmentSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={assignmentsMessages.bulkAssignButton}
              confirmLabel={assignmentsMessages.bulkAssignConfirm}
              title={formatMessage(assignmentsMessages.bulkAssignTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.assignmentSingular,
                  messages.resources.nouns.assignmentPlural,
                ),
              })}
              description={assignmentsMessages.bulkAssignDescription}
              disabled={props.bulkActionTarget === "assignments-assigned"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/slot-assignments",
                  target: "assignments-assigned",
                  nounSingular: messages.resources.nouns.assignmentSingular,
                  nounPlural: messages.resources.nouns.assignmentPlural,
                  payload: { status: "assigned" },
                  successVerb: messages.resources.verbAssigned,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={assignmentsMessages.bulkReleaseButton}
              confirmLabel={assignmentsMessages.bulkReleaseConfirm}
              title={formatMessage(assignmentsMessages.bulkReleaseTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.assignmentSingular,
                  messages.resources.nouns.assignmentPlural,
                ),
              })}
              description={assignmentsMessages.bulkReleaseDescription}
              disabled={props.bulkActionTarget === "assignments-released"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/slot-assignments",
                  target: "assignments-released",
                  nounSingular: messages.resources.nouns.assignmentSingular,
                  nounPlural: messages.resources.nouns.assignmentPlural,
                  payload: { status: "released" },
                  successVerb: messages.resources.verbReleased,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={assignmentsMessages.bulkDeleteButton}
              confirmLabel={assignmentsMessages.bulkDeleteConfirm}
              title={formatMessage(assignmentsMessages.bulkDeleteTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.assignmentSingular,
                  messages.resources.nouns.assignmentPlural,
                ),
              })}
              description={assignmentsMessages.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "assignments-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/slot-assignments",
                  target: "assignments-delete",
                  nounSingular: messages.resources.nouns.assignmentSingular,
                  nounPlural: messages.resources.nouns.assignmentPlural,
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
  const messages = useAdminMessages()
  const closeoutsMessages = messages.resources.tabs.closeouts
  return (
    <TabsContent value="closeouts" className="space-y-4">
      <SectionHeader
        title={closeoutsMessages.title}
        description={closeoutsMessages.description}
        actionLabel={closeoutsMessages.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={closeoutColumns(props.resources, messages)}
        data={props.filteredCloseouts}
        emptyMessage={closeoutsMessages.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.closeoutSelection}
        onRowSelectionChange={props.setCloseoutSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={closeoutsMessages.bulkDeleteButton}
              confirmLabel={closeoutsMessages.bulkDeleteConfirm}
              title={formatMessage(closeoutsMessages.bulkDeleteTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.closeoutSingular,
                  messages.resources.nouns.closeoutPlural,
                ),
              })}
              description={closeoutsMessages.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "closeouts-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/closeouts",
                  target: "closeouts-delete",
                  nounSingular: messages.resources.nouns.closeoutSingular,
                  nounPlural: messages.resources.nouns.closeoutPlural,
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
