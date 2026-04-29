import { Link } from "@tanstack/react-router"
import { formatMessage } from "@voyantjs/admin"
import { describeRRule } from "@voyantjs/availability/rrule"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components"
import { Separator } from "@voyantjs/ui/components/separator"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"
import type { DepartureSlot } from "./product-departure-dialog"
import {
  type AvailabilityRule,
  type ChannelInfo,
  type ChannelProductMapping,
  formatAmount,
  formatCapacityLabel,
  formatDuration,
  formatMargin,
  formatSlotDate,
  formatSlotTime,
  getDepartureStatusLabel,
  getProductBookingModeLabel,
  type ProductMediaItem,
  type ProductRecord,
  slotStatusVariant,
} from "./product-detail-shared"
import { ProductMediaGallery } from "./product-media-gallery"

export function Section({
  title,
  actions,
  children,
  contentClassName,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  contentClassName?: string
}) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="font-semibold leading-none tracking-tight">{title}</h2>
        {actions}
      </div>
      <Separator />
      <div className={contentClassName ?? "px-6 py-4"}>{children}</div>
    </div>
  )
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm [&:not(:last-child)]:border-b">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function ActionMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>
}

export function ProductDetailsSection({
  product,
  onEdit,
}: {
  product: ProductRecord
  onEdit: () => void
}) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  return (
    <Section
      title={productMessages.detailsTitle}
      actions={
        <ActionMenu>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {productMessages.edit}
          </DropdownMenuItem>
        </ActionMenu>
      }
    >
      {product.description ? (
        <div className="border-b pb-3 text-sm whitespace-pre-line text-muted-foreground">
          {product.description}
        </div>
      ) : null}
      {product.sellAmountCents != null ? (
        <DetailRow
          label={productMessages.sellLabel}
          value={
            <span className="font-mono">
              {formatAmount(product.sellAmountCents, product.sellCurrency)}
            </span>
          }
        />
      ) : null}
      {product.costAmountCents != null ? (
        <DetailRow
          label={productMessages.costLabel}
          value={
            <span className="font-mono">
              {formatAmount(product.costAmountCents, product.sellCurrency)}
            </span>
          }
        />
      ) : null}
      {product.marginPercent != null ? (
        <DetailRow
          label={productMessages.marginLabel}
          value={<span className="font-mono">{formatMargin(product.marginPercent)}</span>}
        />
      ) : null}
    </Section>
  )
}

export function ProductDeparturesSection({
  slots,
  itineraryNameById,
  onCreate,
  onEdit,
  onDelete,
}: {
  slots: DepartureSlot[]
  itineraryNameById: Map<string, string>
  onCreate: () => void
  onEdit: (slot: DepartureSlot) => void
  onDelete: (slotId: string) => void
}) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  return (
    <Section
      title={productMessages.departuresTitle}
      actions={
        <ActionMenu>
          <DropdownMenuItem onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {productMessages.newDeparture}
          </DropdownMenuItem>
        </ActionMenu>
      }
      contentClassName=""
    >
      {slots.length === 0 ? (
        <EmptyState message={productMessages.departuresEmpty} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2.5 pl-6 pr-3 text-left font-medium">
                {productMessages.departureStartColumn}
              </th>
              <th className="px-3 py-2.5 text-left font-medium">
                {productMessages.departureEndColumn}
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Itinerary</th>
              <th className="px-3 py-2.5 text-left font-medium">
                {productMessages.departureDurationColumn}
              </th>
              <th className="px-3 py-2.5 text-left font-medium">
                {productMessages.departureStatusColumn}
              </th>
              <th className="px-3 py-2.5 text-left font-medium">
                {productMessages.departureCapacityColumn}
              </th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id} className="border-b last:border-b-0">
                <td className="py-2.5 pl-6 pr-3">
                  <div className="font-mono text-xs">{slot.dateLocal}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatSlotTime(slot.startsAt)}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {slot.endsAt ? (
                    <>
                      <div className="font-mono text-xs">{formatSlotDate(slot.endsAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatSlotTime(slot.endsAt)}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{productMessages.noValue}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  {slot.itineraryId
                    ? (itineraryNameById.get(slot.itineraryId) ?? "Custom override")
                    : "Default"}
                </td>
                <td className="px-3 py-2.5 text-xs">{formatDuration(slot)}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={slotStatusVariant[slot.status]} className="text-xs">
                    {getDepartureStatusLabel(slot.status, messages)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">
                  {formatCapacityLabel(slot, messages)}
                </td>
                <td className="px-3 py-2.5">
                  <ActionMenu>
                    <DropdownMenuItem onClick={() => onEdit(slot)}>
                      <Pencil className="h-4 w-4" />
                      {productMessages.edit}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(slot.id)}>
                      <Trash2 className="h-4 w-4" />
                      {productMessages.delete}
                    </DropdownMenuItem>
                  </ActionMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

export function ProductSchedulesSection({
  rules,
  onCreate,
  onEdit,
  onDelete,
}: {
  rules: AvailabilityRule[]
  onCreate: () => void
  onEdit: (rule: AvailabilityRule) => void
  onDelete: (ruleId: string) => void
}) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  return (
    <Section
      title={productMessages.schedulesTitle}
      actions={
        <ActionMenu>
          <DropdownMenuItem onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {productMessages.newSchedule}
          </DropdownMenuItem>
        </ActionMenu>
      }
    >
      {rules.length === 0 ? (
        <EmptyState message={productMessages.schedulesEmpty} />
      ) : (
        <div className="flex flex-col divide-y">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{describeRRule(rule.recurrenceRule)}</span>
                  {!rule.active ? (
                    <Badge variant="outline" className="text-xs">
                      {productMessages.inactiveBadge}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatMessage(productMessages.scheduleSummary, {
                    maxCapacity: rule.maxCapacity,
                    timezone: rule.timezone,
                    cutoff:
                      rule.cutoffMinutes != null
                        ? formatMessage(productMessages.scheduleCutoffSuffix, {
                            minutes: rule.cutoffMinutes,
                          })
                        : "",
                  })}
                </p>
              </div>
              <ActionMenu>
                <DropdownMenuItem onClick={() => onEdit(rule)}>
                  <Pencil className="h-4 w-4" />
                  {productMessages.edit}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                  {productMessages.delete}
                </DropdownMenuItem>
              </ActionMenu>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

export function ProductChannelsSection({
  allChannels,
  mappings,
  onAddChannel,
  onRemoveChannel,
}: {
  allChannels: ChannelInfo[]
  mappings: ChannelProductMapping[]
  onAddChannel: (channelId: string) => void
  onRemoveChannel: (mappingId: string) => void
}) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  const assignedChannelIds = new Set(mappings.map((mapping) => mapping.channelId))
  const assignedChannels = allChannels.filter((channel) => assignedChannelIds.has(channel.id))
  const unassignedChannels = allChannels.filter(
    (channel) => !assignedChannelIds.has(channel.id) && channel.status === "active",
  )

  return (
    <Section title={productMessages.channelsTitle}>
      <div className="flex flex-col gap-3">
        {assignedChannels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{productMessages.channelsEmpty}</p>
        ) : (
          <div className="flex flex-col divide-y">
            {assignedChannels.map((channel) => {
              const mapping = mappings.find((entry) => entry.channelId === channel.id)
              return (
                <div
                  key={channel.id}
                  className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{channel.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {channel.kind.replace("_", " ")}
                    </Badge>
                  </div>
                  {mapping ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveChannel(mapping.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        {unassignedChannels.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {productMessages.addChannel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {unassignedChannels.map((channel) => (
                <DropdownMenuItem key={channel.id} onClick={() => onAddChannel(channel.id)}>
                  {channel.name}
                  <span className="ml-auto text-xs capitalize text-muted-foreground">
                    {channel.kind.replace("_", " ")}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {allChannels.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {productMessages.noChannelsDefined}{" "}
            <Link to="/settings/channels" className="underline">
              {productMessages.createChannelsInSettings}
            </Link>
          </p>
        ) : null}
      </div>
    </Section>
  )
}

export function ProductOrganizeSection({
  product,
  onEdit,
}: {
  product: ProductRecord
  onEdit: () => void
}) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  return (
    <Section
      title={productMessages.organizeTitle}
      actions={
        <ActionMenu>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {productMessages.edit}
          </DropdownMenuItem>
        </ActionMenu>
      }
    >
      <DetailRow
        label={productMessages.tagsLabel}
        value={
          product.tags.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{productMessages.noValue}</span>
          )
        }
      />
      <DetailRow
        label={productMessages.typeLabel}
        value={<span>{getProductBookingModeLabel(product.bookingMode, messages)}</span>}
      />
    </Section>
  )
}

export function ProductMediaSection({
  productId,
  media,
  isUploading,
  onUpload,
  onSetCover,
  onDelete,
}: {
  productId: string
  media: ProductMediaItem[]
  isUploading: boolean
  onUpload: (file: File) => void
  onSetCover: (mediaId: string) => void
  onDelete: (mediaId: string) => void
}) {
  const messages = useAdminMessages()
  return (
    <Section title={messages.products.core.mediaTitle}>
      <div className="flex flex-col gap-4">
        <ProductMediaGallery
          productId={productId}
          media={media}
          isUploading={isUploading}
          onUpload={onUpload}
          onSetCover={onSetCover}
          onDelete={onDelete}
        />
      </div>
    </Section>
  )
}
