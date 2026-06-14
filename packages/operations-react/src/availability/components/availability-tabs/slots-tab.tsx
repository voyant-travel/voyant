"use client"

import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import { ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import type { ReactNode } from "react"
import { useAvailabilityUiMessagesOrDefault } from "../../i18n/index.js"
import type { AvailabilitySlotRow, ProductOption } from "../../index.js"
import { formatLocalizedSelectionLabel } from "../../utils.js"
import { availabilitySlotColumns } from "../availability-columns.js"
import { AvailabilitySectionHeader } from "../availability-section-header.js"
import {
  type AvailabilityBulkDeleteFn,
  type AvailabilityBulkUpdateFn,
  type AvailabilityTabMessages,
  formatTemplate,
} from "./shared.js"

export function AvailabilitySlotsTab(props: {
  messages: AvailabilityTabMessages
  products: ProductOption[]
  filteredSlots: AvailabilitySlotRow[]
  slotSelection: RowSelectionState
  setSlotSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: AvailabilityBulkUpdateFn
  handleBulkDelete: AvailabilityBulkDeleteFn
  onCreate: () => void
  onOpenRoute: (slotId: string) => void
  onEdit: (row: AvailabilitySlotRow) => void
  toolbar?: ReactNode
  hideHeader?: boolean
  asPanel?: boolean
  hideBulkDelete?: boolean
  bulkStatusSelect?: boolean
}) {
  useAvailabilityUiMessagesOrDefault()
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      props.messages.nouns.slotSingular,
      props.messages.nouns.slotPlural,
    )

  const asPanel = props.asPanel ?? true
  const body = (
    <>
      {!props.hideHeader && (
        <AvailabilitySectionHeader
          title={props.messages.tabs.slots.title}
          description={props.messages.tabs.slots.description}
          actionLabel={props.messages.tabs.slots.actionLabel}
          onAction={props.onCreate}
        />
      )}
      {props.toolbar}
      <DataTable
        columns={availabilitySlotColumns(
          props.products,
          props.onOpenRoute,
          props.messages,
          props.onEdit,
        )}
        data={props.filteredSlots}
        emptyMessage={props.messages.tabs.slots.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.slotSelection}
        onRowSelectionChange={props.setSlotSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            {props.bulkStatusSelect ? (
              <Select
                value=""
                onValueChange={(value) => {
                  if (!value) return
                  const verb =
                    value === "open"
                      ? props.messages.verbOpened
                      : value === "closed"
                        ? props.messages.verbClosed
                        : value === "cancelled"
                          ? props.messages.verbDeactivated
                          : props.messages.verbClosed
                  props.handleBulkUpdate({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/operations/availability/slots",
                    target: `slots-status-${value}`,
                    nounSingular: props.messages.nouns.slotSingular,
                    nounPlural: props.messages.nouns.slotPlural,
                    payload: { status: value },
                    successVerb: verb,
                    clearSelection,
                  })
                }}
              >
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue placeholder={props.messages.bulkStatusPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">{props.messages.statusOpen}</SelectItem>
                  <SelectItem value="closed">{props.messages.statusClosed}</SelectItem>
                  <SelectItem value="sold_out">{props.messages.statusSoldOut}</SelectItem>
                  <SelectItem value="cancelled">{props.messages.statusCancelled}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <>
                <ConfirmActionButton
                  buttonLabel={props.messages.tabs.slots.bulkOpenButton}
                  confirmLabel={props.messages.tabs.slots.bulkOpenConfirm}
                  title={formatTemplate(props.messages.tabs.slots.bulkOpenTitle, {
                    selection: selection(selectedRows.length),
                  })}
                  description={props.messages.tabs.slots.bulkOpenDescription}
                  disabled={props.bulkActionTarget === "slots-open"}
                  onConfirm={() =>
                    props.handleBulkUpdate({
                      ids: selectedRows.map((row) => row.original.id),
                      endpoint: "/v1/operations/availability/slots",
                      target: "slots-open",
                      nounSingular: props.messages.nouns.slotSingular,
                      nounPlural: props.messages.nouns.slotPlural,
                      payload: { status: "open" },
                      successVerb: props.messages.verbOpened,
                      clearSelection,
                    })
                  }
                />
                <ConfirmActionButton
                  buttonLabel={props.messages.tabs.slots.bulkCloseButton}
                  confirmLabel={props.messages.tabs.slots.bulkCloseConfirm}
                  title={formatTemplate(props.messages.tabs.slots.bulkCloseTitle, {
                    selection: selection(selectedRows.length),
                  })}
                  description={props.messages.tabs.slots.bulkCloseDescription}
                  disabled={props.bulkActionTarget === "slots-close"}
                  onConfirm={() =>
                    props.handleBulkUpdate({
                      ids: selectedRows.map((row) => row.original.id),
                      endpoint: "/v1/operations/availability/slots",
                      target: "slots-close",
                      nounSingular: props.messages.nouns.slotSingular,
                      nounPlural: props.messages.nouns.slotPlural,
                      payload: { status: "closed" },
                      successVerb: props.messages.verbClosed,
                      clearSelection,
                    })
                  }
                />
              </>
            )}
            {props.hideBulkDelete ? null : (
              <ConfirmActionButton
                buttonLabel={props.messages.tabs.slots.bulkDeleteButton}
                confirmLabel={props.messages.tabs.slots.bulkDeleteConfirm}
                title={formatTemplate(props.messages.tabs.slots.bulkDeleteTitle, {
                  selection: selection(selectedRows.length),
                })}
                description={props.messages.tabs.slots.bulkDeleteDescription}
                disabled={props.bulkActionTarget === "slots-delete"}
                variant="destructive"
                confirmVariant="destructive"
                onConfirm={() =>
                  props.handleBulkDelete({
                    ids: selectedRows.map((row) => row.original.id),
                    endpoint: "/v1/operations/availability/slots",
                    target: "slots-delete",
                    nounSingular: props.messages.nouns.slotSingular,
                    nounPlural: props.messages.nouns.slotPlural,
                    clearSelection,
                  })
                }
              />
            )}
          </SelectionActionBar>
        )}
      />
    </>
  )

  return asPanel ? (
    <TabsContent value="slots" className="space-y-4">
      {body}
    </TabsContent>
  ) : (
    <div className="flex flex-col gap-4">{body}</div>
  )
}
