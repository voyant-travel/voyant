"use client"

import { VoyantReactProvider, type VoyantReactProviderProps } from "@voyant-travel/react"
import type * as React from "react"

import { AdminProvider, type AdminProviderProps } from "./admin-provider.js"
import { useLocale } from "./locale.js"
import {
  type OperatorAdminMessageOverrides,
  OperatorAdminMessagesProvider,
} from "./operator-admin-messages.js"

export type AdminChildProvider = React.ComponentType<
  React.PropsWithChildren<Record<string, unknown>>
>

export interface AdminDomainMessagesProviderProps {
  children: React.ReactNode
  locale: string | null | undefined
  timeZone?: string | null
}

export type AdminDomainMessagesProvider = React.ComponentType<
  AdminDomainMessagesProviderProps & Record<string, unknown>
>

export interface AdminProviderSequenceProps {
  children: React.ReactNode
  providers?: ReadonlyArray<AdminChildProvider>
}

function getProviderKey(Provider: { displayName?: string; name?: string }): string | undefined {
  const namedProvider = Provider as { displayName?: string; name?: string }
  return namedProvider.displayName ?? namedProvider.name
}

export function AdminProviderSequence({ children, providers = [] }: AdminProviderSequenceProps) {
  return providers.reduceRight(
    (content, Provider) => <Provider key={getProviderKey(Provider)}>{content}</Provider>,
    children,
  )
}

export interface AdminDomainMessagesProviderStackProps {
  children: React.ReactNode
  providers?: ReadonlyArray<AdminDomainMessagesProvider>
}

export function AdminDomainMessagesProviderStack({
  children,
  providers = [],
}: AdminDomainMessagesProviderStackProps) {
  const { resolvedLocale, timeZone } = useLocale()

  return providers.reduceRight(
    (content, Provider) => (
      <Provider key={getProviderKey(Provider)} locale={resolvedLocale} timeZone={timeZone}>
        {content}
      </Provider>
    ),
    children,
  )
}

export interface OperatorAdminShellProviderProps
  extends Omit<AdminProviderProps, "children">,
    Pick<VoyantReactProviderProps, "baseUrl" | "fetcher"> {
  children: React.ReactNode
  /**
   * App-level providers that do not need locale props, such as tooltip or
   * feature-flag providers.
   */
  providers?: ReadonlyArray<AdminChildProvider>
  /**
   * Domain UI i18n providers that accept `{ locale, children }`.
   */
  domainMessageProviders?: ReadonlyArray<AdminDomainMessagesProvider>
  messageOverrides?: OperatorAdminMessageOverrides | null
}

export function OperatorAdminShellProvider({
  baseUrl,
  children,
  domainMessageProviders,
  fetcher,
  messageOverrides,
  providers,
  ...adminProviderProps
}: OperatorAdminShellProviderProps) {
  return (
    <AdminProvider {...adminProviderProps}>
      <VoyantReactProvider baseUrl={baseUrl} fetcher={fetcher}>
        <OperatorAdminMessagesProvider overrides={messageOverrides}>
          <AdminProviderSequence providers={providers}>
            <AdminDomainMessagesProviderStack providers={domainMessageProviders}>
              {children}
            </AdminDomainMessagesProviderStack>
          </AdminProviderSequence>
        </OperatorAdminMessagesProvider>
      </VoyantReactProvider>
    </AdminProvider>
  )
}
