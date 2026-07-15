import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@voyant-travel/ui/components"
import { Plus, Trash2 } from "lucide-react"
import { useProductDetailMessages } from "./host.js"
import { Section } from "./product-detail-section-shell.js"
import type { ChannelInfo, ChannelProductMapping } from "./product-detail-shared.js"

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
  const messages = useProductDetailMessages()
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
                      aria-label={`${productMessages.delete}: ${channel.name}`}
                      title={`${productMessages.delete}: ${channel.name}`}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveChannel(mapping.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
            <a href="/settings/channels" className="underline">
              {productMessages.createChannelsInSettings}
            </a>
          </p>
        ) : null}
      </div>
    </Section>
  )
}
