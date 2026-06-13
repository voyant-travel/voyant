import type { ProductOption } from "./schemas.js"

export function nullableString(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed ? trimmed : null
}

export function nullableNumber(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ""
  return trimmed ? Number(trimmed) : null
}

export function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return ""
  return value.slice(0, 16)
}

export function toIsoDateTime(value: string | null | undefined) {
  if (!value) return null
  return new Date(value).toISOString()
}

export function formatDateTime(value: string | null) {
  return value ? value.replace("T", " ").slice(0, 16) : "-"
}

export function productNameById(
  products: ProductOption[],
  productId: string,
  productName?: string | null,
) {
  if (productName) return productName
  return products.find((product) => product.id === productId)?.name ?? productId
}

export function formatSelectionLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatLocalizedSelectionLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}
