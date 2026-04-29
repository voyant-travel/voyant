import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/admin"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { ConfirmActionButton, SelectionActionBar } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { SectionHeader } from "@/components/voyant/resources/resources-section-header"
import { useAdminMessages } from "@/lib/admin-i18n"
import type {
  ProductOption,
  ResourceAllocationRow,
  ResourcePoolRow,
  ResourceRow,
  SupplierOption,
} from "./resources-shared"
import {
  allocationColumns,
  formatLocalizedSelectionLabel,
  poolColumns,
  resourceColumns,
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
  const messages = useAdminMessages()
  const resourcesMessages = messages.resources.tabs.resources
  return (
    <TabsContent value="resources" className="space-y-4">
      <SectionHeader
        title={resourcesMessages.title}
        description={resourcesMessages.description}
        actionLabel={resourcesMessages.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={resourceColumns(props.suppliers, props.onOpenRoute, messages)}
        data={props.filteredResources}
        emptyMessage={resourcesMessages.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.resourceSelection}
        onRowSelectionChange={props.setResourceSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={resourcesMessages.bulkActivateButton}
              confirmLabel={resourcesMessages.bulkActivateConfirm}
              title={formatMessage(resourcesMessages.bulkActivateTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.resourceSingular,
                  messages.resources.nouns.resourcePlural,
                ),
              })}
              description={resourcesMessages.bulkActivateDescription}
              disabled={props.bulkActionTarget === "resources-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/resources",
                  target: "resources-activate",
                  nounSingular: messages.resources.nouns.resourceSingular,
                  nounPlural: messages.resources.nouns.resourcePlural,
                  payload: { active: true },
                  successVerb: messages.resources.verbActivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={resourcesMessages.bulkDeactivateButton}
              confirmLabel={resourcesMessages.bulkDeactivateConfirm}
              title={formatMessage(resourcesMessages.bulkDeactivateTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.resourceSingular,
                  messages.resources.nouns.resourcePlural,
                ),
              })}
              description={resourcesMessages.bulkDeactivateDescription}
              disabled={props.bulkActionTarget === "resources-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/resources",
                  target: "resources-deactivate",
                  nounSingular: messages.resources.nouns.resourceSingular,
                  nounPlural: messages.resources.nouns.resourcePlural,
                  payload: { active: false },
                  successVerb: messages.resources.verbDeactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={resourcesMessages.bulkDeleteButton}
              confirmLabel={resourcesMessages.bulkDeleteConfirm}
              title={formatMessage(resourcesMessages.bulkDeleteTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.resourceSingular,
                  messages.resources.nouns.resourcePlural,
                ),
              })}
              description={resourcesMessages.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "resources-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/resources",
                  target: "resources-delete",
                  nounSingular: messages.resources.nouns.resourceSingular,
                  nounPlural: messages.resources.nouns.resourcePlural,
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
  const messages = useAdminMessages()
  const poolsMessages = messages.resources.tabs.pools
  return (
    <TabsContent value="pools" className="space-y-4">
      <SectionHeader
        title={poolsMessages.title}
        description={poolsMessages.description}
        actionLabel={poolsMessages.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={poolColumns(props.products, props.onOpenRoute, messages)}
        data={props.filteredPools}
        emptyMessage={poolsMessages.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.poolSelection}
        onRowSelectionChange={props.setPoolSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={poolsMessages.bulkActivateButton}
              confirmLabel={poolsMessages.bulkActivateConfirm}
              title={formatMessage(poolsMessages.bulkActivateTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.poolSingular,
                  messages.resources.nouns.poolPlural,
                ),
              })}
              description={poolsMessages.bulkActivateDescription}
              disabled={props.bulkActionTarget === "pools-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/pools",
                  target: "pools-activate",
                  nounSingular: messages.resources.nouns.poolSingular,
                  nounPlural: messages.resources.nouns.poolPlural,
                  payload: { active: true },
                  successVerb: messages.resources.verbActivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={poolsMessages.bulkDeactivateButton}
              confirmLabel={poolsMessages.bulkDeactivateConfirm}
              title={formatMessage(poolsMessages.bulkDeactivateTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.poolSingular,
                  messages.resources.nouns.poolPlural,
                ),
              })}
              description={poolsMessages.bulkDeactivateDescription}
              disabled={props.bulkActionTarget === "pools-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/pools",
                  target: "pools-deactivate",
                  nounSingular: messages.resources.nouns.poolSingular,
                  nounPlural: messages.resources.nouns.poolPlural,
                  payload: { active: false },
                  successVerb: messages.resources.verbDeactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={poolsMessages.bulkDeleteButton}
              confirmLabel={poolsMessages.bulkDeleteConfirm}
              title={formatMessage(poolsMessages.bulkDeleteTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.poolSingular,
                  messages.resources.nouns.poolPlural,
                ),
              })}
              description={poolsMessages.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "pools-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/pools",
                  target: "pools-delete",
                  nounSingular: messages.resources.nouns.poolSingular,
                  nounPlural: messages.resources.nouns.poolPlural,
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
  const messages = useAdminMessages()
  const allocationsMessages = messages.resources.tabs.allocations
  return (
    <TabsContent value="allocations" className="space-y-4">
      <SectionHeader
        title={allocationsMessages.title}
        description={allocationsMessages.description}
        actionLabel={allocationsMessages.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={allocationColumns(props.pools, props.products, props.onOpenRoute, messages)}
        data={props.filteredAllocations}
        emptyMessage={allocationsMessages.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.allocationSelection}
        onRowSelectionChange={props.setAllocationSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={allocationsMessages.bulkDeleteButton}
              confirmLabel={allocationsMessages.bulkDeleteConfirm}
              title={formatMessage(allocationsMessages.bulkDeleteTitle, {
                selection: formatLocalizedSelectionLabel(
                  selectedRows.length,
                  messages.resources.nouns.allocationSingular,
                  messages.resources.nouns.allocationPlural,
                ),
              })}
              description={allocationsMessages.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "allocations-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/resources/allocations",
                  target: "allocations-delete",
                  nounSingular: messages.resources.nouns.allocationSingular,
                  nounPlural: messages.resources.nouns.allocationPlural,
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
