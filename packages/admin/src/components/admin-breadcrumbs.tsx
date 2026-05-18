"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@voyantjs/ui/components"
import type * as React from "react"
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { type AdminNavLinkComponent, DefaultAdminNavLink } from "./admin-nav-link.js"

export interface AdminBreadcrumbSegment {
  label: string
  href?: string
}

interface AdminBreadcrumbsContextValue {
  segments: ReadonlyArray<AdminBreadcrumbSegment>
  setSegments: (id: string, segments: ReadonlyArray<AdminBreadcrumbSegment> | null) => void
}

const AdminBreadcrumbsContext = createContext<AdminBreadcrumbsContextValue | null>(null)

export interface AdminBreadcrumbsProviderProps {
  children: React.ReactNode
}

export function AdminBreadcrumbsProvider({ children }: AdminBreadcrumbsProviderProps) {
  const [overrides, setOverrides] = useState<
    ReadonlyMap<string, ReadonlyArray<AdminBreadcrumbSegment>>
  >(() => new Map())
  const segments = useMemo(() => Array.from(overrides.values()).at(-1) ?? [], [overrides])
  // Stable `setSegments` reference — the function reads / writes through
  // the state setter only, so it never needs to capture `segments`. With
  // a stable setter and content-hash short-circuit, consumer effects
  // that depend on `context.setSegments` don't fire in a loop just
  // because some other consumer pushed segments.
  const setSegments = useCallback<AdminBreadcrumbsContextValue["setSegments"]>((id, next) => {
    setOverrides((current) => {
      const existing = current.get(id)
      const desired = next && next.length > 0 ? next : undefined
      // Short-circuit: if the entry is already structurally identical
      // (same content hash) — or already absent — leave the map
      // untouched so React skips the re-render that would otherwise
      // re-trigger every consumer's effect.
      if (!desired && !existing) return current
      if (
        desired &&
        existing &&
        existing.length === desired.length &&
        serializeSegments(existing) === serializeSegments(desired)
      ) {
        return current
      }
      const merged = new Map(current)
      if (desired) merged.set(id, desired)
      else merged.delete(id)
      return merged
    })
  }, [])
  const context = useMemo<AdminBreadcrumbsContextValue>(
    () => ({ segments, setSegments }),
    [segments, setSegments],
  )

  return (
    <AdminBreadcrumbsContext.Provider value={context}>{children}</AdminBreadcrumbsContext.Provider>
  )
}

function serializeSegments(segments: ReadonlyArray<AdminBreadcrumbSegment>): string {
  let out = ""
  for (const s of segments) {
    out += `${s.label}|${s.href ?? ""}\n`
  }
  return out
}

export function useAdminBreadcrumbs(segments: ReadonlyArray<AdminBreadcrumbSegment>) {
  const context = useContext(AdminBreadcrumbsContext)
  const id = useId()
  // Hold the latest segments in a ref so the effect can read them without
  // depending on array identity — callers can pass a fresh array each render.
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  const key = serializeSegments(segments)
  // Hold the context in a ref too so we don't have to put it in the
  // effect's deps. The provider's `setSegments` is stable, but `context`
  // itself re-allocates when `segments` (a different field on the same
  // context) changes — which would otherwise re-fire this effect on
  // every push from any consumer and cascade into an infinite loop.
  const contextRef = useRef(context)
  contextRef.current = context

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional content gate via `key`; context read via ref so it doesn't re-fire the effect
  useEffect(() => {
    const ctx = contextRef.current
    if (!ctx) return
    const snapshot = segmentsRef.current.map((s) => ({ label: s.label, href: s.href }))
    ctx.setSegments(id, snapshot)
    return () => ctx.setSegments(id, null)
  }, [id, key])
}

export function useAdminBreadcrumbsValue(): ReadonlyArray<AdminBreadcrumbSegment> {
  return useContext(AdminBreadcrumbsContext)?.segments ?? []
}

export interface AdminBreadcrumbsTrailProps {
  linkComponent?: AdminNavLinkComponent
  segments: ReadonlyArray<AdminBreadcrumbSegment>
}

export function AdminBreadcrumbsTrail({
  linkComponent: LinkComponent = DefaultAdminNavLink,
  segments,
}: AdminBreadcrumbsTrailProps) {
  if (segments.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
            <Fragment key={`${index}-${segment.label}`}>
              <BreadcrumbItem>
                {isLast || !segment.href ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={
                      <LinkComponent href={segment.href} target="_self">
                        {segment.label}
                      </LinkComponent>
                    }
                  />
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
