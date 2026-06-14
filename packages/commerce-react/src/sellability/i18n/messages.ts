import type { ChannelDetail } from "@voyantjs/distribution-react"
import type { ProductRecord } from "@voyantjs/inventory-react"
import type { SellabilityPolicyRecord } from "../index.js"

export type ChannelKind = ChannelDetail["kind"]
export type ChannelStatus = ChannelDetail["status"]
export type ProductStatus = ProductRecord["status"]
export type ProductBookingMode = ProductRecord["bookingMode"]
export type PolicyScope = SellabilityPolicyRecord["scope"]
export type PolicyType = SellabilityPolicyRecord["policyType"]

export type SellabilityUiMessages = {
  common: {
    loading: string
    cancel: string
    active: string
    channelKindLabels: Record<ChannelKind, string>
    channelStatusLabels: Record<ChannelStatus, string>
    productStatusLabels: Record<ProductStatus, string>
    productBookingModeLabels: Record<ProductBookingMode, string>
    policyScopeLabels: Record<PolicyScope, string>
    policyTypeLabels: Record<PolicyType, string>
  }
  channelCombobox: {
    placeholder: string
    empty: string
  }
  marketCombobox: {
    placeholder: string
    empty: string
  }
  productCombobox: {
    placeholder: string
    empty: string
  }
  productOptionCombobox: {
    placeholder: string
    empty: string
    selectProductFirst: string
  }
  policyDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      name: string
      scope: string
      type: string
      priority: string
      product: string
      option: string
      market: string
      channel: string
      conditionsJson: string
      effectsJson: string
      notes: string
      active: string
    }
    placeholders: {
      name: string
    }
    actions: {
      create: string
      save: string
    }
    validation: {
      nameRequired: string
      jsonObject: string
    }
  }
}
