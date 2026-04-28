import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import { SectionHeader } from "./distribution-dialog-barrel"
import type {
  BookingOption,
  ChannelBookingLinkRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
  ProductOption,
} from "./distribution-shared"
import {
  bookingLinkColumns,
  formatSelectionLabel,
  mappingColumns,
  webhookColumns,
} from "./distribution-shared"

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
  return (
    <TabsContent value="mappings" className="space-y-4">
      <SectionHeader
        title="Product Mappings"
        description="Map Voyant products to external channel catalog identifiers."
        actionLabel="New Mapping"
        onAction={props.onCreate}
      />
      <DataTable
        columns={mappingColumns(props.channels, props.products, props.onOpenRoute)}
        data={props.filteredMappings}
        emptyMessage="No product mappings match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.mappingSelection}
        onRowSelectionChange={props.setMappingSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Activate"
              confirmLabel="Activate Mappings"
              title={`Activate ${formatSelectionLabel(selectedRows.length, "mapping")}?`}
              description="This re-enables the selected external product mappings for live channel use."
              disabled={props.bulkActionTarget === "mappings-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/product-mappings",
                  target: "mappings-activate",
                  noun: "mapping",
                  payload: { active: true },
                  successVerb: "Activated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Deactivate"
              confirmLabel="Deactivate Mappings"
              title={`Deactivate ${formatSelectionLabel(selectedRows.length, "mapping")}?`}
              description="This keeps the selected mappings for reference but removes them from active sync/distribution."
              disabled={props.bulkActionTarget === "mappings-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/product-mappings",
                  target: "mappings-deactivate",
                  noun: "mapping",
                  payload: { active: false },
                  successVerb: "Deactivated",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Mappings"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "mapping")}?`}
              description="This permanently removes the selected external product mappings."
              disabled={props.bulkActionTarget === "mappings-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/product-mappings",
                  target: "mappings-delete",
                  noun: "mapping",
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
  return (
    <TabsContent value="booking-links" className="space-y-4">
      <SectionHeader
        title="Booking Links"
        description="Track external booking IDs and sync state for channel-originated bookings."
        actionLabel="New Booking Link"
        onAction={props.onCreate}
      />
      <DataTable
        columns={bookingLinkColumns(props.channels, props.bookings, props.onOpenRoute)}
        data={props.filteredBookingLinks}
        emptyMessage="No booking links match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.bookingLinkSelection}
        onRowSelectionChange={props.setBookingLinkSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Booking Links"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "booking link")}?`}
              description="This permanently removes the selected external booking references and sync links."
              disabled={props.bulkActionTarget === "booking-links-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/booking-links",
                  target: "booking-links-delete",
                  noun: "booking link",
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
  return (
    <TabsContent value="webhooks" className="space-y-4">
      <SectionHeader
        title="Webhook Events"
        description="Inspect ingested partner events and replay/problem cases."
        actionLabel="New Webhook Event"
        onAction={props.onCreate}
      />
      <DataTable
        columns={webhookColumns(props.channels, props.onOpenRoute)}
        data={props.filteredWebhookEvents}
        emptyMessage="No webhook events match the current filters."
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.webhookSelection}
        onRowSelectionChange={props.setWebhookSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel="Mark Processed"
              confirmLabel="Mark Processed"
              title={`Mark ${formatSelectionLabel(selectedRows.length, "webhook event")} as processed?`}
              description="This marks the selected events as processed and removes them from the active sync queue."
              disabled={props.bulkActionTarget === "webhook-events-processed"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/webhook-events",
                  target: "webhook-events-processed",
                  noun: "webhook event",
                  payload: { status: "processed" },
                  successVerb: "Processed",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Ignore"
              confirmLabel="Ignore Events"
              title={`Ignore ${formatSelectionLabel(selectedRows.length, "webhook event")}?`}
              description="This keeps the selected events in history but marks them as intentionally ignored."
              disabled={props.bulkActionTarget === "webhook-events-ignored"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/webhook-events",
                  target: "webhook-events-ignored",
                  noun: "webhook event",
                  payload: { status: "ignored" },
                  successVerb: "Ignored",
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel="Delete Selected"
              confirmLabel="Delete Events"
              title={`Delete ${formatSelectionLabel(selectedRows.length, "webhook event")}?`}
              description="This permanently removes the selected webhook events from the event log."
              disabled={props.bulkActionTarget === "webhook-events-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/distribution/webhook-events",
                  target: "webhook-events-delete",
                  noun: "webhook event",
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
