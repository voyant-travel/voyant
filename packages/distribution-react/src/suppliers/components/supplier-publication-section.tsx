"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components/card"

import { useChannels } from "../../hooks/use-channels.js"
import { usePublicationMutation, useSupplierPublications } from "../../hooks/use-publications.js"
import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"
import {
  isDecided,
  nextDecision,
  type SupplierChannelRow,
  supplierChannelRows,
} from "./supplier-publication-model.js"

export interface SupplierPublicationSectionProps {
  supplierId: string
}

/**
 * Where a supplier is published, on the supplier's own page.
 *
 * The rules themselves already existed and were reachable — from Channels, via
 * a per-channel sheet. That is the wrong way round for the question an operator
 * actually arrives with, which is formed while looking at a supplier ("stop
 * putting this one on the website"), not while looking at a channel. Same
 * authority, same endpoints; this only puts the control where the intent forms.
 */
export function SupplierPublicationSection({ supplierId }: SupplierPublicationSectionProps) {
  const messages = useSuppliersUiMessagesOrDefault().detail.publication
  const channelsQuery = useChannels({ limit: 100 })
  const rulesQuery = useSupplierPublications({ supplierId })
  const { upsertSupplier, removeSupplier } = usePublicationMutation()

  const rows = supplierChannelRows(
    channelsQuery.data?.data ?? [],
    rulesQuery.data?.data ?? [],
    supplierId,
  )
  const isLoading = channelsQuery.isLoading || rulesQuery.isLoading
  const isError = channelsQuery.isError || rulesQuery.isError
  const isBusy = upsertSupplier.isPending || removeSupplier.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isError ? (
          <p className="text-destructive text-sm">{messages.loadError}</p>
        ) : isLoading ? (
          <p className="text-muted-foreground text-sm">{messages.loading}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{messages.noChannels}</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y">
              {rows.map((row) => (
                <ChannelRow
                  key={row.channel.id}
                  row={row}
                  disabled={isBusy}
                  onSet={(decision) =>
                    upsertSupplier.mutate({
                      channelId: row.channel.id,
                      supplierId,
                      decision,
                    })
                  }
                  onClear={() => {
                    if (row.rule) removeSupplier.mutate(row.rule.id)
                  }}
                />
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">{messages.reindexNote}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ChannelRow({
  row,
  disabled,
  onSet,
  onClear,
}: {
  row: SupplierChannelRow
  disabled: boolean
  onSet: (decision: "include" | "exclude") => void
  onClear: () => void
}) {
  const messages = useSuppliersUiMessagesOrDefault().detail.publication
  const inactive = row.state === "channel_inactive"

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <div className="truncate font-medium text-sm">{row.channel.name}</div>
        {row.state === "undecided" && (
          <div className="text-muted-foreground text-xs">{messages.undecidedHint}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={badgeVariant(row.state)}>{stateLabel(row.state, messages.states)}</Badge>
        {!inactive && (
          <>
            <Button
              type="button"
              size="sm"
              variant={row.state === "included" ? "outline" : "secondary"}
              disabled={disabled}
              onClick={() => onSet(nextDecision(row.state))}
            >
              {row.state === "included" ? messages.hide : messages.publish}
            </Button>
            {isDecided(row) && (
              <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onClear}>
                {messages.clear}
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  )
}

function stateLabel(
  state: SupplierChannelRow["state"],
  labels: { included: string; excluded: string; undecided: string; channelInactive: string },
): string {
  if (state === "included") return labels.included
  if (state === "excluded") return labels.excluded
  if (state === "channel_inactive") return labels.channelInactive
  return labels.undecided
}

function badgeVariant(state: SupplierChannelRow["state"]): "default" | "secondary" | "outline" {
  if (state === "included") return "default"
  if (state === "excluded") return "secondary"
  return "outline"
}
