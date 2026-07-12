/** Widget slot rendered beneath each option on the product detail page. */
export const productDetailOptionExtrasSlot = "product.details.option-extras"

export interface ProductDetailOptionExtrasSlotContext {
  optionId: string
  productId: string
}
