import {
  type MarketsUiMessageOverrides,
  MarketsUiMessagesProvider,
} from "@voyantjs/markets-react/i18n"
import {
  type PricingUiMessageOverrides,
  PricingUiMessagesProvider,
} from "@voyantjs/pricing-react/i18n"
import {
  type PromotionsUiMessageOverrides,
  PromotionsUiMessagesProvider,
} from "@voyantjs/promotions-react/i18n"
import {
  type SellabilityUiMessageOverrides,
  SellabilityUiMessagesProvider,
} from "@voyantjs/sellability-react/i18n"
import type { ReactNode } from "react"

export * from "@voyantjs/markets-react/i18n"
export * from "@voyantjs/pricing-react/i18n"
export * from "@voyantjs/promotions-react/i18n"
export * from "@voyantjs/sellability-react/i18n"

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
