"use client"

import { useProductVersionMutation } from "@voyantjs/products-react"
import { Button } from "@voyantjs/voyant-ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/voyant-ui/components/dialog"
import { Label } from "@voyantjs/voyant-ui/components/label"
import { Textarea } from "@voyantjs/voyant-ui/components/textarea"
import { Loader2 } from "lucide-react"
import * as React from "react"

export interface ProductVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  onSuccess?: () => void
}

export function ProductVersionDialog({
  open,
  onOpenChange,
  productId,
  onSuccess,
}: ProductVersionDialogProps) {
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const { create } = useProductVersionMutation()

  React.useEffect(() => {
    if (open) {
      setNotes("")
      setError(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-version-dialog" className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create version snapshot</DialogTitle>
          <DialogDescription>
            Save the current product state, including itinerary and option structure, as a new
            version.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)

            try {
              await create.mutateAsync({
                productId,
                notes: notes.trim() ? notes.trim() : null,
              })
              onSuccess?.()
              onOpenChange(false)
            } catch (submissionError) {
              setError(
                submissionError instanceof Error
                  ? submissionError.message
                  : "Failed to create version snapshot.",
              )
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-version-notes">Notes</Label>
            <Textarea
              id="product-version-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What changed in this version?"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Create version
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
