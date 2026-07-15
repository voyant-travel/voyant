"use client"

import {
  createLocaleFormatters,
  createPackageMessagesContext,
  type LocaleMessageDefinitions,
  type PackageI18nValue,
} from "@voyant-travel/i18n"
import type { ReactNode } from "react"

export type EventCatalogUiMessages = {
  navigation: { title: string }
  page: {
    title: string
    selectedContracts: string
    selectedContractsLoading: string
    requestFailed: string
    requestFailedWithStatus: string
    eventsLabel: string
    contractLabel: string
    filterLabel: string
    filterPlaceholder: string
    loading: string
    noMatchingEvents: string
    owner: string
    sourceModule: string
    visibility: string
    category: string
    redactedFields: string
    noneDeclared: string
    payloadSchema: string
  }
}

export const eventCatalogUiEn: EventCatalogUiMessages = {
  navigation: { title: "Event catalog" },
  page: {
    title: "Event catalog",
    selectedContracts: "{count} selected event contracts",
    selectedContractsLoading: "Selected event contracts",
    requestFailed: "Event catalog request failed",
    requestFailedWithStatus: "Event catalog request failed ({status})",
    eventsLabel: "Events",
    contractLabel: "Event contract",
    filterLabel: "Filter events",
    filterPlaceholder: "Filter events",
    loading: "Loading...",
    noMatchingEvents: "No matching events.",
    owner: "Owner",
    sourceModule: "Source module",
    visibility: "Visibility",
    category: "Category",
    redactedFields: "Redacted fields",
    noneDeclared: "None declared.",
    payloadSchema: "Payload schema",
  },
}

const fallbackLocale = "en"

export const eventCatalogMessageDefinitions = {
  en: eventCatalogUiEn,
} satisfies LocaleMessageDefinitions<EventCatalogUiMessages>

const eventCatalogUiContext =
  createPackageMessagesContext<EventCatalogUiMessages>("EventCatalogUiMessages")

const defaultEventCatalogUiI18n: PackageI18nValue<EventCatalogUiMessages> = {
  messages: eventCatalogUiEn,
  ...createLocaleFormatters(fallbackLocale),
}

export function EventCatalogUiMessagesProvider({
  children,
  locale,
}: {
  children: ReactNode
  locale: string | null | undefined
}) {
  return (
    <eventCatalogUiContext.ResolvedMessagesProvider
      definitions={eventCatalogMessageDefinitions}
      fallbackLocale={fallbackLocale}
      locale={locale}
    >
      {children}
    </eventCatalogUiContext.ResolvedMessagesProvider>
  )
}

export function useEventCatalogUiMessagesOrDefault(): EventCatalogUiMessages {
  return eventCatalogUiContext.useOptionalMessages() ?? defaultEventCatalogUiI18n.messages
}
