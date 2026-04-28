"use client"

import {
  type CreateProductCategoryInput,
  type ProductCategoryRecord,
  useProductCategoryMutation,
} from "@voyantjs/products-react"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Switch } from "@voyantjs/ui/components/switch"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { ProductCategoryCombobox } from "./product-category-combobox"

type Mode = { kind: "create" } | { kind: "edit"; category: ProductCategoryRecord }

export interface ProductCategoryFormProps {
  mode: Mode
  onSuccess?: (category: ProductCategoryRecord) => void
  onCancel?: () => void
}

interface FormState {
  name: string
  slug: string
  parentId: string
  description: string
  sortOrder: string
  active: boolean
}

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    const category = mode.category
    return {
      name: category.name,
      slug: category.slug,
      parentId: category.parentId ?? "__none__",
      description: category.description ?? "",
      sortOrder: String(category.sortOrder),
      active: category.active,
    }
  }

  return {
    name: "",
    slug: "",
    parentId: "__none__",
    description: "",
    sortOrder: "0",
    active: true,
  }
}

function toPayload(state: FormState): CreateProductCategoryInput {
  return {
    name: state.name.trim(),
    slug: state.slug.trim(),
    parentId: state.parentId === "__none__" ? null : state.parentId,
    description: state.description.trim() || null,
    sortOrder: Number(state.sortOrder) || 0,
    active: state.active,
  }
}

export function ProductCategoryForm({ mode, onSuccess, onCancel }: ProductCategoryFormProps) {
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = useProductCategoryMutation()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.name.trim()) {
      setError("Category name is required.")
      return
    }

    if (!state.slug.trim()) {
      setError("Category slug is required.")
      return
    }

    try {
      const category =
        mode.kind === "create"
          ? await create.mutateAsync(toPayload(state))
          : await update.mutateAsync({ id: mode.category.id, input: toPayload(state) })
      onSuccess?.(category)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product category.")
    }
  }

  return (
    <form data-slot="product-category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-category-name">Name</Label>
          <Input
            id="product-category-name"
            required
            autoFocus
            value={state.name}
            onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Adventure"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-category-slug">Slug</Label>
          <Input
            id="product-category-slug"
            required
            value={state.slug}
            onChange={(event) => setState((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="adventure"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Parent category</Label>
        <ProductCategoryCombobox
          value={state.parentId === "__none__" ? null : state.parentId}
          onChange={(value) => setState((prev) => ({ ...prev, parentId: value ?? "__none__" }))}
          excludeId={mode.kind === "edit" ? mode.category.id : null}
          placeholder="Search parent category…"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-category-description">Description</Label>
        <Textarea
          id="product-category-description"
          value={state.description}
          onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Category description..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-category-sort-order">Sort order</Label>
          <Input
            id="product-category-sort-order"
            type="number"
            value={state.sortOrder}
            onChange={(event) => setState((prev) => ({ ...prev, sortOrder: event.target.value }))}
          />
        </div>

        <div className="flex items-center gap-2 pt-7">
          <Switch
            checked={state.active}
            onCheckedChange={(active) => setState((prev) => ({ ...prev, active }))}
          />
          <Label>Active</Label>
        </div>
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
          {mode.kind === "edit" ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  )
}
