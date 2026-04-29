"use client"

import {
  type CreateProductTagInput,
  type ProductTagRecord,
  useProductTagMutation,
} from "@voyantjs/products-react"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useRegistryProductsMessagesOrDefault } from "./i18n/provider"

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
  const messages = useRegistryProductsMessagesOrDefault()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError(messages.productTagForm.validation.nameRequired)
      return
    }

    try {
      const tag =
        mode.kind === "create"
          ? await create.mutateAsync(toPayload(state))
          : await update.mutateAsync({ id: mode.tag.id, input: toPayload(state) })
      onSuccess?.(tag)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.productTagForm.validation.saveFailed)
    }
  }

  return (
    <form data-slot="product-tag-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-tag-name">{messages.productTagForm.fields.name}</Label>
        <Input
          id="product-tag-name"
          required
          autoFocus
          value={state.name}
          onChange={(event) => setState({ name: event.target.value })}
          placeholder={messages.productTagForm.placeholders.name}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {messages.common.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "edit"
            ? messages.common.saveChanges
            : messages.productTagForm.actions.createTag}
        </Button>
      </div>
    </form>
  )
}
