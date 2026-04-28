"use client"

import {
  type CreateProductTagInput,
  type ProductTagRecord,
  useProductTagMutation,
} from "@voyantjs/products-react"
import { Button } from "@voyantjs/voyant-ui/components/button"
import { Input } from "@voyantjs/voyant-ui/components/input"
import { Label } from "@voyantjs/voyant-ui/components/label"
import { Loader2 } from "lucide-react"
import * as React from "react"

type Mode = { kind: "create" } | { kind: "edit"; tag: ProductTagRecord }

export interface ProductTagFormProps {
  mode: Mode
  onSuccess?: (tag: ProductTagRecord) => void
  onCancel?: () => void
}

function initialState(mode: Mode) {
  return {
    name: mode.kind === "edit" ? mode.tag.name : "",
  }
}

function toPayload(state: { name: string }): CreateProductTagInput {
  return { name: state.name.trim() }
}

export function ProductTagForm({ mode, onSuccess, onCancel }: ProductTagFormProps) {
  const [state, setState] = React.useState(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useProductTagMutation()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError("Tag name is required.")
      return
    }

    try {
      const tag =
        mode.kind === "create"
          ? await create.mutateAsync(toPayload(state))
          : await update.mutateAsync({ id: mode.tag.id, input: toPayload(state) })
      onSuccess?.(tag)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product tag.")
    }
  }

  return (
    <form data-slot="product-tag-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-tag-name">Name</Label>
        <Input
          id="product-tag-name"
          required
          autoFocus
          value={state.name}
          onChange={(event) => setState({ name: event.target.value })}
          placeholder="Family Friendly"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "edit" ? "Save changes" : "Create tag"}
        </Button>
      </div>
    </form>
  )
}
