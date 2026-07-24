"use client"

import {
  Badge,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@voyant-travel/ui/components"
import { BedDouble, Loader2, Plus, Users } from "lucide-react"
import { useEffect, useState } from "react"

import {
  useProgramDelegates,
  useProgramRooming,
  useRoomingAssignment,
} from "../hooks/use-mice-lists.js"
import { useRoomingMutation } from "../hooks/use-rooming-mutation.js"
import type { DelegateRecord, RoomingAssignmentDelegateRecord } from "../schemas.js"

const ROOMING_PAGE_LIMIT = 500
const DELEGATES_PAGE_LIMIT = 500

export interface ProgramRoomingSectionProps {
  programId: string
}

function assignmentLabel(value: string | null | undefined): string {
  return value?.trim() || "-"
}

function delegateLabel(delegate: DelegateRecord): string {
  return delegate.personId ?? delegate.bookingId ?? delegate.id
}

/**
 * Rooming assignments for a program. The list stays intentionally compact; the
 * occupant workflow opens per assignment and replaces the full room delegate set.
 */
export function ProgramRoomingSection({ programId }: ProgramRoomingSectionProps) {
  const { data, isLoading } = useProgramRooming(programId)
  const assignments = data?.data ?? []
  const capped = assignments.length === ROOMING_PAGE_LIMIT
  const [showCreate, setShowCreate] = useState(false)
  const [manageAssignmentId, setManageAssignmentId] = useState<string | null>(null)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-lg tracking-tight">Rooming</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" aria-hidden="true" />
          New assignment
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room block</TableHead>
              <TableHead>Room type</TableHead>
              <TableHead>Stay</TableHead>
              <TableHead>Bed</TableHead>
              <TableHead>Sharing group</TableHead>
              <TableHead> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No rooming assignments yet.
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">
                    {assignmentLabel(assignment.roomBlockId)}
                  </TableCell>
                  <TableCell>{assignmentLabel(assignment.roomTypeId)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {assignment.checkIn || assignment.checkOut
                      ? `${assignment.checkIn ?? "?"} to ${assignment.checkOut ?? "?"}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {assignment.bedConfig ? (
                      <Badge variant="outline">{assignment.bedConfig}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {assignmentLabel(assignment.sharingGroupId)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setManageAssignmentId(assignment.id)}
                    >
                      <Users className="size-4" aria-hidden="true" />
                      Occupants
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
          Showing the first {ROOMING_PAGE_LIMIT} assignments.
        </p>
      ) : null}

      <CreateRoomingAssignmentDialog
        programId={programId}
        open={showCreate}
        onOpenChange={setShowCreate}
      />
      <ManageRoomingOccupantsDialog
        programId={programId}
        assignmentId={manageAssignmentId}
        onOpenChange={(open) => {
          if (!open) setManageAssignmentId(null)
        }}
      />
    </section>
  )
}

interface CreateRoomingAssignmentDialogProps {
  programId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CreateRoomingAssignmentDialog({
  programId,
  open,
  onOpenChange,
}: CreateRoomingAssignmentDialogProps) {
  const { create } = useRoomingMutation()
  const [roomBlockId, setRoomBlockId] = useState("")
  const [roomTypeId, setRoomTypeId] = useState("")
  const [bedConfig, setBedConfig] = useState("")
  const [sharingGroupId, setSharingGroupId] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [specialRequests, setSpecialRequests] = useState("")

  const reset = () => {
    setRoomBlockId("")
    setRoomTypeId("")
    setBedConfig("")
    setSharingGroupId("")
    setCheckIn("")
    setCheckOut("")
    setSpecialRequests("")
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = async () => {
    await create.mutateAsync({
      programId,
      roomBlockId: roomBlockId.trim() || undefined,
      roomTypeId: roomTypeId.trim() || undefined,
      bedConfig: bedConfig.trim() || undefined,
      sharingGroupId: sharingGroupId.trim() || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      specialRequests: specialRequests.trim() || undefined,
    })
    handleOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>New rooming assignment</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rooming-room-block">Room block</Label>
              <Input
                id="rooming-room-block"
                value={roomBlockId}
                onChange={(e) => setRoomBlockId(e.target.value)}
                placeholder="rb_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rooming-room-type">Room type</Label>
              <Input
                id="rooming-room-type"
                value={roomTypeId}
                onChange={(e) => setRoomTypeId(e.target.value)}
                placeholder="rt_..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rooming-check-in">Check-in</Label>
              <DatePicker
                value={checkIn || null}
                onChange={(value) => setCheckIn(value ?? "")}
                placeholder="Check-in"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rooming-check-out">Check-out</Label>
              <DatePicker
                value={checkOut || null}
                onChange={(value) => setCheckOut(value ?? "")}
                placeholder="Check-out"
                className="w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rooming-bed-config">Bed configuration</Label>
              <Input
                id="rooming-bed-config"
                value={bedConfig}
                onChange={(e) => setBedConfig(e.target.value)}
                placeholder="Twin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rooming-sharing-group">Sharing group</Label>
              <Input
                id="rooming-sharing-group"
                value={sharingGroupId}
                onChange={(e) => setSharingGroupId(e.target.value)}
                placeholder="group-a"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rooming-special-requests">Special requests</Label>
            <Textarea
              id="rooming-special-requests"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Accessible room, late arrival, dietary notes"
            />
          </div>
        </SheetBody>
        <SheetFooter>
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
            ) : (
              <BedDouble className="size-4" aria-hidden="true" />
            )}
            Create assignment
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

interface ManageRoomingOccupantsDialogProps {
  programId: string
  assignmentId: string | null
  onOpenChange: (open: boolean) => void
}

type OccupantDraft = Record<string, { isPrimary: boolean; bedLabel: string }>

function draftFromRows(rows: RoomingAssignmentDelegateRecord[]): OccupantDraft {
  return Object.fromEntries(
    rows.map((row) => [row.delegateId, { isPrimary: row.isPrimary, bedLabel: row.bedLabel ?? "" }]),
  )
}

function ManageRoomingOccupantsDialog({
  programId,
  assignmentId,
  onOpenChange,
}: ManageRoomingOccupantsDialogProps) {
  const open = assignmentId !== null
  const { setDelegates } = useRoomingMutation()
  const { data: assignmentData, isLoading: assignmentLoading } = useRoomingAssignment(
    assignmentId ?? undefined,
    { enabled: open },
  )
  const { data: delegatesData, isLoading: delegatesLoading } = useProgramDelegates(
    { programId, limit: DELEGATES_PAGE_LIMIT },
    { enabled: open },
  )
  const delegates = delegatesData?.data ?? []
  const assignment = assignmentData?.data
  const [draft, setDraft] = useState<OccupantDraft>({})

  useEffect(() => {
    if (!open || !assignment) return
    setDraft(draftFromRows(assignment.delegates))
  }, [assignment, open])

  const handleOpenChange = (next: boolean) => {
    if (!next) setDraft({})
    onOpenChange(next)
  }

  const toggleDelegate = (delegateId: string, checked: boolean) => {
    setDraft((current) => {
      const next = { ...current }
      if (checked) {
        next[delegateId] = next[delegateId] ?? { isPrimary: false, bedLabel: "" }
      } else {
        delete next[delegateId]
      }
      return next
    })
  }

  const setPrimary = (delegateId: string, checked: boolean) => {
    setDraft((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, value]) => [
          id,
          { ...value, isPrimary: checked && id === delegateId },
        ]),
      ),
    )
  }

  const setBedLabel = (delegateId: string, bedLabel: string) => {
    setDraft((current) => ({
      ...current,
      [delegateId]: { ...(current[delegateId] ?? { isPrimary: false }), bedLabel },
    }))
  }

  const submit = async () => {
    if (!assignmentId) return
    await setDelegates.mutateAsync({
      assignmentId,
      delegates: Object.entries(draft).map(([delegateId, value]) => ({
        delegateId,
        isPrimary: value.isPrimary,
        bedLabel: value.bedLabel.trim() || undefined,
      })),
    })
    handleOpenChange(false)
  }

  const loading = assignmentLoading || delegatesLoading

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="max-w-3xl">
        <SheetHeader>
          <SheetTitle>Assign room occupants</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading && !assignment ? (
            <div className="py-6 text-center text-muted-foreground text-sm">Loading...</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"> </TableHead>
                      <TableHead>Delegate</TableHead>
                      <TableHead className="w-24">Primary</TableHead>
                      <TableHead className="w-40">Bed label</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {delegates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No delegates yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      delegates.map((delegate) => {
                        const selected = draft[delegate.id]
                        return (
                          <TableRow key={delegate.id}>
                            <TableCell>
                              <Checkbox
                                checked={selected !== undefined}
                                onCheckedChange={(checked) =>
                                  toggleDelegate(delegate.id, checked === true)
                                }
                                aria-label={`Assign ${delegateLabel(delegate)}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{delegateLabel(delegate)}</TableCell>
                            <TableCell>
                              <Checkbox
                                checked={selected?.isPrimary ?? false}
                                onCheckedChange={(checked) =>
                                  setPrimary(delegate.id, checked === true)
                                }
                                disabled={!selected}
                                aria-label={`Mark ${delegateLabel(delegate)} as primary`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={selected?.bedLabel ?? ""}
                                onChange={(e) => setBedLabel(delegate.id, e.target.value)}
                                placeholder="A"
                                disabled={!selected}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {delegates.length === DELEGATES_PAGE_LIMIT ? (
                <p className="text-muted-foreground text-xs">
                  Showing the first {DELEGATES_PAGE_LIMIT} delegates.
                </p>
              ) : null}
            </div>
          )}
        </SheetBody>
        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={setDelegates.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!assignmentId || setDelegates.isPending}>
            {setDelegates.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Save occupants
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
