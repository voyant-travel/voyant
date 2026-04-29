import { type AdminWidgetSlot, resolveAdminWidgets } from "@voyantjs/admin"
import type { ComponentType } from "react"
import { Fragment } from "react"
import { adminExtensions } from "@/lib/admin-extensions"

type AdminWidgetSlotProps = {
  slot: AdminWidgetSlot
  props?: Record<string, unknown>
}

export function AdminWidgetSlotRenderer({ slot, props = {} }: AdminWidgetSlotProps) {
  const widgets = resolveAdminWidgets({
    slot,
    extensions: adminExtensions,
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
