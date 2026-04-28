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
import { Badge, Button } from "@voyantjs/voyant-ui/components"
import { DataTableColumnHeader } from "@voyantjs/voyant-ui/components/data-table-column-header"
import { ExternalLink } from "lucide-react"

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

export const channelColumns = (onView: (channelId: string) => void): ColumnDef<ChannelRow>[] => [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Channel" />,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Kind" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.kind.replace("_", " ")}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "active" ? "default" : "secondary"}
        className="capitalize"
      >
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "website",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Website" />,
    cell: ({ row }) => row.original.website ?? "-",
  },
  {
    id: "view",
    header: "View",
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
        Open
      </Button>
    ),
  },
]

export const contractColumns = (
  channels: ChannelRow[],
  suppliers: SupplierOption[],
  onView: (contractId: string) => void,
): ColumnDef<ChannelContractRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Channel" />,
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "supplierId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
    cell: ({ row }) => labelById(suppliers, row.original.supplierId),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "paymentOwner",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Payment" />,
  },
  {
    accessorKey: "startsAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start" />,
  },
  {
    id: "view",
    header: "View",
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
        Open
      </Button>
    ),
  },
]

export const commissionColumns = (
  _contracts: ChannelContractRow[],
  products: ProductOption[],
  onView: (commissionRuleId: string) => void,
): ColumnDef<ChannelCommissionRuleRow>[] => [
  {
    accessorKey: "contractId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contract" />,
    cell: ({ row }) => row.original.contractId,
  },
  {
    accessorKey: "scope",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Scope" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.scope}
      </Badge>
    ),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "commissionType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
  },
  {
    accessorKey: "amountCents",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => row.original.amountCents ?? "-",
  },
  {
    id: "view",
    header: "View",
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
        Open
      </Button>
    ),
  },
]

export const mappingColumns = (
  channels: ChannelRow[],
  products: ProductOption[],
  onView: (mappingId: string) => void,
): ColumnDef<ChannelProductMappingRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Channel" />,
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "productId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
    cell: ({ row }) => labelById(products, row.original.productId),
  },
  {
    accessorKey: "externalProductId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="External Product" />,
  },
  {
    accessorKey: "active",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "view",
    header: "View",
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
        Open
      </Button>
    ),
  },
]

export const bookingLinkColumns = (
  channels: ChannelRow[],
  bookings: BookingOption[],
  onView: (bookingLinkId: string) => void,
): ColumnDef<ChannelBookingLinkRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Channel" />,
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "bookingId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Booking" />,
    cell: ({ row }) => labelById(bookings, row.original.bookingId),
  },
  {
    accessorKey: "externalBookingId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="External Booking" />,
    cell: ({ row }) => row.original.externalBookingId ?? "-",
  },
  {
    accessorKey: "externalStatus",
    header: ({ column }) => <DataTableColumnHeader column={column} title="External Status" />,
    cell: ({ row }) => row.original.externalStatus ?? "-",
  },
  {
    accessorKey: "lastSyncedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Synced" />,
    cell: ({ row }) => formatDateTime(row.original.lastSyncedAt),
  },
  {
    id: "view",
    header: "View",
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
        Open
      </Button>
    ),
  },
]

export const webhookColumns = (
  channels: ChannelRow[],
  onView: (webhookEventId: string) => void,
): ColumnDef<ChannelWebhookEventRow>[] => [
  {
    accessorKey: "channelId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Channel" />,
    cell: ({ row }) => labelById(channels, row.original.channelId),
  },
  {
    accessorKey: "eventType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Event Type" />,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "receivedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Received" />,
    cell: ({ row }) => formatDateTime(row.original.receivedAt),
  },
  {
    accessorKey: "processedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Processed" />,
    cell: ({ row }) => formatDateTime(row.original.processedAt),
  },
  {
    id: "view",
    header: "View",
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
        Open
      </Button>
    ),
  },
]
