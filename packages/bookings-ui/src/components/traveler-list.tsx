"use client"

import {
  type BookingTravelerRecord,
  useRevealTraveler,
  useTravelerMutation,
  useTravelers,
} from "@voyantjs/bookings-react"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import * as React from "react"

import { useBookingsUiMessagesOrDefault } from "../i18n/provider"
import { TravelerDialog } from "./traveler-dialog"

export interface TravelerListProps {
  bookingId: string
}

export function TravelerList({ bookingId }: TravelerListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingTravelerRecord | undefined>(undefined)
  const [revealedIds, setRevealedIds] = React.useState<Set<string>>(new Set())
  const { data } = useTravelers(bookingId)
  const { remove } = useTravelerMutation(bookingId)
  const messages = useBookingsUiMessagesOrDefault()

  const travelers = data?.data ?? []

  // Detect whether the list endpoint already returned unmasked data
  // (caller has bookings-pii:* scope or similar). If so, don't show
  // the reveal button — there's nothing to unmask.
  const allAlreadyRevealed = React.useMemo(() => {
    if (travelers.length === 0) return true
    return travelers.every((t) => !looksRedacted(t))
  }, [travelers])

  const toggleReveal = React.useCallback((travelerId: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(travelerId)) next.delete(travelerId)
      else next.add(travelerId)
      return next
    })
  }, [])

  return (
    <Card data-slot="traveler-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {messages.travelerList.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.travelerList.addTraveler}
        </Button>
      </CardHeader>
      <CardContent>
        {travelers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.travelerList.empty}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">
                    {messages.travelerList.columns.name}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.travelerList.columns.email}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.travelerList.columns.phone}
                  </th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {travelers.map((traveler) => (
                  <TravelerRow
                    key={traveler.id}
                    bookingId={bookingId}
                    traveler={traveler}
                    revealed={revealedIds.has(traveler.id)}
                    onToggleReveal={
                      allAlreadyRevealed ? undefined : () => toggleReveal(traveler.id)
                    }
                    emailUnavailable={messages.travelerList.values.emailUnavailable}
                    phoneUnavailable={messages.travelerList.values.phoneUnavailable}
                    onEdit={() => {
                      setEditing(traveler)
                      setDialogOpen(true)
                    }}
                    onDelete={() => {
                      if (confirm(messages.travelerList.actions.deleteConfirm)) {
                        remove.mutate(traveler.id)
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <TravelerDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        traveler={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />
    </Card>
  )
}

/**
 * Single traveler row. Calls `useRevealTraveler` lazily — only fires
 * when `revealed=true`. The reveal endpoint audit-logs the access on
 * the server, so toggling the eye button creates a permanent record.
 */
function TravelerRow({
  bookingId,
  traveler,
  revealed,
  onToggleReveal,
  emailUnavailable,
  phoneUnavailable,
  onEdit,
  onDelete,
}: {
  bookingId: string
  traveler: BookingTravelerRecord
  revealed: boolean
  /** When undefined, the reveal toggle is hidden (data is already unmasked). */
  onToggleReveal?: () => void
  emailUnavailable: string
  phoneUnavailable: string
  onEdit: () => void
  onDelete: () => void
}) {
  const reveal = useRevealTraveler(bookingId, traveler.id, { enabled: revealed })
  // Use the revealed copy when available; otherwise fall back to
  // the masked row from the list endpoint. This keeps the UI snappy
  // — the masked row renders instantly, then swaps to unmasked the
  // moment the network returns.
  const display = revealed && reveal.data?.data ? reveal.data.data : traveler
  const showLoading = revealed && reveal.isLoading
  const revealError = revealed && reveal.error

  return (
    <tr className="border-b last:border-b-0">
      <td className="p-2">
        {showLoading ? (
          <RowLoading />
        ) : (
          `${display.firstName ?? ""} ${display.lastName ?? ""}`.trim()
        )}
      </td>
      <td className="p-2">{showLoading ? <RowLoading /> : (display.email ?? emailUnavailable)}</td>
      <td className="p-2">{showLoading ? <RowLoading /> : (display.phone ?? phoneUnavailable)}</td>
      <td className="p-2">
        <div className="flex items-center gap-1">
          {onToggleReveal ? (
            <button
              type="button"
              onClick={onToggleReveal}
              className="text-muted-foreground hover:text-foreground"
              title={revealed ? "Hide details" : "Reveal contact details"}
              aria-label={
                revealed ? "Hide traveler contact details" : "Reveal traveler contact details"
              }
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Edit traveler"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete traveler"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {revealError ? (
          <div className="mt-1 text-[10px] text-destructive">
            {revealError instanceof Error ? revealError.message : "Reveal failed"}
          </div>
        ) : null}
      </td>
    </tr>
  )
}

function RowLoading() {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span className="text-xs">Decrypting…</span>
    </span>
  )
}

/**
 * Heuristic check for redaction markers used by `redactTravelerIdentity`
 * on the API. We can't import the redactor from `@voyantjs/bookings`
 * at the UI layer (would pull in a server dep), so probe for the
 * canonical patterns the redactor produces (`***`, `*@`, `***1234`).
 *
 * If any field on this traveler shows a redaction marker, treat the
 * row as redacted and surface the reveal button. Conservative: false
 * positives (genuine `***` data) just keep the button visible, which
 * is harmless.
 */
function looksRedacted(traveler: BookingTravelerRecord): boolean {
  const fields = [traveler.firstName, traveler.lastName, traveler.email, traveler.phone]
  return fields.some(
    (v) => typeof v === "string" && (v === "***" || /\*\*\*/.test(v) || /\*+@/.test(v)),
  )
}
