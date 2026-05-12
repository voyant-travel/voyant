"use client"

import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table"
import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  ProductOption,
} from "@voyantjs/availability-react"
import { ConfirmActionButton, SelectionActionBar } from "@voyantjs/ui/components"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { TabsContent } from "@voyantjs/ui/components/tabs"
import type { ReactNode } from "react"
import { useAvailabilityUiMessagesOrDefault } from "../i18n/index.js"
import { formatLocalizedSelectionLabel } from "../utils.js"
import {
  type AvailabilityColumnsMessages,
  availabilityCloseoutColumns,
  availabilityPickupPointColumns,
  availabilityRuleColumns,
  availabilitySlotColumns,
  availabilityStartTimeColumns,
} from "./availability-columns.js"
import { AvailabilitySectionHeader } from "./availability-section-header.js"

type MessageValues = Record<string, string | number>

function formatTemplate(template: string, values: MessageValues) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key]
    return value == null ? match : String(value)
  })
}

export interface AvailabilityTabMessages extends AvailabilityColumnsMessages {
  nouns: {
    slotSingular: string
    slotPlural: string
    ruleSingular: string
    rulePlural: string
    startTimeSingular: string
    startTimePlural: string
    closeoutSingular: string
    closeoutPlural: string
    pickupPointSingular: string
    pickupPointPlural: string
  }
  tabs: {
    slots: AvailabilitySlotTabMessages
    rules: AvailabilityToggleTabMessages
    startTimes: AvailabilityToggleTabMessages
    closeouts: AvailabilityDeleteOnlyTabMessages
    pickupPoints: AvailabilityToggleTabMessages
  }
  verbOpened: string
  verbClosed: string
  verbActivated: string
  verbDeactivated: string
}

interface AvailabilityBaseTabMessages {
  title: string
  description: string
  actionLabel: string
  emptyMessage: string
  bulkDeleteButton: string
  bulkDeleteConfirm: string
  bulkDeleteTitle: string
  bulkDeleteDescription: string
}

interface AvailabilitySlotTabMessages extends AvailabilityBaseTabMessages {
  bulkOpenButton: string
  bulkOpenConfirm: string
  bulkOpenTitle: string
  bulkOpenDescription: string
  bulkCloseButton: string
  bulkCloseConfirm: string
  bulkCloseTitle: string
  bulkCloseDescription: string
}

interface AvailabilityToggleTabMessages extends AvailabilityBaseTabMessages {
  bulkActivateButton: string
  bulkActivateConfirm: string
  bulkActivateTitle: string
  bulkActivateDescription: string
  bulkDeactivateButton: string
  bulkDeactivateConfirm: string
  bulkDeactivateTitle: string
  bulkDeactivateDescription: string
}

type AvailabilityDeleteOnlyTabMessages = AvailabilityBaseTabMessages

export type AvailabilityBulkUpdateFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  nounSingular: string
  nounPlural: string
  payload: Record<string, unknown>
  successVerb: string
  clearSelection: () => void
}) => Promise<void>

export type AvailabilityBulkDeleteFn = (args: {
  ids: string[]
  endpoint: string
  target: string
  nounSingular: string
  nounPlural: string
  clearSelection: () => void
}) => Promise<void>

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
}) {
  useAvailabilityUiMessagesOrDefault()
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      props.messages.nouns.slotSingular,
      props.messages.nouns.slotPlural,
    )

  return (
    <TabsContent value="slots" className="space-y-4">
      <AvailabilitySectionHeader
        title={props.messages.tabs.slots.title}
        description={props.messages.tabs.slots.description}
        actionLabel={props.messages.tabs.slots.actionLabel}
        onAction={props.onCreate}
      />
      {props.toolbar}
      <DataTable
        columns={availabilitySlotColumns(props.products, props.onOpenRoute, props.messages)}
        data={props.filteredSlots}
        emptyMessage={props.messages.tabs.slots.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.slotSelection}
        onRowSelectionChange={props.setSlotSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
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
                  endpoint: "/v1/availability/slots",
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
                  endpoint: "/v1/availability/slots",
                  target: "slots-close",
                  nounSingular: props.messages.nouns.slotSingular,
                  nounPlural: props.messages.nouns.slotPlural,
                  payload: { status: "closed" },
                  successVerb: props.messages.verbClosed,
                  clearSelection,
                })
              }
            />
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
                  endpoint: "/v1/availability/slots",
                  target: "slots-delete",
                  nounSingular: props.messages.nouns.slotSingular,
                  nounPlural: props.messages.nouns.slotPlural,
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
  messages: AvailabilityTabMessages
  products: ProductOption[]
  filteredRules: AvailabilityRuleRow[]
  ruleSelection: RowSelectionState
  setRuleSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: AvailabilityBulkUpdateFn
  handleBulkDelete: AvailabilityBulkDeleteFn
  onCreate: () => void
  onOpenRoute: (ruleId: string) => void
  onEdit: (row: AvailabilityRuleRow) => void
  toolbar?: ReactNode
}) {
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      props.messages.nouns.ruleSingular,
      props.messages.nouns.rulePlural,
    )

  return (
    <TabsContent value="rules" className="space-y-4">
      <AvailabilitySectionHeader
        title={props.messages.tabs.rules.title}
        description={props.messages.tabs.rules.description}
        actionLabel={props.messages.tabs.rules.actionLabel}
        onAction={props.onCreate}
      />
      {props.toolbar}
      <DataTable
        columns={availabilityRuleColumns(props.products, props.onOpenRoute, props.messages)}
        data={props.filteredRules}
        emptyMessage={props.messages.tabs.rules.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.ruleSelection}
        onRowSelectionChange={props.setRuleSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.rules.bulkActivateButton}
              confirmLabel={props.messages.tabs.rules.bulkActivateConfirm}
              title={formatTemplate(props.messages.tabs.rules.bulkActivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.rules.bulkActivateDescription}
              disabled={props.bulkActionTarget === "rules-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-activate",
                  nounSingular: props.messages.nouns.ruleSingular,
                  nounPlural: props.messages.nouns.rulePlural,
                  payload: { active: true },
                  successVerb: props.messages.verbActivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.rules.bulkDeactivateButton}
              confirmLabel={props.messages.tabs.rules.bulkDeactivateConfirm}
              title={formatTemplate(props.messages.tabs.rules.bulkDeactivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.rules.bulkDeactivateDescription}
              disabled={props.bulkActionTarget === "rules-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-deactivate",
                  nounSingular: props.messages.nouns.ruleSingular,
                  nounPlural: props.messages.nouns.rulePlural,
                  payload: { active: false },
                  successVerb: props.messages.verbDeactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.rules.bulkDeleteButton}
              confirmLabel={props.messages.tabs.rules.bulkDeleteConfirm}
              title={formatTemplate(props.messages.tabs.rules.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.rules.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "rules-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/rules",
                  target: "rules-delete",
                  nounSingular: props.messages.nouns.ruleSingular,
                  nounPlural: props.messages.nouns.rulePlural,
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
  messages: AvailabilityTabMessages
  products: ProductOption[]
  filteredStartTimes: AvailabilityStartTimeRow[]
  startTimeSelection: RowSelectionState
  setStartTimeSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: AvailabilityBulkUpdateFn
  handleBulkDelete: AvailabilityBulkDeleteFn
  onCreate: () => void
  onOpenRoute: (startTimeId: string) => void
  onEdit: (row: AvailabilityStartTimeRow) => void
  toolbar?: ReactNode
}) {
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      props.messages.nouns.startTimeSingular,
      props.messages.nouns.startTimePlural,
    )

  return (
    <TabsContent value="start-times" className="space-y-4">
      <AvailabilitySectionHeader
        title={props.messages.tabs.startTimes.title}
        description={props.messages.tabs.startTimes.description}
        actionLabel={props.messages.tabs.startTimes.actionLabel}
        onAction={props.onCreate}
      />
      {props.toolbar}
      <DataTable
        columns={availabilityStartTimeColumns(props.products, props.onOpenRoute, props.messages)}
        data={props.filteredStartTimes}
        emptyMessage={props.messages.tabs.startTimes.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.startTimeSelection}
        onRowSelectionChange={props.setStartTimeSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.startTimes.bulkActivateButton}
              confirmLabel={props.messages.tabs.startTimes.bulkActivateConfirm}
              title={formatTemplate(props.messages.tabs.startTimes.bulkActivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.startTimes.bulkActivateDescription}
              disabled={props.bulkActionTarget === "start-times-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-activate",
                  nounSingular: props.messages.nouns.startTimeSingular,
                  nounPlural: props.messages.nouns.startTimePlural,
                  payload: { active: true },
                  successVerb: props.messages.verbActivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.startTimes.bulkDeactivateButton}
              confirmLabel={props.messages.tabs.startTimes.bulkDeactivateConfirm}
              title={formatTemplate(props.messages.tabs.startTimes.bulkDeactivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.startTimes.bulkDeactivateDescription}
              disabled={props.bulkActionTarget === "start-times-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-deactivate",
                  nounSingular: props.messages.nouns.startTimeSingular,
                  nounPlural: props.messages.nouns.startTimePlural,
                  payload: { active: false },
                  successVerb: props.messages.verbDeactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.startTimes.bulkDeleteButton}
              confirmLabel={props.messages.tabs.startTimes.bulkDeleteConfirm}
              title={formatTemplate(props.messages.tabs.startTimes.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.startTimes.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "start-times-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/start-times",
                  target: "start-times-delete",
                  nounSingular: props.messages.nouns.startTimeSingular,
                  nounPlural: props.messages.nouns.startTimePlural,
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

export function AvailabilityCloseoutsTab(props: {
  messages: AvailabilityTabMessages
  products: ProductOption[]
  filteredCloseouts: AvailabilityCloseoutRow[]
  closeoutSelection: RowSelectionState
  setCloseoutSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkDelete: AvailabilityBulkDeleteFn
  onCreate: () => void
  onEdit: (row: AvailabilityCloseoutRow) => void
  toolbar?: ReactNode
}) {
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      props.messages.nouns.closeoutSingular,
      props.messages.nouns.closeoutPlural,
    )

  return (
    <TabsContent value="closeouts" className="space-y-4">
      <AvailabilitySectionHeader
        title={props.messages.tabs.closeouts.title}
        description={props.messages.tabs.closeouts.description}
        actionLabel={props.messages.tabs.closeouts.actionLabel}
        onAction={props.onCreate}
      />
      {props.toolbar}
      <DataTable
        columns={availabilityCloseoutColumns(props.products, props.messages)}
        data={props.filteredCloseouts}
        emptyMessage={props.messages.tabs.closeouts.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.closeoutSelection}
        onRowSelectionChange={props.setCloseoutSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.closeouts.bulkDeleteButton}
              confirmLabel={props.messages.tabs.closeouts.bulkDeleteConfirm}
              title={formatTemplate(props.messages.tabs.closeouts.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.closeouts.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "closeouts-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/closeouts",
                  target: "closeouts-delete",
                  nounSingular: props.messages.nouns.closeoutSingular,
                  nounPlural: props.messages.nouns.closeoutPlural,
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
  messages: AvailabilityTabMessages
  products: ProductOption[]
  filteredPickupPoints: AvailabilityPickupPointRow[]
  pickupPointSelection: RowSelectionState
  setPickupPointSelection: OnChangeFn<RowSelectionState>
  bulkActionTarget: string | null
  handleBulkUpdate: AvailabilityBulkUpdateFn
  handleBulkDelete: AvailabilityBulkDeleteFn
  onCreate: () => void
  onEdit: (row: AvailabilityPickupPointRow) => void
  toolbar?: ReactNode
}) {
  const selection = (count: number) =>
    formatLocalizedSelectionLabel(
      count,
      props.messages.nouns.pickupPointSingular,
      props.messages.nouns.pickupPointPlural,
    )

  return (
    <TabsContent value="pickup-points" className="space-y-4">
      <AvailabilitySectionHeader
        title={props.messages.tabs.pickupPoints.title}
        description={props.messages.tabs.pickupPoints.description}
        actionLabel={props.messages.tabs.pickupPoints.actionLabel}
        onAction={props.onCreate}
      />
      {props.toolbar}
      <DataTable
        columns={availabilityPickupPointColumns(props.products, props.messages)}
        data={props.filteredPickupPoints}
        emptyMessage={props.messages.tabs.pickupPoints.emptyMessage}
        enableRowSelection
        getRowId={(row) => row.id}
        rowSelection={props.pickupPointSelection}
        onRowSelectionChange={props.setPickupPointSelection}
        renderSelectionActions={({ selectedRows, clearSelection }) => (
          <SelectionActionBar selectedCount={selectedRows.length} onClear={clearSelection}>
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.pickupPoints.bulkActivateButton}
              confirmLabel={props.messages.tabs.pickupPoints.bulkActivateConfirm}
              title={formatTemplate(props.messages.tabs.pickupPoints.bulkActivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.pickupPoints.bulkActivateDescription}
              disabled={props.bulkActionTarget === "pickup-points-activate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-activate",
                  nounSingular: props.messages.nouns.pickupPointSingular,
                  nounPlural: props.messages.nouns.pickupPointPlural,
                  payload: { active: true },
                  successVerb: props.messages.verbActivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.pickupPoints.bulkDeactivateButton}
              confirmLabel={props.messages.tabs.pickupPoints.bulkDeactivateConfirm}
              title={formatTemplate(props.messages.tabs.pickupPoints.bulkDeactivateTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.pickupPoints.bulkDeactivateDescription}
              disabled={props.bulkActionTarget === "pickup-points-deactivate"}
              onConfirm={() =>
                props.handleBulkUpdate({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-deactivate",
                  nounSingular: props.messages.nouns.pickupPointSingular,
                  nounPlural: props.messages.nouns.pickupPointPlural,
                  payload: { active: false },
                  successVerb: props.messages.verbDeactivated,
                  clearSelection,
                })
              }
            />
            <ConfirmActionButton
              buttonLabel={props.messages.tabs.pickupPoints.bulkDeleteButton}
              confirmLabel={props.messages.tabs.pickupPoints.bulkDeleteConfirm}
              title={formatTemplate(props.messages.tabs.pickupPoints.bulkDeleteTitle, {
                selection: selection(selectedRows.length),
              })}
              description={props.messages.tabs.pickupPoints.bulkDeleteDescription}
              disabled={props.bulkActionTarget === "pickup-points-delete"}
              variant="destructive"
              confirmVariant="destructive"
              onConfirm={() =>
                props.handleBulkDelete({
                  ids: selectedRows.map((row) => row.original.id),
                  endpoint: "/v1/availability/pickup-points",
                  target: "pickup-points-delete",
                  nounSingular: props.messages.nouns.pickupPointSingular,
                  nounPlural: props.messages.nouns.pickupPointPlural,
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
