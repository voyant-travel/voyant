"use client"

import type { ComponentType } from "react"
import { Fragment } from "react"

import { type AdminExtension, type AdminWidgetSlot, resolveAdminWidgets } from "../extensions.js"
import { useAdminExtensions } from "../providers/admin-extensions.js"

export interface AdminWidgetSlotRendererProps {
  extensions?: ReadonlyArray<AdminExtension>
  props?: Record<string, unknown>
  slot: AdminWidgetSlot
}

export function AdminWidgetSlotRenderer({
  extensions,
  props = {},
  slot,
}: AdminWidgetSlotRendererProps) {
  const contextExtensions = useAdminExtensions()
  const widgets = resolveAdminWidgets({
    slot,
    extensions: extensions ?? contextExtensions,
  })

  if (widgets.length === 0) {
    return null
  }

  return (
    <>
      {widgets.map((widget) => {
        const Component = widget.component as ComponentType<Record<string, unknown>>

        return (
          <Fragment key={widget.id}>
            <Component {...props} />
          </Fragment>
        )
      })}
    </>
  )
}
