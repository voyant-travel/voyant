"use client"

import {
  type PersonDocumentType,
  usePersonDocumentMutation,
  useRevealPersonDocument,
} from "@voyantjs/crm-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Textarea } from "@voyantjs/ui/components/textarea"
import * as React from "react"

const DOCUMENT_TYPES: PersonDocumentType[] = [
  "passport",
  "id_card",
  "driver_license",
  "visa",
  "other",
]

const TYPE_LABELS: Record<PersonDocumentType, string> = {
  passport: "Passport",
  id_card: "ID card",
  driver_license: "Driver license",
  visa: "Visa",
  other: "Other",
}

export interface PersonDocumentDialogDocument {
  id: string
  type: PersonDocumentType
  issuingCountry: string | null
  issuingAuthority: string | null
  issueDate: string | null
  expiryDate: string | null
  isPrimary: boolean
  notes: string | null
}

export interface PersonDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: string
  document: PersonDocumentDialogDocument
}

interface FormState {
  type: PersonDocumentType
  number: string
  issuingCountry: string
  issuingAuthority: string
  issueDate: string
  expiryDate: string
  isPrimary: boolean
  notes: string
}

function buildInitialState(
  document: PersonDocumentDialogDocument,
  revealedNumber: string | null,
): FormState {
  return {
    type: document.type,
    number: revealedNumber ?? "",
    issuingCountry: document.issuingCountry ?? "",
    issuingAuthority: document.issuingAuthority ?? "",
    issueDate: document.issueDate ?? "",
    expiryDate: document.expiryDate ?? "",
    isPrimary: document.isPrimary,
    notes: document.notes ?? "",
  }
}

export function PersonDocumentDialog({
  open,
  onOpenChange,
  personId,
  document,
}: PersonDocumentDialogProps) {
  const revealQuery = useRevealPersonDocument(document.id, { enabled: open })
  const revealedNumber = revealQuery.data?.data.number ?? null
  const { updateFromPlaintext } = usePersonDocumentMutation(personId)

  const [state, setState] = React.useState<FormState>(() => buildInitialState(document, null))
  const initializedRef = React.useRef(false)

  React.useEffect(() => {
    if (!open) {
      initializedRef.current = false
      return
    }
    if (!initializedRef.current && !revealQuery.isLoading) {
      setState(buildInitialState(document, revealedNumber))
      initializedRef.current = true
    }
  }, [open, document, revealedNumber, revealQuery.isLoading])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await updateFromPlaintext.mutateAsync({
      id: document.id,
      input: {
        type: state.type,
        number: state.number.trim() === "" ? null : state.number.trim(),
        issuingCountry: state.issuingCountry.trim() === "" ? null : state.issuingCountry.trim(),
        issuingAuthority:
          state.issuingAuthority.trim() === "" ? null : state.issuingAuthority.trim(),
        issueDate: state.issueDate === "" ? null : state.issueDate,
        expiryDate: state.expiryDate === "" ? null : state.expiryDate,
        isPrimary: state.isPrimary,
        notes: state.notes.trim() === "" ? null : state.notes.trim(),
      },
    })
    onOpenChange(false)
  }

  const revealError = revealQuery.error
  const updateError = updateFromPlaintext.error

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
          <DialogDescription>
            Update document details. Numbers are encrypted at rest and audit-logged on reveal.
          </DialogDescription>
        </DialogHeader>
        {revealQuery.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading document…</p>
        ) : revealError ? (
          <p className="py-4 text-sm text-destructive">
            {revealError instanceof Error ? revealError.message : "Failed to reveal document."}
          </p>
        ) : null}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="doc-type">Type</Label>
              <Select
                value={state.type}
                onValueChange={(value) => set("type", value as PersonDocumentType)}
              >
                <SelectTrigger id="doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="doc-number">Number</Label>
              <Input
                id="doc-number"
                value={state.number}
                onChange={(event) => set("number", event.target.value)}
                placeholder="Document number"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-country">Issuing country</Label>
              <Input
                id="doc-country"
                value={state.issuingCountry}
                onChange={(event) => set("issuingCountry", event.target.value)}
                placeholder="ISO code (e.g. RO)"
                maxLength={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-authority">Issuing authority</Label>
              <Input
                id="doc-authority"
                value={state.issuingAuthority}
                onChange={(event) => set("issuingAuthority", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-issued">Issue date</Label>
              <Input
                id="doc-issued"
                type="date"
                value={state.issueDate}
                onChange={(event) => set("issueDate", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-expiry">Expiry date</Label>
              <Input
                id="doc-expiry"
                type="date"
                value={state.expiryDate}
                onChange={(event) => set("expiryDate", event.target.value)}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Checkbox
                id="doc-primary"
                checked={state.isPrimary}
                onCheckedChange={(checked) => set("isPrimary", checked === true)}
              />
              <Label htmlFor="doc-primary" className="cursor-pointer">
                Set as primary for this type
              </Label>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="doc-notes">Notes</Label>
              <Textarea
                id="doc-notes"
                value={state.notes}
                onChange={(event) => set("notes", event.target.value)}
                rows={3}
              />
            </div>
          </div>
          {updateError ? (
            <p className="text-sm text-destructive">
              {updateError instanceof Error ? updateError.message : "Failed to save document."}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateFromPlaintext.isPending}>
              {updateFromPlaintext.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
