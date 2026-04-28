import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { formatMessage } from "@voyantjs/voyant-admin"
import type {
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  ProductOption,
} from "@/components/voyant/availability/availability-shared"
import {
  formatLocalizedSelectionLabel,
  ruleColumns,
  slotColumns,
  startTimeColumns,
} from "@/components/voyant/availability/availability-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { SectionHeader } from "./availability-dialogs"

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
  const messages = useAdminMessages()
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      messages.availability.nouns.slotSingular,
      messages.availability.nouns.slotPlural,
    )
  return (
    <TabsContent value="slots" className="space-y-4">
      <SectionHeader
        title={messages.availability.tabs.slots.title}
        description={messages.availability.tabs.slots.description}
        actionLabel={messages.availability.tabs.slots.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={slotColumns(props.products, props.onOpenRoute, messages)}
        data={props.filteredSlots}
        emptyMessage={messages.availability.tabs.slots.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.slotSelection}
        onRowSelectionChange={props.setSlotSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.slots.bulkOpenButton}
              confirmLabel={messages.availability.tabs.slots.bulkOpenConfirm}
              title={formatMessage(messages.availability.tabs.slots.bulkOpenTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.slots.bulkOpenDescription}
              disabled={props.bulkActionTarget === "slots-open"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/slots",
                  target: "slots-open",
                  nounSingular: messages.availability.nouns.slotSingular,
                  nounPlural: messages.availability.nouns.slotPlural,
                  payload: { status: "open" },
                  successVerb: messages.availability.verbOpened,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.slots.bulkCloseButton}
              confirmLabel={messages.availability.tabs.slots.bulkCloseConfirm}
              title={formatMessage(messages.availability.tabs.slots.bulkCloseTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.slots.bulkCloseDescription}
              disabled={props.bulkActionTarget === "slots-close"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/slots",
                  target: "slots-close",
                  nounSingular: messages.availability.nouns.slotSingular,
                  nounPlural: messages.availability.nouns.slotPlural,
                  payload: { status: "closed" },
                  successVerb: messages.availability.verbClosed,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.slots.bulkDeleteButton}
              confirmLabel={messages.availability.tabs.slots.bulkDeleteConfirm}
              title={formatMessage(messages.availability.tabs.slots.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.slots.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "slots-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/slots",
                  target: "slots-delete",
                  nounSingular: messages.availability.nouns.slotSingular,
                  nounPlural: messages.availability.nouns.slotPlural,
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
  const messages = useAdminMessages()
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      messages.availability.nouns.ruleSingular,
      messages.availability.nouns.rulePlural,
    )
  return (
    <TabsContent value="rules" className="space-y-4">
      <SectionHeader
        title={messages.availability.tabs.rules.title}
        description={messages.availability.tabs.rules.description}
        actionLabel={messages.availability.tabs.rules.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={ruleColumns(props.products, props.onOpenRoute, messages)}
        data={props.filteredRules}
        emptyMessage={messages.availability.tabs.rules.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.ruleSelection}
        onRowSelectionChange={props.setRuleSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.rules.bulkActivateButton}
              confirmLabel={messages.availability.tabs.rules.bulkActivateConfirm}
              title={formatMessage(messages.availability.tabs.rules.bulkActivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.rules.bulkActivateDescription}
              disabled={props.bulkActionTarget === "rules-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-activate",
                  nounSingular: messages.availability.nouns.ruleSingular,
                  nounPlural: messages.availability.nouns.rulePlural,
                  payload: { active: true },
                  successVerb: messages.availability.verbActivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.rules.bulkDeactivateButton}
              confirmLabel={messages.availability.tabs.rules.bulkDeactivateConfirm}
              title={formatMessage(messages.availability.tabs.rules.bulkDeactivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.rules.bulkDeactivateDescription}
              disabled={props.bulkActionTarget === "rules-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-deactivate",
                  nounSingular: messages.availability.nouns.ruleSingular,
                  nounPlural: messages.availability.nouns.rulePlural,
                  payload: { active: false },
                  successVerb: messages.availability.verbDeactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.rules.bulkDeleteButton}
              confirmLabel={messages.availability.tabs.rules.bulkDeleteConfirm}
              title={formatMessage(messages.availability.tabs.rules.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.rules.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "rules-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-delete",
                  nounSingular: messages.availability.nouns.ruleSingular,
                  nounPlural: messages.availability.nouns.rulePlural,
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
  const messages = useAdminMessages()
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      messages.availability.nouns.startTimeSingular,
      messages.availability.nouns.startTimePlural,
    )
  return (
    <TabsContent value="start-times" className="space-y-4">
      <SectionHeader
        title={messages.availability.tabs.startTimes.title}
        description={messages.availability.tabs.startTimes.description}
        actionLabel={messages.availability.tabs.startTimes.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={startTimeColumns(props.products, props.onOpenRoute, messages)}
        data={props.filteredStartTimes}
        emptyMessage={messages.availability.tabs.startTimes.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.startTimeSelection}
        onRowSelectionChange={props.setStartTimeSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.startTimes.bulkActivateButton}
              confirmLabel={messages.availability.tabs.startTimes.bulkActivateConfirm}
              title={formatMessage(messages.availability.tabs.startTimes.bulkActivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.startTimes.bulkActivateDescription}
              disabled={props.bulkActionTarget === "start-times-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-activate",
                  nounSingular: messages.availability.nouns.startTimeSingular,
                  nounPlural: messages.availability.nouns.startTimePlural,
                  payload: { active: true },
                  successVerb: messages.availability.verbActivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.startTimes.bulkDeactivateButton}
              confirmLabel={messages.availability.tabs.startTimes.bulkDeactivateConfirm}
              title={formatMessage(messages.availability.tabs.startTimes.bulkDeactivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.startTimes.bulkDeactivateDescription}
              disabled={props.bulkActionTarget === "start-times-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-deactivate",
                  nounSingular: messages.availability.nouns.startTimeSingular,
                  nounPlural: messages.availability.nouns.startTimePlural,
                  payload: { active: false },
                  successVerb: messages.availability.verbDeactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.availability.tabs.startTimes.bulkDeleteButton}
              confirmLabel={messages.availability.tabs.startTimes.bulkDeleteConfirm}
              title={formatMessage(messages.availability.tabs.startTimes.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={messages.availability.tabs.startTimes.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "start-times-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-delete",
                  nounSingular: messages.availability.nouns.startTimeSingular,
                  nounPlural: messages.availability.nouns.startTimePlural,
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
