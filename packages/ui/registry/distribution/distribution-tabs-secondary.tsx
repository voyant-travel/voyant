import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/i18n"
import { ConfirmActionButton, SelectionActionBar } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { TabsContent } from "@/components/ui/tabs"
import { useDistributionUiI18nOrDefault } from "../../../distribution-ui/src/index"
import { SectionHeader } from "./distribution-dialog-barrel"
import type {
  BookingOption,
  ChannelBookingLinkRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
  ProductOption,
} from "./distribution-shared"
import { bookingLinkColumns, mappingColumns, webhookColumns } from "./distribution-shared"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"
import { formatRegistryDistributionCount, formatRegistryDistributionSummary } from "./i18n/utils"

type BulkFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  noun: string
  payload: Record<string, unknown>
  successVerb: string
  clearSelection: () => void
}) => Promise<void> // i18n-literal-ok type annotation

type DeleteFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  noun: string
  clearSelection: () => void
}) => Promise<void> // i18n-literal-ok type annotation

function getSelectionSummary(count: number, template: string) {
  return formatRegistryDistributionSummary(template, { count })
}

export function DistributionMappingsTab(props: {
  channels: ChannelRow[]
  products: ProductOption[]
  filteredMappings: ChannelProductMappingRow[]
  mappingSelection: RowSelectionState
  setMappingSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (mappingId: string) => void
  onEdit: (row: ChannelProductMappingRow) => void
}) {
  const i18n = useDistributionUiI18nOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const tab = messages.tabs.mappings

  return (
    <TabsContent value="mappings" className="space-y-4">
      <SectionHeader
        title={tab.title}
        description={tab.description}
        actionLabel={tab.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={mappingColumns(props.channels, props.products, props.onOpenRoute, i18n)}
        data={props.filteredMappings}
        emptyMessage={tab.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.mappingSelection}
        onRowSelectionChange={props.setMappingSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => {
          const countLabel = formatRegistryDistributionCount(
            messages,
            "mapping",
            selectedRows.length,
          )

          return (
            <SelectionActionBar
              selectedCount={selectedRows.length}
              onClear={clearSelection}
              selectionSummary={getSelectionSummary(
                selectedRows.length,
                messages.common.selectionSummary,
              )}
              clearLabel={messages.common.clearSelection}
            >
              <ConfirmActionButton
                buttonLabel={tab.actions.activate.button}
                confirmLabel={tab.actions.activate.confirm}
                cancelLabel={messages.common.cancel}
                title={formatMessage(tab.actions.activate.title, { countLabel })}
                description={tab.actions.activate.description}
                disabled={props.bulkActionTarget === "mappings-activate"}
                onConfirm={() =>
                  props.handleBulkUpdate({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/distribution/product-mappings",
                    target: "mappings-activate",
                    noun: messages.common.entities.mapping.one,
                    payload: { active: true },
                    successVerb: messages.page.bulkVerbs.activated,
                    clearSelection,
                  })
                }
              />
              <ConfirmActionButton
                buttonLabel={tab.actions.deactivate.button}
                confirmLabel={tab.actions.deactivate.confirm}
                cancelLabel={messages.common.cancel}
                title={formatMessage(tab.actions.deactivate.title, { countLabel })}
                description={tab.actions.deactivate.description}
                disabled={props.bulkActionTarget === "mappings-deactivate"}
                onConfirm={() =>
                  props.handleBulkUpdate({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/distribution/product-mappings",
                    target: "mappings-deactivate",
                    noun: messages.common.entities.mapping.one,
                    payload: { active: false },
                    successVerb: messages.page.bulkVerbs.deactivated,
                    clearSelection,
                  })
                }
              />
              <ConfirmActionButton
                buttonLabel={tab.actions.delete.button}
                confirmLabel={tab.actions.delete.confirm}
                cancelLabel={messages.common.cancel}
                title={formatMessage(tab.actions.delete.title, { countLabel })}
                description={tab.actions.delete.description}
                disabled={props.bulkActionTarget === "mappings-delete"}
                variant="destructive"
                confirmVariant="destructive"
                onConfirm={() =>
                  props.handleBulkDelete({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/distribution/product-mappings",
                    target: "mappings-delete",
                    noun: messages.common.entities.mapping.one,
                    clearSelection,
                  })
                }
              />
            </SelectionActionBar>
          )
        }}
        onRowClick={(row) => props.onEdit(row.original)}
      />
    </TabsContent>
  )
}

export function DistributionBookingLinksTab(props: {
  channels: ChannelRow[]
  bookings: BookingOption[]
  filteredBookingLinks: ChannelBookingLinkRow[]
  bookingLinkSelection: RowSelectionState
  setBookingLinkSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (bookingLinkId: string) => void
  onEdit: (row: ChannelBookingLinkRow) => void
}) {
  const i18n = useDistributionUiI18nOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const tab = messages.tabs.bookingLinks

  return (
    <TabsContent value="booking-links" className="space-y-4">
      <SectionHeader
        title={tab.title}
        description={tab.description}
        actionLabel={tab.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={bookingLinkColumns(props.channels, props.bookings, props.onOpenRoute, i18n)}
        data={props.filteredBookingLinks}
        emptyMessage={tab.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.bookingLinkSelection}
        onRowSelectionChange={props.setBookingLinkSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => {
          const countLabel = formatRegistryDistributionCount(
            messages,
            "bookingLink",
            selectedRows.length,
          )

          return (
            <SelectionActionBar
              selectedCount={selectedRows.length}
              onClear={clearSelection}
              selectionSummary={getSelectionSummary(
                selectedRows.length,
                messages.common.selectionSummary,
              )}
              clearLabel={messages.common.clearSelection}
            >
              <ConfirmActionButton
                buttonLabel={tab.actions.delete.button}
                confirmLabel={tab.actions.delete.confirm}
                cancelLabel={messages.common.cancel}
                title={formatMessage(tab.actions.delete.title, { countLabel })}
                description={tab.actions.delete.description}
                disabled={props.bulkActionTarget === "booking-links-delete"}
                variant="destructive"
                confirmVariant="destructive"
                onConfirm={() =>
                  props.handleBulkDelete({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/distribution/booking-links",
                    target: "booking-links-delete",
                    noun: messages.common.entities.bookingLink.one,
                    clearSelection,
                  })
                }
              />
            </SelectionActionBar>
          )
        }}
        onRowClick={(row) => props.onEdit(row.original)}
      />
    </TabsContent>
  )
}

export function DistributionWebhooksTab(props: {
  channels: ChannelRow[]
  filteredWebhookEvents: ChannelWebhookEventRow[]
  webhookSelection: RowSelectionState
  setWebhookSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: BulkFn
  handleBulkDelete: DeleteFn
  onCreate: () => void
  onOpenRoute: (webhookEventId: string) => void
  onEdit: (row: ChannelWebhookEventRow) => void
}) {
  const i18n = useDistributionUiI18nOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const tab = messages.tabs.webhooks

  return (
    <TabsContent value="webhooks" className="space-y-4">
      <SectionHeader
        title={tab.title}
        description={tab.description}
        actionLabel={tab.actionLabel}
        onAction={props.onCreate}
      />
      <DataTable
        columns={webhookColumns(props.channels, props.onOpenRoute, i18n)}
        data={props.filteredWebhookEvents}
        emptyMessage={tab.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.webhookSelection}
        onRowSelectionChange={props.setWebhookSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => {
          const countLabel = formatRegistryDistributionCount(
            messages,
            "webhookEvent",
            selectedRows.length,
          )

          return (
            <SelectionActionBar
              selectedCount={selectedRows.length}
              onClear={clearSelection}
              selectionSummary={getSelectionSummary(
                selectedRows.length,
                messages.common.selectionSummary,
              )}
              clearLabel={messages.common.clearSelection}
            >
              <ConfirmActionButton
                buttonLabel={tab.actions.markProcessed.button}
                confirmLabel={tab.actions.markProcessed.confirm}
                cancelLabel={messages.common.cancel}
                title={formatMessage(tab.actions.markProcessed.title, { countLabel })}
                description={tab.actions.markProcessed.description}
                disabled={props.bulkActionTarget === "webhook-events-processed"}
                onConfirm={() =>
                  props.handleBulkUpdate({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/distribution/webhook-events",
                    target: "webhook-events-processed",
                    noun: messages.common.entities.webhookEvent.one,
                    payload: { status: "processed" },
                    successVerb: messages.page.bulkVerbs.processed,
                    clearSelection,
                  })
                }
              />
              <ConfirmActionButton
                buttonLabel={tab.actions.ignore.button}
                confirmLabel={tab.actions.ignore.confirm}
                cancelLabel={messages.common.cancel}
                title={formatMessage(tab.actions.ignore.title, { countLabel })}
                description={tab.actions.ignore.description}
                disabled={props.bulkActionTarget === "webhook-events-ignored"}
                onConfirm={() =>
                  props.handleBulkUpdate({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/distribution/webhook-events",
                    target: "webhook-events-ignored",
                    noun: messages.common.entities.webhookEvent.one,
                    payload: { status: "ignored" },
                    successVerb: messages.page.bulkVerbs.ignored,
                    clearSelection,
                  })
                }
              />
              <ConfirmActionButton
                buttonLabel={tab.actions.delete.button}
                confirmLabel={tab.actions.delete.confirm}
                cancelLabel={messages.common.cancel}
                title={formatMessage(tab.actions.delete.title, { countLabel })}
                description={tab.actions.delete.description}
                disabled={props.bulkActionTarget === "webhook-events-delete"}
                variant="destructive"
                confirmVariant="destructive"
                onConfirm={() =>
                  props.handleBulkDelete({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/distribution/webhook-events",
                    target: "webhook-events-delete",
                    noun: messages.common.entities.webhookEvent.one,
                    clearSelection,
                  })
                }
              />
            </SelectionActionBar>
          )
        }}
        onRowClick={(row) => props.onEdit(row.original)}
      />
    </TabsContent>
  )
}
