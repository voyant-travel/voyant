import type { MarketRecord } from "@voyant-travel/commerce-react/markets"
import type { ChannelDetail } from "@voyant-travel/distribution-react"
import type { ProductOptionRecord, ProductRecord } from "@voyant-travel/inventory-react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { ChannelCombobox } from "./components/channel-combobox.js"
import {
  getSellabilityUiI18n,
  resolveSellabilityUiMessages,
  SellabilityUiMessagesProvider,
  useSellabilityUiMessagesOrDefault,
} from "./i18n/index.js"

const channel = {
  id: "channel-1",
  name: "Partner Channel",
  kind: "affiliate",
  status: "active",
  website: null,
  contactName: null,
  contactEmail: null,
  metadata: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ChannelDetail

const market = {
  id: "market-1",
  code: "RO",
  name: "Romania",
  defaultCurrency: "RON",
  defaultLanguageTag: "ro-RO",
  regionCode: null,
  countryCode: null,
  timezone: null,
  taxContext: null,
  status: "active",
  metadata: null,
} satisfies MarketRecord

const product = {
  id: "product-1",
  name: "Danube Cruise",
  status: "active",
  description: null,
  inclusionsHtml: null,
  exclusionsHtml: null,
  termsHtml: null,
  termsShowOnContract: false,
  bookingMode: "date_time",
  capacityMode: "limited",
  timezone: null,
  visibility: "public",
  activated: true,
  reservationTimeoutMinutes: null,
  taxClassId: null,
  sellCurrency: "EUR",
  sellAmountCents: null,
  costAmountCents: null,
  marginPercent: null,
  facilityId: null,
  startDate: null,
  endDate: null,
  pax: null,
  productTypeId: null,
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ProductRecord

const option = {
  id: "option-1",
  productId: "product-1",
  name: "Balcony Cabin",
  code: "BAL",
  description: null,
  status: "active",
  isDefault: false,
  sortOrder: 0,
  availableFrom: null,
  availableTo: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies ProductOptionRecord

vi.mock("@voyant-travel/distribution-react", () => ({
  useChannels: () => ({
    data: { data: [channel] },
    isPending: false,
  }),
  useChannel: () => ({
    data: channel,
    isPending: false,
  }),
}))

vi.mock("@voyant-travel/commerce-react/markets", () => ({
  useMarkets: () => ({
    data: { data: [market] },
    isPending: false,
  }),
  useMarket: () => ({
    data: market,
    isPending: false,
  }),
}))

vi.mock("@voyant-travel/inventory-react", () => ({
  useProducts: () => ({
    data: { data: [product] },
    isPending: false,
  }),
  useProduct: () => ({
    data: product,
    isPending: false,
  }),
  useProductOptions: () => ({
    data: { data: [option] },
    isPending: false,
  }),
  useProductOption: () => ({
    data: option,
    isPending: false,
  }),
}))

vi.mock("./index.js", () => ({
  useSellabilityPolicyMutation: () => ({
    create: {
      isPending: false,
      mutateAsync: async (value: unknown) => value,
    },
    update: {
      isPending: false,
      mutateAsync: async (value: unknown) => value,
    },
  }),
}))

describe("sellability-ui i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveSellabilityUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            policyDialog: {
              actions: {
                create: "Creeaza Politica",
              },
            },
          },
        },
      },
    })

    expect(result.policyDialog.actions.create).toBe("Creeaza Politica")
    expect(result.common.policyTypeLabels.availability_window).toBe("Fereastra de disponibilitate")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getSellabilityUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English copy without a provider", () => {
    const html = renderToStaticMarkup(
      <div>
        <ChannelCombobox value={channel.id} onChange={() => {}} />
        <SellabilityMessageProbe />
      </div>,
    )

    expect(html).toContain("Select channel")
    expect(html).toContain("Edit Policy")
    expect(html).toContain("Affiliate")
    expect(html).toContain("Timed activity")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      <SellabilityUiMessagesProvider locale="ro-RO">
        <div>
          <ChannelCombobox value={channel.id} onChange={() => {}} />
          <SellabilityMessageProbe />
        </div>
      </SellabilityUiMessagesProvider>,
    )

    expect(html).toContain("Selecteaza canal")
    expect(html).toContain("Editeaza Politica")
    expect(html).toContain("Afiliat")
    expect(html).toContain("Activitate cu oră")
  })
})

function SellabilityMessageProbe() {
  const messages = useSellabilityUiMessagesOrDefault()

  return (
    <div>
      <span>{messages.policyDialog.titles.edit}</span>
      <span>{messages.common.channelKindLabels.affiliate}</span>
      <span>{messages.common.productBookingModeLabels.date_time}</span>
    </div>
  )
}
