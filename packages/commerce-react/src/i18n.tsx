import type { ReactNode } from "react"
import { type MarketsUiMessageOverrides, MarketsUiMessagesProvider } from "./markets/i18n/index.js"
import { type PricingUiMessageOverrides, PricingUiMessagesProvider } from "./pricing/i18n/index.js"
import {
  type PromotionsUiMessageOverrides,
  PromotionsUiMessagesProvider,
} from "./promotions/i18n/index.js"
import {
  type SellabilityUiMessageOverrides,
  SellabilityUiMessagesProvider,
} from "./sellability/i18n/index.js"

export * from "./markets/i18n/index.js"
export * from "./pricing/i18n/index.js"
export * from "./promotions/i18n/index.js"
export * from "./sellability/i18n/index.js"

export interface CommerceUiMessageOverrides {
  markets?: MarketsUiMessageOverrides | null
  pricing?: PricingUiMessageOverrides | null
  promotions?: PromotionsUiMessageOverrides | null
  sellability?: SellabilityUiMessageOverrides | null
}

export interface CommerceUiMessagesProviderProps {
  children: ReactNode
  locale: string | null | undefined
  overrides?: CommerceUiMessageOverrides | null
}

export function CommerceUiMessagesProvider({
  children,
  locale,
  overrides,
}: CommerceUiMessagesProviderProps) {
  return (
    <MarketsUiMessagesProvider locale={locale} overrides={overrides?.markets}>
      <PricingUiMessagesProvider locale={locale} overrides={overrides?.pricing}>
        <SellabilityUiMessagesProvider locale={locale} overrides={overrides?.sellability}>
          <PromotionsUiMessagesProvider locale={locale} overrides={overrides?.promotions}>
            {children}
          </PromotionsUiMessagesProvider>
        </SellabilityUiMessagesProvider>
      </PricingUiMessagesProvider>
    </MarketsUiMessagesProvider>
  )
}
