"use client"

import { PersonCombobox } from "@voyant-travel/relationships-react/ui"
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Loader2, Plus, UserPlus } from "lucide-react"
import { useState } from "react"

import { useDelegateMutation } from "../hooks/use-delegate-mutation.js"
import { useProgramDelegates, useProgramSessions } from "../hooks/use-mice-lists.js"
import type { DelegateRecord } from "../schemas.js"

/** Delegate roles + statuses the MICE backend accepts (`validation-delegates`). */
const DELEGATE_ROLES = [
  "attendee",
  "speaker",
  "sponsor",
  "vip",
  "staff",
  "exhibitor",
  "organizer",
] as const
type DelegateRole = (typeof DELEGATE_ROLES)[number]

const DELEGATE_STATUSES = [
  "invited",
  "registered",
  "confirmed",
  "checked_in",
  "no_show",
  "cancelled",
] as const
type DelegateStatus = (typeof DELEGATE_STATUSES)[number]

const ENROLLMENT_STATUSES = ["registered", "waitlisted", "attended", "cancelled"] as const
type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

// 500 is the backend's hard per-page max (`delegateListQuerySchema`). Most
// programs sit below it; when a roster hits the cap the section says so rather
// than silently dropping the rest (a paginated roster view is a later surface).
const DELEGATES_PAGE_LIMIT = 500

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  invited: "outline",
  registered: "secondary",
  confirmed: "default",
  checked_in: "default",
  no_show: "destructive",
  cancelled: "outline",
}

function statusLabel(value: string): string {
  return value.replace(/_/g, " ")
}

export interface ProgramDelegatesSectionProps {
  programId: string
}

/**
 * Delegates for a program (RFC voyant#1489 Phase 3). Lists the program's
 * delegates and adds new ones in place, and enrolls a delegate into one of the
 * program's agenda sessions. Lives inside the program detail page — a delegate
 * roster is part of a program, not a top-level surface.
 */
export function ProgramDelegatesSection({ programId }: ProgramDelegatesSectionProps) {
  const { data, isLoading } = useProgramDelegates({
    programId,
    limit: DELEGATES_PAGE_LIMIT,
  })
  const delegates = data?.data ?? []
  const capped = delegates.length === DELEGATES_PAGE_LIMIT
  const [showCreate, setShowCreate] = useState(false)
  const [enrollTarget, setEnrollTarget] = useState<DelegateRecord | null>(null)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-lg tracking-tight">Delegates</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Add delegate
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Delegate</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && delegates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No delegates yet.
                </TableCell>
              </TableRow>
            ) : (
              delegates.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.personId ?? d.bookingId ?? d.id}</TableCell>
                  <TableCell className="capitalize">{d.role}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[d.status] ?? "outline"} className="capitalize">
                      {statusLabel(d.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEnrollTarget(d)}>
                      <UserPlus className="size-4" aria-hidden="true" />
                      Enroll
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {capped ? (
        <p className="text-muted-foreground text-xs">
          Showing the first {DELEGATES_PAGE_LIMIT} delegates.
        </p>
      ) : null}

      <CreateDelegateDialog programId={programId} open={showCreate} onOpenChange={setShowCreate} />
      <EnrollDelegateDialog
        programId={programId}
        delegate={enrollTarget}
        onOpenChange={(open) => {
          if (!open) setEnrollTarget(null)
        }}
      />
    </section>
  )
}

interface CreateDelegateDialogProps {
  programId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CreateDelegateDialog({ programId, open, onOpenChange }: CreateDelegateDialogProps) {
  const { create } = useDelegateMutation()
  const [role, setRole] = useState<DelegateRole>("attendee")
  const [status, setStatus] = useState<DelegateStatus>("invited")
  const [personId, setPersonId] = useState<string | null>(null)

  const reset = () => {
    setRole("attendee")
    setStatus("invited")
    setPersonId(null)
  }

  // Reset on every close so a cancelled draft doesn't reappear on reopen.
  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = async () => {
    await create.mutateAsync({
      programId,
      role,
      status,
      personId: personId || undefined,
    })
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add delegate</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delegate-role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as DelegateRole)}>
                <SelectTrigger id="delegate-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELEGATE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delegate-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as DelegateStatus)}>
                <SelectTrigger id="delegate-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELEGATE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Person (optional)</Label>
            <PersonCombobox
              value={personId}
              onChange={setPersonId}
              placeholder="Search people"
              emptyText="No people found."
              disabled={create.isPending}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Add delegate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface EnrollDelegateDialogProps {
  programId: string
  delegate: DelegateRecord | null
  onOpenChange: (open: boolean) => void
}

function EnrollDelegateDialog({ programId, delegate, onOpenChange }: EnrollDelegateDialogProps) {
  const open = delegate !== null
  const { enroll } = useDelegateMutation()
  const { data: sessionsData } = useProgramSessions(programId, { enabled: open })
  const sessions = sessionsData?.data ?? []
  const [sessionId, setSessionId] = useState("")
  const [status, setStatus] = useState<EnrollmentStatus>("registered")

  // The dialog stays mounted, so reset the form on every close — otherwise a
  // stale session selection survives a cancel and could be one-click enrolled
  // for the next delegate opened.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSessionId("")
      setStatus("registered")
    }
    onOpenChange(next)
  }

  const submit = async () => {
    if (!delegate || !sessionId) return
    await enroll.mutateAsync({ delegateId: delegate.id, sessionId, status })
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll delegate in session</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enroll-session">Session</Label>
            <Select value={sessionId} onValueChange={(value) => setSessionId(value ?? "")}>
              <SelectTrigger id="enroll-session" className="w-full">
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                This program has no sessions yet — add one in the Agenda first.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="enroll-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as EnrollmentStatus)}>
              <SelectTrigger id="enroll-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENROLLMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={enroll.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!sessionId || enroll.isPending}>
            {enroll.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
