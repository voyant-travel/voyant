"use client"

import { useProductVersionMutation } from "@voyantjs/products-react"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"

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
  const messages = useRegistryProductsMessagesOrDefault()

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
          <DialogTitle>{messages.productVersionDialog.title}</DialogTitle>
          <DialogDescription>{messages.productVersionDialog.description}</DialogDescription>
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
                  : messages.productVersionDialog.validation.saveFailed,
              )
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-version-notes">
              {messages.productVersionDialog.fields.notes}
            </Label>
            <Textarea
              id="product-version-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={messages.productVersionDialog.placeholders.notes}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {messages.productVersionDialog.actions.createVersion}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
