import type {
  CreateProductComponentInput,
  ProductComponentChoiceRecord,
  ProductComponentRecord,
} from "@voyantjs/products-react"

export type ComponentFormValues = {
  componentKind: ProductComponentRecord["componentKind"]
  title: string
  summary: string
  description: string
  selection: ProductComponentRecord["selection"]
  commitmentBoundary: ProductComponentRecord["commitmentBoundary"]
  priceDisposition: ProductComponentRecord["priceDisposition"]
  required: boolean
  quantity: string
  sortOrder: string
  choices: ComponentChoiceFormValue[]
}

export type ComponentChoiceFormValue = {
  id: string
  title: string
  description: string
  isDefault: boolean
  sortOrder: string
  pricingRef?: ProductComponentChoiceRecord["pricing_ref"]
}

export function componentToFormValues(
  component: ProductComponentRecord | undefined,
  sortOrder: number,
): ComponentFormValues {
  return {
    componentKind: component?.componentKind ?? "accommodation",
    title: component?.title ?? "",
    summary: component?.summary ?? "",
    description: component?.description ?? "",
    selection: component?.selection ?? "fixed",
    commitmentBoundary: component?.commitmentBoundary ?? "internal",
    priceDisposition: component?.priceDisposition ?? "included",
    required: component?.required ?? false,
    quantity: component?.quantity == null ? "" : String(component.quantity),
    sortOrder: String(component?.sortOrder ?? sortOrder),
    choices:
      component?.choices.map((choice, index) => ({
        id: choice.id,
        title: choice.title,
        description: choice.description ?? "",
        isDefault: Boolean(choice.is_default),
        sortOrder: String(choice.sort_order ?? index),
        pricingRef: choice.pricing_ref ?? undefined,
      })) ?? [],
  }
}

export function formValuesToPayload(
  values: ComponentFormValues,
): CreateProductComponentInput | null {
  const title = values.title.trim()
  if (!title) return null

  return {
    componentKind: values.componentKind,
    title,
    summary: optionalString(values.summary),
    description: optionalString(values.description),
    selection: values.selection,
    commitmentBoundary: values.commitmentBoundary,
    priceDisposition: values.priceDisposition,
    required: values.required,
    quantity: optionalPositiveInteger(values.quantity),
    sortOrder: optionalInteger(values.sortOrder) ?? 0,
    binding: buildInlineBinding(values),
    choices: values.choices
      .map((choice, index) => {
        const choiceTitle = choice.title.trim()
        if (!choiceTitle) return null
        return {
          id: choice.id || uniqueChoiceId(slugify(choiceTitle) || "choice", values.choices),
          title: choiceTitle,
          description: optionalString(choice.description),
          is_default: choice.isDefault,
          sort_order: optionalInteger(choice.sortOrder) ?? index,
          pricing_ref: choice.pricingRef ?? undefined,
        }
      })
      .filter((choice): choice is NonNullable<typeof choice> => choice !== null),
    media: [],
    tags: [],
    metadata: null,
  }
}

function buildInlineBinding(values: ComponentFormValues): unknown {
  const title = values.title.trim()
  const description = optionalString(values.description) ?? optionalString(values.summary)

  if (values.componentKind === "accommodation") {
    return {
      type: "inline",
      content: {
        property: {
          name: title,
          description,
          amenities: [],
          media: [],
        },
      },
    }
  }

  if (values.componentKind === "transport") {
    return {
      type: "inline",
      content: {
        legs: [],
        summary: optionalString(values.summary) ?? title,
      },
    }
  }

  return {
    type: "inline",
    content: {
      title,
      description,
      inclusions: [],
      media: [],
    },
  }
}

function optionalString(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function optionalInteger(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function optionalPositiveInteger(value: string): number | null {
  const parsed = optionalInteger(value)
  return parsed && parsed > 0 ? parsed : null
}

export function uniqueChoiceId(seed: string, choices: ComponentChoiceFormValue[]): string {
  const base = slugify(seed) || "choice"
  const existing = new Set(choices.map((choice) => choice.id).filter(Boolean))
  if (!existing.has(base)) return base
  let suffix = 2
  while (existing.has(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
