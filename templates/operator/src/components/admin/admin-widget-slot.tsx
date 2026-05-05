import {
  type AdminWidgetSlot,
  AdminWidgetSlotRenderer as SharedAdminWidgetSlotRenderer,
} from "@voyantjs/admin"
import { adminExtensions } from "@/lib/admin-extensions"

type AdminWidgetSlotProps = {
  slot: AdminWidgetSlot
  props?: Record<string, unknown>
}

export function AdminWidgetSlotRenderer({ slot, props = {} }: AdminWidgetSlotProps) {
  return <SharedAdminWidgetSlotRenderer extensions={adminExtensions} props={props} slot={slot} />
}
