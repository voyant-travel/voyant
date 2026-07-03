"use client"

import { formatMessage } from "@voyant-travel/i18n"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyant-travel/ui/components"
import { Archive, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react"
import type { PromotionsUiMessages } from "./i18n/messages.js"
import { type PromotionalOfferRecord, PromotionsApiError } from "./index.js"
import { getOfferStatus } from "./promotions-page-utils.js"

export function PromotionRowActions({
  offer,
  disabled,
  onEdit,
  onArchive,
  onActivate,
  onDelete,
  messages,
}: {
  offer: PromotionalOfferRecord
  disabled: boolean
  onEdit: (offer: PromotionalOfferRecord) => void
  onArchive: (offer: PromotionalOfferRecord) => void | Promise<void>
  onActivate: (offer: PromotionalOfferRecord) => void | Promise<void>
  onDelete: (offer: PromotionalOfferRecord) => void | Promise<void>
  messages: PromotionsUiMessages["promotionsPage"]["actions"]
}) {
  const status = getOfferStatus(offer)
  const isArchived = status === "archived"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          disabled={disabled}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(offer)}>
          <Pencil className="size-4" aria-hidden="true" />
          {messages.edit}
        </DropdownMenuItem>
        {isArchived ? (
          <DropdownMenuItem onClick={() => void onActivate(offer)}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {messages.activate}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void onArchive(offer)}>
            <Archive className="size-4" aria-hidden="true" />
            {messages.archive}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void onDelete(offer)}>
          <Trash2 className="size-4" aria-hidden="true" />
          {messages.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function formatPromotionActionError(
  error: unknown,
  action: string,
  messages: PromotionsUiMessages["promotionsPage"],
) {
  if (
    action === messages.actions.delete &&
    error instanceof PromotionsApiError &&
    error.status === 409
  ) {
    return messages.actions.deleteConflict
  }
  return formatMessage(messages.actions.actionFailedPrefix, {
    action,
    message: error instanceof Error ? error.message : String(error),
  })
}
