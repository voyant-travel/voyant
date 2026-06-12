// agent-quality: file-size exception -- owner: distribution-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
import type { ColumnDef } from "@tanstack/react-table"
import { Badge, Button } from "@voyantjs/ui/components"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { ExternalLink } from "lucide-react"
import type { MouseEvent } from "react"
import type { DistributionUiMessages } from "../i18n/index.js"
import {
  type DistributionUiI18n,
  getDistributionUiI18n,
  useDistributionUiMessagesOrDefault,
} from "../i18n/index.js"
import {
  type BookingOption,
  type ChannelBookingLinkRow,
  type ChannelCommissionRuleRow,
  type ChannelContractRow,
  type ChannelProductMappingRow,
  type ChannelRow,
  type ChannelWebhookEventRow,
  cancellationOwnerOptions,
  channelKindOptions,
  channelStatusOptions,
  commissionScopeOptions,
  commissionTypeOptions,
  contractStatusOptions,
  formatSelectionLabel,
  labelById,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  type ProductOption,
  parseJsonRecord,
  paymentOwnerOptions,
  formatDateTime as reactFormatDateTime,
  type SupplierOption,
  toIsoDateTime,
  toLocalDateTimeInput,
  webhookStatusOptions,
} from "../index.js"

export type BatchMutationResponse<T = unknown> = {
  data?: T[]
  deletedIds?: string[]
  total: number
  succeeded: number
  failed: Array<{ id: string; error: string }>
}

export type {
  BookingOption,
  ChannelBookingLinkRow,
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
  ProductOption,
  SupplierOption,
}
export {
  cancellationOwnerOptions,
  channelKindOptions,
  channelStatusOptions,
  commissionScopeOptions,
  commissionTypeOptions,
  contractStatusOptions,
  formatSelectionLabel,
  labelById,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  parseJsonRecord,
  paymentOwnerOptions,
  reactFormatDateTime as formatDateTime,
  toIsoDateTime,
  toLocalDateTimeInput,
  webhookStatusOptions,
}

const defaultDistributionUiI18n = getDistributionUiI18n({ locale: "en" })

function DistributionOpenButton({
  label,
  onClick,
}: {
  label: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  useDistributionUiMessagesOrDefault()
  return (
    <Button variant="ghost" size="sm" aria-label={label} title={label} onClick={onClick}>
      <ExternalLink className="mr-2 h-4 w-4" />
      {label}
    </Button>
  )
}

export function formatDistributionDateTime(
  value: Date | string | number | null | undefined,
  i18n: DistributionUiI18n = defaultDistributionUiI18n,
) {
  if (!value) {
    return i18n.messages.common.dateTimeFallback
  }

  return i18n.formatDateTime(value)
}

export function formatDistributionDate(
  value: Date | string | number | null | undefined,
  i18n: DistributionUiI18n = defaultDistributionUiI18n,
) {
  if (!value) {
    return i18n.messages.common.dateTimeFallback
  }

  return i18n.formatDate(value)
}

export function getChannelKindLabel(kind: ChannelRow["kind"], messages: DistributionUiMessages) {
  return messages.common.channelKindLabels[kind]
}

export function getChannelStatusLabel(
  status: ChannelRow["status"],
  messages: DistributionUiMessages,
) {
  return messages.common.channelStatusLabels[status]
}

export function getContractStatusLabel(
  status: ChannelContractRow["status"],
  messages: DistributionUiMessages,
) {
  return messages.common.contractStatusLabels[status]
}

export function getPaymentOwnerLabel(
  paymentOwner: ChannelContractRow["paymentOwner"],
  messages: DistributionUiMessages,
) {
  return messages.common.paymentOwnerLabels[paymentOwner]
}

export function getCommissionScopeLabel(
  scope: ChannelCommissionRuleRow["scope"],
  messages: DistributionUiMessages,
) {
  return messages.common.commissionScopeLabels[scope]
}

export function getCommissionTypeLabel(
  commissionType: ChannelCommissionRuleRow["commissionType"],
  messages: DistributionUiMessages,
) {
  return messages.common.commissionTypeLabels[commissionType]
}

export function getWebhookStatusLabel(
  status: ChannelWebhookEventRow["status"],
  messages: DistributionUiMessages,
) {
  return messages.common.webhookStatusLabels[status]
}

export const channelColumns = (
  onView: (channelId: string) => void,
  i18n: DistributionUiI18n = defaultDistributionUiI18n,
): ColumnDef<ChannelRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.channel.channel} />
    ),
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.channel.kind} />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{getChannelKindLabel(row.original.kind, i18n.messages)}</Badge>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.channel.status} />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.status === "active" ? "default" : "secondary"}>
        {getChannelStatusLabel(row.original.status, i18n.messages)}
      </Badge>
    ),
  },
  {
    accessorKey: "website",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.channel.website} />
    ),
    cell: ({ row }) => row.original.website ?? i18n.messages.common.emptyValue,
  },
  {
    id: "view",
    header: i18n.messages.common.view,
    cell: ({ row }) => (
      <DistributionOpenButton
        label={i18n.messages.common.open}
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      />
    ),
  },
]

export const contractColumns = (
  channels: ChannelRow[],
  suppliers: SupplierOption[],
  onView: (contractId: string) => void,
  i18n: DistributionUiI18n = defaultDistributionUiI18n,
): ColumnDef<ChannelContractRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.contract.channel} />
    ),
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "supplierId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.contract.supplier} />
    ),
    cell: ({ row }) =>
      row.original.supplierId
        ? labelById(suppliers, row.original.supplierId)
        : i18n.messages.common.emptyValue,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.contract.status} />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{getContractStatusLabel(row.original.status, i18n.messages)}</Badge>
    ),
  },
  {
    accessorKey: "paymentOwner",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.contract.payment} />
    ),
    cell: ({ row }) => getPaymentOwnerLabel(row.original.paymentOwner, i18n.messages),
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.contract.start} />
    ),
    cell: ({ row }) => formatDistributionDate(row.original.startsAt, i18n),
  },
  {
    id: "view",
    header: i18n.messages.common.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        aria-label={i18n.messages.common.open}
        title={i18n.messages.common.open}
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {i18n.messages.common.open}
      </Button>
    ),
  },
]

export const commissionColumns = (
  _contracts: ChannelContractRow[],
  products: ProductOption[],
  onView: (commissionRuleId: string) => void,
  i18n: DistributionUiI18n = defaultDistributionUiI18n,
): ColumnDef<ChannelCommissionRuleRow>[] => [
  {
    accessorKey: "contractId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.commission.contract} />
    ),
    cell: ({ row }) => row.original.contractId,
  },
  {
    accessorKey: "scope",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.commission.scope} />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{getCommissionScopeLabel(row.original.scope, i18n.messages)}</Badge>
    ),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.commission.product} />
    ),
    cell: ({ row }) =>
      row.original.productId
        ? labelById(products, row.original.productId)
        : i18n.messages.common.emptyValue,
  },
  {
    accessorKey: "commissionType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.commission.type} />
    ),
    cell: ({ row }) => getCommissionTypeLabel(row.original.commissionType, i18n.messages),
  },
  {
    accessorKey: "amountCents",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.commission.amount} />
    ),
    cell: ({ row }) => row.original.amountCents ?? i18n.messages.common.emptyValue,
  },
  {
    id: "view",
    header: i18n.messages.common.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        aria-label={i18n.messages.common.open}
        title={i18n.messages.common.open}
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {i18n.messages.common.open}
      </Button>
    ),
  },
]

export const mappingColumns = (
  channels: ChannelRow[],
  products: ProductOption[],
  onView: (mappingId: string) => void,
  i18n: DistributionUiI18n = defaultDistributionUiI18n,
): ColumnDef<ChannelProductMappingRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.mapping.channel} />
    ),
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.mapping.product} />
    ),
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "externalProductId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.mapping.externalProduct} />
    ),
  },
  {
    accessorKey: "active",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.mapping.status} />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? i18n.messages.common.active : i18n.messages.common.inactive}
      </Badge>
    ),
  },
  {
    id: "view",
    header: i18n.messages.common.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        aria-label={i18n.messages.common.open}
        title={i18n.messages.common.open}
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {i18n.messages.common.open}
      </Button>
    ),
  },
]

export const bookingLinkColumns = (
  channels: ChannelRow[],
  bookings: BookingOption[],
  onView: (bookingLinkId: string) => void,
  i18n: DistributionUiI18n = defaultDistributionUiI18n,
): ColumnDef<ChannelBookingLinkRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.bookingLink.channel} />
    ),
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "bookingId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.bookingLink.booking} />
    ),
    cell: ({ row }) => labelById(bookings, row.original.bookingId),
  },
  {
    accessorKey: "externalBookingId",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={i18n.messages.tables.bookingLink.externalBooking}
      />
    ),
    cell: ({ row }) => row.original.externalBookingId ?? i18n.messages.common.emptyValue,
  },
  {
    accessorKey: "externalStatus",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={i18n.messages.tables.bookingLink.externalStatus}
      />
    ),
    cell: ({ row }) => row.original.externalStatus ?? i18n.messages.common.emptyValue,
  },
  {
    accessorKey: "lastSyncedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.bookingLink.synced} />
    ),
    cell: ({ row }) => formatDistributionDateTime(row.original.lastSyncedAt, i18n),
  },
  {
    id: "view",
    header: i18n.messages.common.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        aria-label={i18n.messages.common.open}
        title={i18n.messages.common.open}
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {i18n.messages.common.open}
      </Button>
    ),
  },
]

export const webhookColumns = (
  channels: ChannelRow[],
  onView: (webhookEventId: string) => void,
  i18n: DistributionUiI18n = defaultDistributionUiI18n,
): ColumnDef<ChannelWebhookEventRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.webhook.channel} />
    ),
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "eventType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.webhook.eventType} />
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.webhook.status} />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">{getWebhookStatusLabel(row.original.status, i18n.messages)}</Badge>
    ),
  },
  {
    accessorKey: "receivedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.webhook.received} />
    ),
    cell: ({ row }) => formatDistributionDateTime(row.original.receivedAt, i18n),
  },
  {
    accessorKey: "processedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={i18n.messages.tables.webhook.processed} />
    ),
    cell: ({ row }) => formatDistributionDateTime(row.original.processedAt, i18n),
  },
  {
    id: "view",
    header: i18n.messages.common.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        aria-label={i18n.messages.common.open}
        title={i18n.messages.common.open}
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {i18n.messages.common.open}
      </Button>
    ),
  },
]
