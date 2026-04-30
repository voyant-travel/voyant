import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import type {
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ChannelRow,
  ProductOption,
  SupplierOption,
} from "@voyantjs/distribution-ui/components/distribution-shared"
import {
  channelColumns,
  commissionColumns,
  contractColumns,
  formatSelectionLabel,
} from "@voyantjs/distribution-ui/components/distribution-shared"
import { ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { SectionHeader } from "./distribution-dialog-barrel"

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
  return (
    <TabsContent value="channels" className="space-y-4">
      <SectionHeader
        title="Channels"
        description="Sales partners, affiliates, OTAs, marketplaces, and direct channels."
        actionLabel="New Channel"
        onAction={props.onCreate}
      />
      <DataTable
        columns={channelColumns(props.onOpenRoute)}
        data={props.filteredChannels}
        emptyMessage="No channels match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.channelSelection}
        onRowSelectionChange={props.setChannelSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Activate"
              confirmLabel="Activate Channels"
              title={`Activate ${formatSelectionLabel(selectedRows.length, "channel")}?`}
              description="This enables the selected channels for live distribution again."
              disabled={props.bulkActionTarget === "channels-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/channels",
                  target: "channels-activate",
                  noun: "channel",
                  payload: { status: "active" },
                  successVerb: "Activated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Archive"
              confirmLabel="Archive Channels"
              title={`Archive ${formatSelectionLabel(selectedRows.length, "channel")}?`}
              description="This keeps the selected channels for history but removes them from active commercial use."
              disabled={props.bulkActionTarget === "channels-archive"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/channels",
                  target: "channels-archive",
                  noun: "channel",
                  payload: { status: "archived" },
                  successVerb: "Archived",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Channels"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "channel")}?`}
              description="This permanently removes the selected channels. Use Archive if you only need to retire them from active use."
              disabled={props.bulkActionTarget === "channels-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/channels",
                  target: "channels-delete",
                  noun: "channel",
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
  return (
    <TabsContent value="contracts" className="space-y-4">
      <SectionHeader
        title="Contracts"
        description="Commercial terms per channel and supplier relationship."
        actionLabel="New Contract"
        onAction={props.onCreate}
      />
      <DataTable
        columns={contractColumns(props.channels, props.suppliers, props.onOpenRoute)}
        data={props.filteredContracts}
        emptyMessage="No contracts match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.contractSelection}
        onRowSelectionChange={props.setContractSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Activate"
              confirmLabel="Activate Contracts"
              title={`Activate ${formatSelectionLabel(selectedRows.length, "contract")}?`}
              description="This marks the selected contracts as commercially active."
              disabled={props.bulkActionTarget === "contracts-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/contracts",
                  target: "contracts-activate",
                  noun: "contract",
                  payload: { status: "active" },
                  successVerb: "Activated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Expire"
              confirmLabel="Expire Contracts"
              title={`Expire ${formatSelectionLabel(selectedRows.length, "contract")}?`}
              description="This preserves the selected contracts but marks them as no longer in force."
              disabled={props.bulkActionTarget === "contracts-expire"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/contracts",
                  target: "contracts-expire",
                  noun: "contract",
                  payload: { status: "expired" },
                  successVerb: "Expired",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Contracts"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "contract")}?`}
              description="This permanently removes the selected contracts and their commercial setup."
              disabled={props.bulkActionTarget === "contracts-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/contracts",
                  target: "contracts-delete",
                  noun: "contract",
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
  return (
    <TabsContent value="commissions" className="space-y-4">
      <SectionHeader
        title="Commission Rules"
        description="Define booking, product, rate, and category-based commission logic."
        actionLabel="New Commission Rule"
        onAction={props.onCreate}
      />
      <DataTable
        columns={commissionColumns(props.contracts, props.products, props.onOpenRoute)}
        data={props.filteredCommissionRules}
        emptyMessage="No commission rules match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.commissionSelection}
        onRowSelectionChange={props.setCommissionSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Commission Rules"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "commission rule")}?`}
              description="This permanently removes the selected commission rules from channel pricing."
              disabled={props.bulkActionTarget === "commission-rules-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/commission-rules",
                  target: "commission-rules-delete",
                  noun: "commission rule",
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
