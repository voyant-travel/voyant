"use client"

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components"
import { Loader2, Plus, Settings2, Trophy } from "lucide-react"
import { useState } from "react"

import { useProgramRfps, useRfp } from "../hooks/use-mice-lists.js"
import { useRfpMutation } from "../hooks/use-rfp-mutation.js"
import type { BidRecord } from "../schemas.js"

/** RFP + bid statuses operators can set directly (`validation-rfp`). The
 * award-controlled states (`awarded`, `accepted`, `rejected`) are reached only
 * through the award flow, so they are not offered as choices. */
const RFP_EDITABLE_STATUSES = ["draft", "issued", "closed", "cancelled"] as const
type RfpEditableStatus = (typeof RFP_EDITABLE_STATUSES)[number]

const RFP_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  closed: "secondary",
  awarded: "default",
  cancelled: "outline",
}
const BID_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  submitted: "secondary",
  under_review: "secondary",
  accepted: "default",
  rejected: "destructive",
}

// 200 is the backend's hard per-page max (`rfpListQuerySchema`). A program runs
// a handful of RFPs, so one page covers it; if it ever hits the cap the section
// says so rather than silently dropping the rest.
const RFPS_PAGE_LIMIT = 200

function statusLabel(value: string): string {
  return value.replace(/_/g, " ")
}

function formatMoney(
  cents: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (cents == null) return "—"
  const code = currency || "USD"
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(
      cents / 100,
    )
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`
  }
}

export interface ProgramRfpsSectionProps {
  programId: string
}

/**
 * Sourcing RFPs for a program (RFC voyant#1489 Phase 4). Lists the program's
 * RFPs and creates new ones in place; "Manage" opens the funnel for one RFP —
 * invite suppliers, record bids, and award to a winner. Lives inside the
 * program detail page; an RFP is a program's sourcing artifact, not a top-level
 * surface.
 */
export function ProgramRfpsSection({ programId }: ProgramRfpsSectionProps) {
  const { data, isLoading } = useProgramRfps({ programId, limit: RFPS_PAGE_LIMIT })
  const rfps = data?.data ?? []
  const capped = rfps.length === RFPS_PAGE_LIMIT
  const [showCreate, setShowCreate] = useState(false)
  const [manageRfpId, setManageRfpId] = useState<string | null>(null)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-lg tracking-tight">Sourcing (RFPs)</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New RFP
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
              <TableHead> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && rfps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No RFPs yet.
                </TableCell>
              </TableRow>
            ) : (
              rfps.map((rfp) => (
                <TableRow key={rfp.id}>
                  <TableCell className="font-medium">{rfp.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant={RFP_STATUS_VARIANT[rfp.status] ?? "outline"}
                      className="capitalize"
                    >
                      {statusLabel(rfp.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {rfp.dueAt ? rfp.dueAt.slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setManageRfpId(rfp.id)}>
                      <Settings2 className="size-4" aria-hidden="true" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {capped ? (
        <p className="text-muted-foreground text-xs">Showing the first {RFPS_PAGE_LIMIT} RFPs.</p>
      ) : null}

      <CreateRfpDialog programId={programId} open={showCreate} onOpenChange={setShowCreate} />
      <ManageRfpDialog
        rfpId={manageRfpId}
        onOpenChange={(open) => {
          if (!open) setManageRfpId(null)
        }}
      />
    </section>
  )
}

interface CreateRfpDialogProps {
  programId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CreateRfpDialog({ programId, open, onOpenChange }: CreateRfpDialogProps) {
  const { create } = useRfpMutation()
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<RfpEditableStatus>("draft")

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle("")
      setStatus("draft")
    }
    onOpenChange(next)
  }

  const submit = async () => {
    if (!title.trim()) return
    await create.mutateAsync({ programId, title: title.trim(), status })
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New RFP</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rfp-title">Title</Label>
            <Input
              id="rfp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Venue & catering — Lisbon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rfp-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as RfpEditableStatus)}>
              <SelectTrigger id="rfp-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RFP_EDITABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!title.trim() || create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Create RFP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ManageRfpDialogProps {
  rfpId: string | null
  onOpenChange: (open: boolean) => void
}

function ManageRfpDialog({ rfpId, onOpenChange }: ManageRfpDialogProps) {
  const open = rfpId !== null
  const { invite, createBid, award } = useRfpMutation()
  const { data, isLoading } = useRfp(rfpId ?? undefined, { enabled: open })
  const rfp = data?.data
  const bids = rfp?.bids ?? []
  const awarded = rfp?.status === "awarded"

  const [supplierId, setSupplierId] = useState("")
  const [bidSupplierId, setBidSupplierId] = useState("")
  const [bidTotal, setBidTotal] = useState("")
  const [bidCurrency, setBidCurrency] = useState("")

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSupplierId("")
      setBidSupplierId("")
      setBidTotal("")
      setBidCurrency("")
    }
    onOpenChange(next)
  }

  const submitInvite = async () => {
    if (!rfpId || !supplierId.trim()) return
    await invite.mutateAsync({ rfpId, supplierId: supplierId.trim() })
    setSupplierId("")
  }

  const totalCents = bidTotal.trim() === "" ? undefined : Number(bidTotal) * 100
  const bidTotalInvalid =
    totalCents !== undefined && (!Number.isFinite(totalCents) || totalCents < 0)

  const submitBid = async () => {
    if (!rfpId || !bidSupplierId.trim() || bidTotalInvalid) return
    await createBid.mutateAsync({
      rfpId,
      supplierId: bidSupplierId.trim(),
      status: "submitted",
      totalCents: totalCents !== undefined ? Math.round(totalCents) : undefined,
      currency: bidCurrency.trim() || undefined,
    })
    setBidSupplierId("")
    setBidTotal("")
    setBidCurrency("")
  }

  const submitAward = async (bid: BidRecord) => {
    if (!rfpId) return
    await award.mutateAsync({ rfpId, bidId: bid.id })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {rfp?.title ?? "RFP"}
            {rfp ? (
              <Badge variant={RFP_STATUS_VARIANT[rfp.status] ?? "outline"} className="capitalize">
                {statusLabel(rfp.status)}
              </Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {isLoading && !rfp ? (
          <div className="py-6 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <div className="space-y-6">
            <Bids
              bids={bids}
              awarded={awarded}
              awardPending={award.isPending}
              onAward={submitAward}
            />

            {awarded ? null : (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="rfp-bid-supplier">Record a bid</Label>
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      id="rfp-bid-supplier"
                      className="min-w-40 flex-1"
                      value={bidSupplierId}
                      onChange={(e) => setBidSupplierId(e.target.value)}
                      placeholder="Supplier ID (supl_…)"
                    />
                    <Input
                      className="w-28"
                      type="number"
                      min={0}
                      step="0.01"
                      value={bidTotal}
                      onChange={(e) => setBidTotal(e.target.value)}
                      placeholder="Total"
                      aria-invalid={bidTotalInvalid || undefined}
                    />
                    <Input
                      className="w-20"
                      value={bidCurrency}
                      onChange={(e) => setBidCurrency(e.target.value)}
                      placeholder="EUR"
                    />
                    <Button
                      onClick={() => void submitBid()}
                      disabled={!bidSupplierId.trim() || bidTotalInvalid || createBid.isPending}
                    >
                      {createBid.isPending ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      Add bid
                    </Button>
                  </div>
                  {bidTotalInvalid ? (
                    <p className="text-destructive text-xs">Total must be 0 or more.</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rfp-invite-supplier">Invite a supplier</Label>
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      id="rfp-invite-supplier"
                      className="min-w-40 flex-1"
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      placeholder="Supplier ID (supl_…)"
                    />
                    <Button
                      variant="outline"
                      onClick={() => void submitInvite()}
                      disabled={!supplierId.trim() || invite.isPending}
                    >
                      {invite.isPending ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      Invite
                    </Button>
                  </div>
                  {rfp && rfp.invitations.length > 0 ? (
                    <p className="text-muted-foreground text-xs">
                      {rfp.invitations.length} supplier(s) invited.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface BidsProps {
  bids: BidRecord[]
  awarded: boolean
  awardPending: boolean
  onAward: (bid: BidRecord) => void
}

function Bids({ bids, awarded, awardPending, onAward }: BidsProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Bids</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bids.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No bids yet.
                </TableCell>
              </TableRow>
            ) : (
              bids.map((bid) => (
                <TableRow key={bid.id}>
                  <TableCell className="font-medium">{bid.supplierId}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(bid.totalCents, bid.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={BID_STATUS_VARIANT[bid.status] ?? "outline"}
                      className="capitalize"
                    >
                      {statusLabel(bid.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {awarded ? (
                      bid.status === "accepted" ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                          <Trophy className="size-4" aria-hidden="true" />
                          Awarded
                        </span>
                      ) : null
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAward(bid)}
                        disabled={awardPending}
                      >
                        <Trophy className="size-4" aria-hidden="true" />
                        Award
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
