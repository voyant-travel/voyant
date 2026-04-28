import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { formatMessage } from "@voyantjs/voyant-admin"
import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  ProductOption,
} from "@/components/voyant/availability/availability-shared"
import {
  closeoutColumns,
  formatLocalizedSelectionLabel,
  pickupPointColumns,
} from "@/components/voyant/availability/availability-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { SectionHeader } from "./availability-dialogs"

type DeleteFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  nounSingular: string
  nounPlural: string
  clearSelection: () => void
}) => Promise<void>

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
  const messages = useAdminMessages()
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      messages.availability.nouns.closeoutSingular,
      messages.availability.nouns.closeoutPlural,
    )
  return (
    <TabsContent value="closeouts" className="space-y-4">
      <SectionHeader
        title={messages.availability.tabs.closeouts.title}
        description={messages.availability.tabs.closeouts.description}
        actionLabel={messages.availability.tabs.closeouts.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={closeoutColumns(props.products, messages)}
        data={props.filteredCloseouts}
        emptyMessage={messages.availability.tabs.closeouts.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.closeoutSelection}
        onRowSelectionChange={props.setCloseoutSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.closeouts.bulkDeleteButton}
              confirmLabel={messages.availability.tabs.closeouts.bulkDeleteConfirm}
              title={formatMessage(messages.availability.tabs.closeouts.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.closeouts.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "closeouts-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/closeouts",
                  target: "closeouts-delete",
                  nounSingular: messages.availability.nouns.closeoutSingular,
                  nounPlural: messages.availability.nouns.closeoutPlural,
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
  const messages = useAdminMessages()
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      messages.availability.nouns.pickupPointSingular,
      messages.availability.nouns.pickupPointPlural,
    )
  return (
    <TabsContent value="pickup-points" className="space-y-4">
      <SectionHeader
        title={messages.availability.tabs.pickupPoints.title}
        description={messages.availability.tabs.pickupPoints.description}
        actionLabel={messages.availability.tabs.pickupPoints.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={pickupPointColumns(props.products, messages)}
        data={props.filteredPickupPoints}
        emptyMessage={messages.availability.tabs.pickupPoints.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.pickupPointSelection}
        onRowSelectionChange={props.setPickupPointSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.pickupPoints.bulkActivateButton}
              confirmLabel={messages.availability.tabs.pickupPoints.bulkActivateConfirm}
              title={formatMessage(messages.availability.tabs.pickupPoints.bulkActivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.pickupPoints.bulkActivateDescription}
              disabled={props.bulkActionTarget === "pickup-points-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-activate",
                  nounSingular: messages.availability.nouns.pickupPointSingular,
                  nounPlural: messages.availability.nouns.pickupPointPlural,
                  payload: { active: true },
                  successVerb: messages.availability.verbActivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.pickupPoints.bulkDeactivateButton}
              confirmLabel={messages.availability.tabs.pickupPoints.bulkDeactivateConfirm}
              title={formatMessage(messages.availability.tabs.pickupPoints.bulkDeactivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.pickupPoints.bulkDeactivateDescription}
              disabled={props.bulkActionTarget === "pickup-points-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-deactivate",
                  nounSingular: messages.availability.nouns.pickupPointSingular,
                  nounPlural: messages.availability.nouns.pickupPointPlural,
                  payload: { active: false },
                  successVerb: messages.availability.verbDeactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.pickupPoints.bulkDeleteButton}
              confirmLabel={messages.availability.tabs.pickupPoints.bulkDeleteConfirm}
              title={formatMessage(messages.availability.tabs.pickupPoints.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.pickupPoints.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "pickup-points-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-delete",
                  nounSingular: messages.availability.nouns.pickupPointSingular,
                  nounPlural: messages.availability.nouns.pickupPointPlural,
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
