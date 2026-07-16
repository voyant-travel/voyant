"use client"

import { createContext, type ReactNode, useContext, useMemo } from "react"

import { createLocaleFormatters, type LocaleFormatters } from "./package-formatters.js"
import {
  type LocaleMessageDefinitions,
  type LocaleMessageOverrides,
  resolveLocaleMessages,
  useResolvedLocaleMessages,
} from "./runtime.js"

export interface PackageMessagesProviderProps<T extends Record<string, unknown>> {
  children: ReactNode
  locale: string | null | undefined
  messages: T
  timeZone?: string | null
}

export type PackageI18nValue<T extends Record<string, unknown>> = LocaleFormatters & {
  messages: T
}

export interface ResolvedPackageMessagesProviderProps<T extends Record<string, unknown>> {
  children: ReactNode
  definitions: LocaleMessageDefinitions<T>
  fallbackLocale: string
  locale: string | null | undefined
  overrides?: LocaleMessageOverrides<T> | null
  timeZone?: string | null
}

export function createPackageMessagesContext<T extends Record<string, unknown>>(
  displayName: string,
) {
  const Context = createContext<PackageI18nValue<T> | undefined>(undefined)
  Context.displayName = `${displayName}Context`

  function MessagesProvider({
    children,
    locale,
    messages,
    timeZone,
  }: PackageMessagesProviderProps<T>) {
    const formatters = useMemo(() => createLocaleFormatters(locale, timeZone), [locale, timeZone])
    const value = useMemo<PackageI18nValue<T>>(
      () => ({
        ...formatters,
        messages,
      }),
      [formatters, messages],
    )

    return <Context.Provider value={value}>{children}</Context.Provider>
  }

  MessagesProvider.displayName = `${displayName}Provider`

  function ResolvedMessagesProvider({
    children,
    definitions,
    fallbackLocale,
    locale,
    overrides,
    timeZone,
  }: ResolvedPackageMessagesProviderProps<T>) {
    const messages = useResolvedLocaleMessages({
      locale,
      fallbackLocale,
      definitions,
      overrides,
    })

    return (
      <MessagesProvider locale={locale ?? fallbackLocale} messages={messages} timeZone={timeZone}>
        {children}
      </MessagesProvider>
    )
  }

  ResolvedMessagesProvider.displayName = `${displayName}ResolvedProvider`

  function usePackageI18n(): PackageI18nValue<T> {
    const context = useContext(Context)
    if (!context) {
      throw new Error(
        `${displayName} context is missing. Wrap the tree in <${MessagesProvider.displayName}>.`,
      )
    }

    return context
  }

  function useOptionalPackageI18n(): PackageI18nValue<T> | undefined {
    return useContext(Context)
  }

  function usePackageMessages(): T {
    return usePackageI18n().messages
  }

  function useOptionalPackageMessages(): T | undefined {
    return useOptionalPackageI18n()?.messages
  }

  return {
    MessagesProvider,
    ResolvedMessagesProvider,
    useI18n: usePackageI18n,
    useOptionalI18n: useOptionalPackageI18n,
    useMessages: usePackageMessages,
    useOptionalMessages: useOptionalPackageMessages,
  }
}

export function resolvePackageMessages<T extends Record<string, unknown>>({
  definitions,
  fallbackLocale,
  locale,
  overrides,
}: {
  definitions: LocaleMessageDefinitions<T>
  fallbackLocale: string
  locale: string | null | undefined
  overrides?: LocaleMessageOverrides<T> | null
}): T {
  return resolveLocaleMessages({
    locale,
    fallbackLocale,
    definitions,
    overrides,
  })
}
