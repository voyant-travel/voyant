import type { ColumnDef } from "@tanstack/react-table"
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
  formatDateTime,
  formatSelectionLabel,
  labelById,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  type ProductOption,
  parseJsonRecord,
  paymentOwnerOptions,
  type SupplierOption,
  toIsoDateTime,
  toLocalDateTimeInput,
  webhookStatusOptions,
} from "@voyantjs/distribution-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { ExternalLink } from "lucide-react"
import type { AdminMessages } from "@/lib/admin-i18n"

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
  formatDateTime,
  formatSelectionLabel,
  labelById,
  NONE_VALUE,
  nullableNumber,
  nullableString,
  parseJsonRecord,
  paymentOwnerOptions,
  toIsoDateTime,
  toLocalDateTimeInput,
  webhookStatusOptions,
}

type DistributionMessages = AdminMessages["distribution"]
type SelectionNouns = { singular: string; plural: string }

function labelFromMap(
  labels: Record<string, string>,
  value: string | null | undefined,
  fallback: string,
) {
  if (!value) return fallback
  return labels[value] ?? fallback
}

export function formatLocalizedSelectionLabel(count: number, nouns: SelectionNouns) {
  return `${count} ${count === 1 ? nouns.singular : nouns.plural}`
}

export function formatDistributionDate(
  value: string | null | undefined,
  locale: string,
  fallback: string,
) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date)
}

export function formatDistributionDateTime(
  value: string | null | undefined,
  locale: string,
  fallback: string,
) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export const channelColumns = (
  messages: DistributionMessages,
  onView: (channelId: string) => void,
): ColumnDef<ChannelRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.channel} />
    ),
  },
  {
    accessorKey: "kind",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.kind} />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {labelFromMap(messages.values.channelKind, row.original.kind, row.original.kind)}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.status} />,
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "active" ? "default" : "secondary"}
        className="capitalize"
      >
        {labelFromMap(messages.values.channelStatus, row.original.status, row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "website",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.website} />
    ),
    cell: ({ row }) => row.original.website ?? messages.table.noValue,
  },
  {
    id: "view",
    header: messages.table.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {messages.table.open}
      </Button>
    ),
  },
]

export const contractColumns = (
  messages: DistributionMessages,
  locale: string,
  channels: ChannelRow[],
  suppliers: SupplierOption[],
  onView: (contractId: string) => void,
): ColumnDef<ChannelContractRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.channel} />
    ),
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "supplierId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.supplier} />
    ),
    cell: ({ row }) => labelById(suppliers, row.original.supplierId),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.status} />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {labelFromMap(messages.values.contractStatus, row.original.status, row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "paymentOwner",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.payment} />
    ),
    cell: ({ row }) =>
      labelFromMap(
        messages.values.paymentOwner,
        row.original.paymentOwner,
        row.original.paymentOwner,
      ),
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.start} />,
    cell: ({ row }) =>
      formatDistributionDate(row.original.startsAt, locale, messages.table.noValue),
  },
  {
    id: "view",
    header: messages.table.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {messages.table.open}
      </Button>
    ),
  },
]

export const commissionColumns = (
  messages: DistributionMessages,
  _contracts: ChannelContractRow[],
  products: ProductOption[],
  onView: (commissionRuleId: string) => void,
): ColumnDef<ChannelCommissionRuleRow>[] => [
  {
    accessorKey: "contractId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.contract} />
    ),
    cell: ({ row }) => row.original.contractId,
  },
  {
    accessorKey: "scope",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.scope} />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {labelFromMap(messages.values.commissionScope, row.original.scope, row.original.scope)}
      </Badge>
    ),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.product} />
    ),
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "commissionType",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.type} />,
    cell: ({ row }) =>
      labelFromMap(
        messages.values.commissionType,
        row.original.commissionType,
        row.original.commissionType,
      ),
  },
  {
    accessorKey: "amountCents",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.amount} />,
    cell: ({ row }) => row.original.amountCents ?? messages.table.noValue,
  },
  {
    id: "view",
    header: messages.table.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {messages.table.open}
      </Button>
    ),
  },
]

export const mappingColumns = (
  messages: DistributionMessages,
  channels: ChannelRow[],
  products: ProductOption[],
  onView: (mappingId: string) => void,
): ColumnDef<ChannelProductMappingRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.channel} />
    ),
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.product} />
    ),
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "externalProductId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.externalProduct} />
    ),
  },
  {
    accessorKey: "active",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.status} />,
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active
          ? messages.values.mappingStatus.active
          : messages.values.mappingStatus.inactive}
      </Badge>
    ),
  },
  {
    id: "view",
    header: messages.table.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {messages.table.open}
      </Button>
    ),
  },
]

export const bookingLinkColumns = (
  messages: DistributionMessages,
  locale: string,
  channels: ChannelRow[],
  bookings: BookingOption[],
  onView: (bookingLinkId: string) => void,
): ColumnDef<ChannelBookingLinkRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.channel} />
    ),
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "bookingId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.booking} />
    ),
    cell: ({ row }) => labelById(bookings, row.original.bookingId),
  },
  {
    accessorKey: "externalBookingId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.externalBooking} />
    ),
    cell: ({ row }) => row.original.externalBookingId ?? messages.table.noValue,
  },
  {
    accessorKey: "externalStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.externalStatus} />
    ),
    cell: ({ row }) => row.original.externalStatus ?? messages.table.noValue,
  },
  {
    accessorKey: "lastSyncedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.synced} />,
    cell: ({ row }) =>
      formatDistributionDateTime(row.original.lastSyncedAt, locale, messages.table.noValue),
  },
  {
    id: "view",
    header: messages.table.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {messages.table.open}
      </Button>
    ),
  },
]

export const webhookColumns = (
  messages: DistributionMessages,
  locale: string,
  channels: ChannelRow[],
  onView: (webhookEventId: string) => void,
): ColumnDef<ChannelWebhookEventRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.channel} />
    ),
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "eventType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.eventType} />
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title={messages.table.status} />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {labelFromMap(messages.values.webhookStatus, row.original.status, row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "receivedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.received} />
    ),
    cell: ({ row }) =>
      formatDistributionDateTime(row.original.receivedAt, locale, messages.table.noValue),
  },
  {
    accessorKey: "processedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={messages.table.processed} />
    ),
    cell: ({ row }) =>
      formatDistributionDateTime(row.original.processedAt, locale, messages.table.noValue),
  },
  {
    id: "view",
    header: messages.table.view,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(event) => {
          event.stopPropagation()
          onView(row.original.id)
        }}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {messages.table.open}
      </Button>
    ),
  },
]
