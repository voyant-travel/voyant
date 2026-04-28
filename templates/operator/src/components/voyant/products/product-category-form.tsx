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
import { useAdminMessages } from "@/lib/admin-i18n"
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
  const messages = useAdminMessages()
  const categoryMessages = messages.products.taxonomy.categories
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
      setError(categoryMessages.validationNameRequired)
      return
    }

    if (!state.slug.trim()) {
      setError(categoryMessages.validationSlugRequired)
      return
    }

    try {
      const category =
        mode.kind === "create"
          ? await create.mutateAsync(toPayload(state))
          : await update.mutateAsync({ id: mode.category.id, input: toPayload(state) })
      onSuccess?.(category)
    } catch (err) {
      setError(err instanceof Error ? err.message : categoryMessages.saveFailed)
    }
  }

  return (
    <form data-slot="product-category-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-category-name">{categoryMessages.nameLabel}</Label>
          <Input
            id="product-category-name"
            required
            autoFocus
            value={state.name}
            onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={categoryMessages.namePlaceholder}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-category-slug">{categoryMessages.slugLabel}</Label>
          <Input
            id="product-category-slug"
            required
            value={state.slug}
            onChange={(event) => setState((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder={categoryMessages.slugPlaceholder}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{categoryMessages.parentLabel}</Label>
        <ProductCategoryCombobox
          value={state.parentId === "__none__" ? null : state.parentId}
          onChange={(value) => setState((prev) => ({ ...prev, parentId: value ?? "__none__" }))}
          excludeId={mode.kind === "edit" ? mode.category.id : null}
          placeholder={categoryMessages.parentPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-category-description">{categoryMessages.descriptionLabel}</Label>
        <Textarea
          id="product-category-description"
          value={state.description}
          onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
          placeholder={categoryMessages.descriptionPlaceholder}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-category-sort-order">{categoryMessages.sortOrderLabel}</Label>
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
          <Label>{categoryMessages.activeLabel}</Label>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {categoryMessages.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {mode.kind === "edit" ? categoryMessages.saveChanges : categoryMessages.createCategory}
        </Button>
      </div>
    </form>
  )
}
