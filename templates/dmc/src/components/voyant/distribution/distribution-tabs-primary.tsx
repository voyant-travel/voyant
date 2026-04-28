import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { formatMessage } from "@voyantjs/voyant-admin"
import { ConfirmActionButton, SelectionActionBar } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import type {
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ChannelRow,
  ProductOption,
  SupplierOption,
} from "@/components/voyant/distribution/distribution-shared"
import {
  channelColumns,
  commissionColumns,
  contractColumns,
  formatLocalizedSelectionLabel,
} from "@/components/voyant/distribution/distribution-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { SectionHeader } from "./distribution-dialog-barrel"

type BulkFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  nouns: { singular: string; plural: string }
  payload: Record<string, unknown>
  successVerb: string
  clearSelection: () => void
}) => Promise<void>

type DeleteFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  nouns: { singular: string; plural: string }
  clearSelection: () => void
}) => Promise<void>

export function DistributionChannelsTab(props: {
  filteredChannels: ChannelRow[]
  channelSelection: RowSelectionState
  setChannelSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (channelId: string) => void
  onEdit: (row: ChannelRow) => void
}) {
  const messages = useAdminMessages()
  const nouns = messages.distribution.entities.channel
  const selectionLabel = (count: number) => formatLocalizedSelectionLabel(count, nouns)

  return (
    <TabsContent value="channels" className="space-y-4">
      <SectionHeader
        title={messages.distribution.channels.title}
        description={messages.distribution.channels.description}
        actionLabel={messages.distribution.channels.action}
        onAction={props.onCreate}
      />
      <DataTable
        columns={channelColumns(messages.distribution, props.onOpenRoute)}
        data={props.filteredChannels}
        emptyMessage={messages.distribution.channels.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.channelSelection}
        onRowSelectionChange={props.setChannelSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.distribution.channels.activate.button}
              confirmLabel={messages.distribution.channels.activate.confirm}
              title={formatMessage(messages.distribution.channels.activate.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.channels.activate.description}
              disabled={props.bulkActionTarget === "channels-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/channels",
                  target: "channels-activate",
                  nouns,
                  payload: { status: "active" },
                  successVerb: messages.distribution.toasts.activated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.distribution.channels.archive.button}
              confirmLabel={messages.distribution.channels.archive.confirm}
              title={formatMessage(messages.distribution.channels.archive.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.channels.archive.description}
              disabled={props.bulkActionTarget === "channels-archive"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/channels",
                  target: "channels-archive",
                  nouns,
                  payload: { status: "archived" },
                  successVerb: messages.distribution.toasts.archived,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.distribution.channels.delete.button}
              confirmLabel={messages.distribution.channels.delete.confirm}
              title={formatMessage(messages.distribution.channels.delete.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.channels.delete.description}
              disabled={props.bulkActionTarget === "channels-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/channels",
                  target: "channels-delete",
                  nouns,
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

export function DistributionContractsTab(props: {
  channels: ChannelRow[]
  locale: string
  suppliers: SupplierOption[]
  filteredContracts: ChannelContractRow[]
  contractSelection: RowSelectionState
  setContractSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (contractId: string) => void
  onEdit: (row: ChannelContractRow) => void
}) {
  const messages = useAdminMessages()
  const nouns = messages.distribution.entities.contract
  const selectionLabel = (count: number) => formatLocalizedSelectionLabel(count, nouns)

  return (
    <TabsContent value="contracts" className="space-y-4">
      <SectionHeader
        title={messages.distribution.contracts.title}
        description={messages.distribution.contracts.description}
        actionLabel={messages.distribution.contracts.action}
        onAction={props.onCreate}
      />
      <DataTable
        columns={contractColumns(
          messages.distribution,
          props.locale,
          props.channels,
          props.suppliers,
          props.onOpenRoute,
        )}
        data={props.filteredContracts}
        emptyMessage={messages.distribution.contracts.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.contractSelection}
        onRowSelectionChange={props.setContractSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.distribution.contracts.activate.button}
              confirmLabel={messages.distribution.contracts.activate.confirm}
              title={formatMessage(messages.distribution.contracts.activate.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.contracts.activate.description}
              disabled={props.bulkActionTarget === "contracts-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/contracts",
                  target: "contracts-activate",
                  nouns,
                  payload: { status: "active" },
                  successVerb: messages.distribution.toasts.activated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.distribution.contracts.expire.button}
              confirmLabel={messages.distribution.contracts.expire.confirm}
              title={formatMessage(messages.distribution.contracts.expire.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.contracts.expire.description}
              disabled={props.bulkActionTarget === "contracts-expire"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/contracts",
                  target: "contracts-expire",
                  nouns,
                  payload: { status: "expired" },
                  successVerb: messages.distribution.toasts.expired,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.distribution.contracts.delete.button}
              confirmLabel={messages.distribution.contracts.delete.confirm}
              title={formatMessage(messages.distribution.contracts.delete.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.contracts.delete.description}
              disabled={props.bulkActionTarget === "contracts-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/contracts",
                  target: "contracts-delete",
                  nouns,
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

export function DistributionCommissionsTab(props: {
  contracts: ChannelContractRow[]
  products: ProductOption[]
  filteredCommissionRules: ChannelCommissionRuleRow[]
  commissionSelection: RowSelectionState
  setCommissionSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (commissionRuleId: string) => void
  onEdit: (row: ChannelCommissionRuleRow) => void
}) {
  const messages = useAdminMessages()
  const nouns = messages.distribution.entities.commissionRule
  const selectionLabel = (count: number) => formatLocalizedSelectionLabel(count, nouns)

  return (
    <TabsContent value="commissions" className="space-y-4">
      <SectionHeader
        title={messages.distribution.commissions.title}
        description={messages.distribution.commissions.description}
        actionLabel={messages.distribution.commissions.action}
        onAction={props.onCreate}
      />
      <DataTable
        columns={commissionColumns(
          messages.distribution,
          props.contracts,
          props.products,
          props.onOpenRoute,
        )}
        data={props.filteredCommissionRules}
        emptyMessage={messages.distribution.commissions.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.commissionSelection}
        onRowSelectionChange={props.setCommissionSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.distribution.commissions.delete.button}
              confirmLabel={messages.distribution.commissions.delete.confirm}
              title={formatMessage(messages.distribution.commissions.delete.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.commissions.delete.description}
              disabled={props.bulkActionTarget === "commission-rules-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/commission-rules",
                  target: "commission-rules-delete",
                  nouns,
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
