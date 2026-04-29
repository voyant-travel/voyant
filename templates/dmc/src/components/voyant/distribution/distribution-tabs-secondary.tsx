import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/admin"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { ConfirmActionButton, SelectionActionBar } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import type {
  BookingOption,
  ChannelBookingLinkRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
  ProductOption,
} from "@/components/voyant/distribution/distribution-shared"
import {
  bookingLinkColumns,
  formatLocalizedSelectionLabel,
  mappingColumns,
  webhookColumns,
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
  const messages = useAdminMessages()
  const nouns = messages.distribution.entities.mapping
  const selectionLabel = (count: number) => formatLocalizedSelectionLabel(count, nouns)

  return (
    <TabsContent value="mappings" className="space-y-4">
      <SectionHeader
        title={messages.distribution.mappings.title}
        description={messages.distribution.mappings.description}
        actionLabel={messages.distribution.mappings.action}
        onAction={props.onCreate}
      />
      <DataTable
        columns={mappingColumns(
          messages.distribution,
          props.channels,
          props.products,
          props.onOpenRoute,
        )}
        data={props.filteredMappings}
        emptyMessage={messages.distribution.mappings.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.mappingSelection}
        onRowSelectionChange={props.setMappingSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.distribution.mappings.activate.button}
              confirmLabel={messages.distribution.mappings.activate.confirm}
              title={formatMessage(messages.distribution.mappings.activate.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.mappings.activate.description}
              disabled={props.bulkActionTarget === "mappings-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/product-mappings",
                  target: "mappings-activate",
                  nouns,
                  payload: { active: true },
                  successVerb: messages.distribution.toasts.activated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.distribution.mappings.deactivate.button}
              confirmLabel={messages.distribution.mappings.deactivate.confirm}
              title={formatMessage(messages.distribution.mappings.deactivate.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.mappings.deactivate.description}
              disabled={props.bulkActionTarget === "mappings-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/product-mappings",
                  target: "mappings-deactivate",
                  nouns,
                  payload: { active: false },
                  successVerb: messages.distribution.toasts.deactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.distribution.mappings.delete.button}
              confirmLabel={messages.distribution.mappings.delete.confirm}
              title={formatMessage(messages.distribution.mappings.delete.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.mappings.delete.description}
              disabled={props.bulkActionTarget === "mappings-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/product-mappings",
                  target: "mappings-delete",
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

export function DistributionBookingLinksTab(props: {
  channels: ChannelRow[]
  locale: string
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
  const messages = useAdminMessages()
  const nouns = messages.distribution.entities.bookingLink
  const selectionLabel = (count: number) => formatLocalizedSelectionLabel(count, nouns)

  return (
    <TabsContent value="booking-links" className="space-y-4">
      <SectionHeader
        title={messages.distribution.bookingLinks.title}
        description={messages.distribution.bookingLinks.description}
        actionLabel={messages.distribution.bookingLinks.action}
        onAction={props.onCreate}
      />
      <DataTable
        columns={bookingLinkColumns(
          messages.distribution,
          props.locale,
          props.channels,
          props.bookings,
          props.onOpenRoute,
        )}
        data={props.filteredBookingLinks}
        emptyMessage={messages.distribution.bookingLinks.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.bookingLinkSelection}
        onRowSelectionChange={props.setBookingLinkSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.distribution.bookingLinks.delete.button}
              confirmLabel={messages.distribution.bookingLinks.delete.confirm}
              title={formatMessage(messages.distribution.bookingLinks.delete.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.bookingLinks.delete.description}
              disabled={props.bulkActionTarget === "booking-links-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/booking-links",
                  target: "booking-links-delete",
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

export function DistributionWebhooksTab(props: {
  channels: ChannelRow[]
  locale: string
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
  const messages = useAdminMessages()
  const nouns = messages.distribution.entities.webhookEvent
  const selectionLabel = (count: number) => formatLocalizedSelectionLabel(count, nouns)

  return (
    <TabsContent value="webhooks" className="space-y-4">
      <SectionHeader
        title={messages.distribution.webhooks.title}
        description={messages.distribution.webhooks.description}
        actionLabel={messages.distribution.webhooks.action}
        onAction={props.onCreate}
      />
      <DataTable
        columns={webhookColumns(
          messages.distribution,
          props.locale,
          props.channels,
          props.onOpenRoute,
        )}
        data={props.filteredWebhookEvents}
        emptyMessage={messages.distribution.webhooks.empty}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.webhookSelection}
        onRowSelectionChange={props.setWebhookSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={messages.distribution.webhooks.process.button}
              confirmLabel={messages.distribution.webhooks.process.confirm}
              title={formatMessage(messages.distribution.webhooks.process.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.webhooks.process.description}
              disabled={props.bulkActionTarget === "webhook-events-processed"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/webhook-events",
                  target: "webhook-events-processed",
                  nouns,
                  payload: { status: "processed" },
                  successVerb: messages.distribution.toasts.processed,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.distribution.webhooks.ignore.button}
              confirmLabel={messages.distribution.webhooks.ignore.confirm}
              title={formatMessage(messages.distribution.webhooks.ignore.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.webhooks.ignore.description}
              disabled={props.bulkActionTarget === "webhook-events-ignored"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/webhook-events",
                  target: "webhook-events-ignored",
                  nouns,
                  payload: { status: "ignored" },
                  successVerb: messages.distribution.toasts.ignored,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={messages.distribution.webhooks.delete.button}
              confirmLabel={messages.distribution.webhooks.delete.confirm}
              title={formatMessage(messages.distribution.webhooks.delete.title, {
                selection: selectionLabel(selectedRows.length),
              })}
              description={messages.distribution.webhooks.delete.description}
              disabled={props.bulkActionTarget === "webhook-events-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/webhook-events",
                  target: "webhook-events-delete",
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
