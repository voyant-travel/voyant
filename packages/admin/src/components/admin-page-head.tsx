"use client"

import type * as React from "react"
import { createContext, useContext, useEffect, useId, useMemo, useState } from "react"

import { DEFAULT_ADMIN_LOCALE, useLocale } from "../providers/locale.js"

export interface AdminPageHeadOptions {
  brand?: string | null
  description?: string | null
  title?: string | null
}

export interface AdminPageHeadProps extends AdminPageHeadOptions {
  children?: React.ReactNode
}

export interface AdminPageHeadProviderProps {
  baseHead?: AdminPageHeadOptions | null
  children: React.ReactNode
}

interface AdminPageHeadContextValue {
  setPageHeadOverride: (id: string, head: AdminPageHeadOptions | null) => void
}

const AdminPageHeadContext = createContext<AdminPageHeadContextValue | null>(null)

function formatAdminDocumentTitle({
  brand,
  title,
}: Pick<AdminPageHeadOptions, "brand" | "title">): string {
  const resolvedBrand = brand?.trim() || "Voyant"
  const resolvedTitle = title?.trim()

  return resolvedTitle ? `${resolvedTitle} · ${resolvedBrand}` : resolvedBrand
}

function upsertMeta(selector: string, attributes: Record<string, string>, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = document.createElement("meta")
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value)
    }
    document.head.appendChild(element)
  }

  element.content = content
}

function useApplyAdminPageHead({
  brand,
  description,
  enabled = true,
  title,
}: AdminPageHeadOptions & { enabled?: boolean }) {
  const { resolvedLocale } = useLocale()

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return
    }

    const lang = resolvedLocale || DEFAULT_ADMIN_LOCALE
    if (document.documentElement.lang !== lang) {
      document.documentElement.lang = lang
    }
  }, [enabled, resolvedLocale])

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return
    }

    const documentTitle = formatAdminDocumentTitle({ brand, title })
    document.title = documentTitle
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, documentTitle)
  }, [brand, enabled, title])

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || description == null) {
      return
    }

    upsertMeta('meta[name="description"]', { name: "description" }, description)
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, description)
  }, [description, enabled])
}

function mergeAdminPageHead(
  baseHead: AdminPageHeadOptions | null | undefined,
  override: AdminPageHeadOptions | null | undefined,
): AdminPageHeadOptions {
  return {
    brand: override?.brand ?? baseHead?.brand ?? "Voyant",
    description: override?.description ?? baseHead?.description ?? null,
    title: override?.title ?? baseHead?.title ?? null,
  }
}

export function AdminPageHead({ children, ...head }: AdminPageHeadProps) {
  useApplyAdminPageHead(head)

  return <>{children ?? null}</>
}

export function AdminPageHeadProvider({ baseHead, children }: AdminPageHeadProviderProps) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, AdminPageHeadOptions>>(
    () => new Map(),
  )
  const latestOverride = Array.from(overrides.values()).at(-1)
  const resolvedHead = mergeAdminPageHead(baseHead, latestOverride)
  const context = useMemo<AdminPageHeadContextValue>(
    () => ({
      setPageHeadOverride(id, head) {
        setOverrides((currentOverrides) => {
          const nextOverrides = new Map(currentOverrides)

          if (head) {
            nextOverrides.set(id, head)
          } else {
            nextOverrides.delete(id)
          }

          return nextOverrides
        })
      },
    }),
    [],
  )

  return (
    <AdminPageHeadContext.Provider value={context}>
      <AdminPageHead {...resolvedHead} />
      {children}
    </AdminPageHeadContext.Provider>
  )
}

export function useAdminPageHead(head: AdminPageHeadOptions) {
  const context = useContext(AdminPageHeadContext)
  const id = useId()
  const stableHead = useMemo(
    () => ({
      brand: head.brand,
      description: head.description,
      title: head.title,
    }),
    [head.brand, head.description, head.title],
  )

  useEffect(() => {
    if (!context) {
      return
    }

    context.setPageHeadOverride(id, stableHead)

    return () => context.setPageHeadOverride(id, null)
  }, [context, id, stableHead])

  useApplyAdminPageHead({
    ...stableHead,
    enabled: context == null,
  })
}
