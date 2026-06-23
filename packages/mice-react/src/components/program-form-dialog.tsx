"use client"

import {
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
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import { useState } from "react"

import { useProgramMutation } from "../hooks/use-program-mutation.js"
import type { ProgramRecord } from "../schemas.js"

/** Program types + lifecycle statuses the MICE backend accepts (`validation.ts`). */
const PROGRAM_TYPES = ["meeting", "incentive", "conference", "exhibition", "other"] as const
type ProgramType = (typeof PROGRAM_TYPES)[number]

const PROGRAM_STATUSES = [
  "lead",
  "planning",
  "contracted",
  "operating",
  "completed",
  "cancelled",
] as const
type ProgramStatus = (typeof PROGRAM_STATUSES)[number]

function statusLabel(value: string): string {
  return value.replace(/_/g, " ")
}

function toIntOrUndefined(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  const n = Number(trimmed)
  return Number.isInteger(n) && n >= 0 ? n : Number.NaN
}

export interface ProgramFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog edits that program; otherwise it creates one. */
  program?: ProgramRecord
  /** Called with the created/updated program after a successful save. */
  onSaved?: (program: ProgramRecord) => void
}

/**
 * Create or edit a MICE program. The single form behind the "New program"
 * action on the programs list and the "Edit" action on the program detail —
 * without it the list is a dead end (nothing to open). Covers the fields an
 * operator sets directly: name, type, lifecycle status, destination, dates,
 * pax, currency, and budget.
 */
export function ProgramFormDialog({
  open,
  onOpenChange,
  program,
  onSaved,
}: ProgramFormDialogProps) {
  const editing = program !== undefined
  const { create, update } = useProgramMutation()
  const pending = create.isPending || update.isPending

  const [name, setName] = useState(program?.name ?? "")
  const [type, setType] = useState<ProgramType>((program?.type as ProgramType) ?? "conference")
  const [status, setStatus] = useState<ProgramStatus>((program?.status as ProgramStatus) ?? "lead")
  const [destination, setDestination] = useState(program?.destination ?? "")
  const [startDate, setStartDate] = useState(program?.startDate ?? "")
  const [endDate, setEndDate] = useState(program?.endDate ?? "")
  const [estimatedPax, setEstimatedPax] = useState(
    program?.estimatedPax != null ? String(program.estimatedPax) : "",
  )
  const [confirmedPax, setConfirmedPax] = useState(
    program?.confirmedPax != null ? String(program.confirmedPax) : "",
  )
  const [currency, setCurrency] = useState(program?.currency ?? "")
  const [budget, setBudget] = useState(
    program?.budgetAmountCents != null ? String(program.budgetAmountCents / 100) : "",
  )

  const estimatedPaxValue = toIntOrUndefined(estimatedPax)
  const confirmedPaxValue = toIntOrUndefined(confirmedPax)
  const budgetTrimmed = budget.trim()
  const budgetValue = budgetTrimmed === "" ? undefined : Number(budgetTrimmed)
  const budgetInvalid =
    budgetValue !== undefined && (!Number.isFinite(budgetValue) || budgetValue < 0)
  const paxInvalid = Number.isNaN(estimatedPaxValue) || Number.isNaN(confirmedPaxValue)
  const canSubmit = name.trim().length > 0 && !paxInvalid && !budgetInvalid && !pending

  const reset = () => {
    if (editing) return
    setName("")
    setType("conference")
    setStatus("lead")
    setDestination("")
    setStartDate("")
    setEndDate("")
    setEstimatedPax("")
    setConfirmedPax("")
    setCurrency("")
    setBudget("")
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = async () => {
    if (!canSubmit) return
    const payload = {
      name: name.trim(),
      type,
      status,
      destination: destination.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      estimatedPax: estimatedPaxValue,
      confirmedPax: confirmedPaxValue,
      currency: currency.trim() || undefined,
      budgetAmountCents: budgetValue !== undefined ? Math.round(budgetValue * 100) : undefined,
    }
    const saved = editing
      ? await update.mutateAsync({ id: program.id, ...payload })
      : await create.mutateAsync(payload)
    reset()
    onOpenChange(false)
    onSaved?.(saved)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit program" : "New program"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="program-name">Name</Label>
            <Input
              id="program-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Annual sales kickoff — Lisbon"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="program-type">Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as ProgramType)}>
                <SelectTrigger id="program-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ProgramStatus)}>
                <SelectTrigger id="program-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-destination">Destination</Label>
            <Input
              id="program-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Lisbon, Portugal"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="program-start">Start date</Label>
              <Input
                id="program-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-end">End date</Label>
              <Input
                id="program-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="program-est-pax">Est. pax</Label>
              <Input
                id="program-est-pax"
                type="number"
                min={0}
                step={1}
                value={estimatedPax}
                onChange={(e) => setEstimatedPax(e.target.value)}
                aria-invalid={Number.isNaN(estimatedPaxValue) || undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-conf-pax">Conf. pax</Label>
              <Input
                id="program-conf-pax"
                type="number"
                min={0}
                step={1}
                value={confirmedPax}
                onChange={(e) => setConfirmedPax(e.target.value)}
                aria-invalid={Number.isNaN(confirmedPaxValue) || undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-currency">Currency</Label>
              <Input
                id="program-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="EUR"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-budget">Budget ({currency.trim() || "currency"})</Label>
            <Input
              id="program-budget"
              type="number"
              min={0}
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              aria-invalid={budgetInvalid || undefined}
              placeholder="50000"
            />
          </div>
          {paxInvalid ? (
            <p className="text-destructive text-xs">Pax must be a whole number of 0 or more.</p>
          ) : budgetInvalid ? (
            <p className="text-destructive text-xs">Budget must be 0 or more.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {editing ? "Save changes" : "Create program"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
