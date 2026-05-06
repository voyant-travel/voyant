"use client"

import {
  type BookingTravelerDocumentRecord,
  type BookingTravelerRecord,
  type BookingTravelerRevealRecord,
  useBookingTravelerDocuments,
  useRevealTraveler,
  useTravelerMutation,
  useTravelers,
} from "@voyantjs/bookings-react"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
import * as React from "react"

import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { TravelerDialog } from "./traveler-dialog.js"

export interface TravelerListProps {
  bookingId: string
  autoReveal?: boolean
}

export function TravelerList({ bookingId, autoReveal = false }: TravelerListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingTravelerRecord | undefined>(undefined)
  const [revealedIds, setRevealedIds] = React.useState<Set<string>>(new Set())
  const { data } = useTravelers(bookingId)
  const documentsQuery = useBookingTravelerDocuments(bookingId)
  const { remove } = useTravelerMutation(bookingId)
  const messages = useBookingsUiMessagesOrDefault()

  const travelers = data?.data ?? []
  const documentsByTraveler = React.useMemo(() => {
    const grouped = new Map<string, BookingTravelerDocumentRecord[]>()
    for (const document of documentsQuery.data?.data ?? []) {
      if (!document.travelerId) continue
      const bucket = grouped.get(document.travelerId) ?? []
      bucket.push(document)
      grouped.set(document.travelerId, bucket)
    }
    return grouped
  }, [documentsQuery.data?.data])

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
          <div className="overflow-x-auto rounded border bg-background">
            <table className="w-full min-w-[980px] text-sm">
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
                  <th className="p-2 text-left font-medium">Role</th>
                  <th className="p-2 text-left font-medium">DOB / age</th>
                  <th className="p-2 text-left font-medium">Documents</th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {travelers.map((traveler) => (
                  <TravelerRow
                    key={traveler.id}
                    bookingId={bookingId}
                    traveler={traveler}
                    documents={documentsByTraveler.get(traveler.id) ?? []}
                    revealed={autoReveal || revealedIds.has(traveler.id)}
                    onToggleReveal={
                      autoReveal || allAlreadyRevealed ? undefined : () => toggleReveal(traveler.id)
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
  documents,
  revealed,
  onToggleReveal,
  emailUnavailable,
  phoneUnavailable,
  onEdit,
  onDelete,
}: {
  bookingId: string
  traveler: BookingTravelerRecord
  documents: BookingTravelerDocumentRecord[]
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
  const revealedTraveler = reveal.data?.data as BookingTravelerRevealRecord | undefined
  const display: BookingTravelerRecord | BookingTravelerRevealRecord =
    revealed && revealedTraveler ? revealedTraveler : traveler
  const travelDetails: BookingTravelerRevealRecord["travelDetails"] =
    revealed && revealedTraveler ? revealedTraveler.travelDetails : null
  const showLoading = revealed && reveal.isLoading
  const revealError = revealed && reveal.error

  return (
    <>
      <tr className="border-b">
        <td className="p-2">
          {showLoading ? (
            <RowLoading />
          ) : (
            `${display.firstName ?? ""} ${display.lastName ?? ""}`.trim()
          )}
        </td>
        <td className="p-2">
          {showLoading ? <RowLoading /> : (display.email ?? emailUnavailable)}
        </td>
        <td className="p-2">
          {showLoading ? <RowLoading /> : (display.phone ?? phoneUnavailable)}
        </td>
        <td className="p-2">
          <div className="flex flex-wrap gap-1.5">
            {display.isPrimary ? <MiniPill>Primary</MiniPill> : null}
            {travelDetails?.isLeadTraveler ? <MiniPill>Lead</MiniPill> : null}
            {display.travelerCategory ? <MiniPill>{display.travelerCategory}</MiniPill> : null}
          </div>
        </td>
        <td className="p-2">
          {showLoading ? <RowLoading /> : formatDobAge(travelDetails?.dateOfBirth)}
        </td>
        <td className="p-2">
          {documents.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {documents.slice(0, 2).map((document) => (
                <MiniPill key={document.id}>{document.type.replaceAll("_", " ")}</MiniPill>
              ))}
              {documents.length > 2 ? <MiniPill>+{documents.length - 2}</MiniPill> : null}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
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
      <tr className="border-b last:border-b-0">
        <td colSpan={7} className="bg-muted/20 px-2 py-3">
          <TravelerContextGrid
            traveler={display}
            travelDetails={travelDetails}
            documents={documents}
            loading={showLoading}
          />
        </td>
      </tr>
    </>
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

function TravelerContextGrid({
  traveler,
  travelDetails,
  documents,
  loading,
}: {
  traveler: BookingTravelerRecord | BookingTravelerRevealRecord
  travelDetails: BookingTravelerRevealRecord["travelDetails"]
  documents: BookingTravelerDocumentRecord[]
  loading: boolean
}) {
  if (loading) return <RowLoading />

  const fields = [
    ["Nationality", travelDetails?.nationality],
    ["Passport", travelDetails?.passportNumber],
    ["Passport expiry", formatDateValue(travelDetails?.passportExpiry)],
    ["Language", traveler.preferredLanguage],
    ["Dietary", travelDetails?.dietaryRequirements],
    ["Accessibility", travelDetails?.accessibilityNeeds],
    ["Special requests", traveler.specialRequests],
    ["Notes", traveler.notes],
  ] as const
  const visibleFields = fields.filter(([, value]) => Boolean(value))

  if (visibleFields.length === 0 && documents.length === 0) {
    return <span className="text-xs text-muted-foreground">No additional traveler context</span>
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {visibleFields.map(([label, value]) => (
        <DetailField key={label} label={label} value={value ?? "-"} />
      ))}
      {documents.map((document) => (
        <DetailField
          key={document.id}
          label={`Document · ${document.type.replaceAll("_", " ")}`}
          value={document.fileName}
        />
      ))}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="truncate text-xs text-foreground">{value}</div>
    </div>
  )
}

function MiniPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full border px-2 text-[11px] capitalize text-muted-foreground">
      {children}
    </span>
  )
}

function formatDobAge(value: string | null | undefined): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const birthdayPassed =
    today.getMonth() > date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() >= date.getDate())
  if (!birthdayPassed) age -= 1
  return `${formatDateValue(value)} · ${age}`
}

function formatDateValue(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
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
