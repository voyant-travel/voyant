"use client"

import { useProductItineraryMutation } from "@voyantjs/products-react"
import { Button } from "@voyantjs/voyant-ui/components/button"
import { Checkbox } from "@voyantjs/voyant-ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/voyant-ui/components/dialog"
import { Input } from "@voyantjs/voyant-ui/components/input"
import { Label } from "@voyantjs/voyant-ui/components/label"
import { Loader2 } from "lucide-react"
import * as React from "react"

type ItineraryData = {
  id: string
  name: string
  isDefault: boolean
}

export interface ProductItineraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  itinerary?: ItineraryData
  itineraryCount: number
  onSuccess?: (itineraryId: string) => void
}

export function ProductItineraryDialog({
  open,
  onOpenChange,
  productId,
  itinerary,
  itineraryCount,
  onSuccess,
}: ProductItineraryDialogProps) {
  const isEditing = !!itinerary
  const isFirstItinerary = !isEditing && itineraryCount === 0
  const defaultLocked = isEditing && itinerary?.isDefault === true

  const [name, setName] = React.useState("")
  const [isDefault, setIsDefault] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const { create, update } = useProductItineraryMutation()
  const pending = create.isPending || update.isPending

  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (itinerary) {
      setName(itinerary.name)
      setIsDefault(itinerary.isDefault)
    } else {
      setName("")
      setIsDefault(isFirstItinerary)
    }
  }, [open, itinerary, isFirstItinerary])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required")
      return
    }

    try {
      if (itinerary) {
        const patch: { name?: string; isDefault?: boolean } = {}
        if (trimmed !== itinerary.name) patch.name = trimmed
        if (isDefault && !itinerary.isDefault) patch.isDefault = true
        if (Object.keys(patch).length > 0) {
          await update.mutateAsync({
            productId,
            itineraryId: itinerary.id,
            input: patch,
          })
        }
        onSuccess?.(itinerary.id)
      } else {
        const created = await create.mutateAsync({
          productId,
          input: {
            name: trimmed,
            sortOrder: itineraryCount,
            isDefault: itineraryCount === 0 ? true : isDefault,
          },
        })
        onSuccess?.(created.id)
      }
      onOpenChange(false)
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Failed to save itinerary.",
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="product-itinerary-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Rename itinerary" : "New itinerary"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the itinerary name and default state."
              : "Add another itinerary variant for this product."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-itinerary-name">Name</Label>
            <Input
              id="product-itinerary-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Main itinerary, Family variant"
            />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="product-itinerary-default"
              checked={isDefault}
              disabled={defaultLocked || isFirstItinerary}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="product-itinerary-default" className="text-sm font-normal">
                Set as default itinerary
              </Label>
              {defaultLocked ? (
                <p className="text-xs text-muted-foreground">
                  This is the default. Set another itinerary as default to change it.
                </p>
              ) : isFirstItinerary ? (
                <p className="text-xs text-muted-foreground">
                  The first itinerary is automatically the default.
                </p>
              ) : null}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
              {isEditing ? "Save changes" : "Create itinerary"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
