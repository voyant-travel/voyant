import type { ProductRecord } from "@voyantjs/products-react"

export type ProductStatus = ProductRecord["status"]
export type ProductBookingMode = ProductRecord["bookingMode"]

export type ExtrasUiMessages = {
  productCombobox: {
    placeholder: string
    loading: string
    empty: string
    statusLabels: Record<ProductStatus, string>
    bookingModeLabels: Record<ProductBookingMode, string>
  }
}
