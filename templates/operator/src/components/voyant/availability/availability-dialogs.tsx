import {
  AvailabilityCloseoutDialog as AvailabilityCloseoutDialogBase,
  type AvailabilityCloseoutSubmitPayload,
  AvailabilityPickupPointDialog as AvailabilityPickupPointDialogBase,
  type AvailabilityPickupPointSubmitPayload,
  AvailabilityRuleDialog as AvailabilityRuleDialogBase,
  type AvailabilityRuleSubmitPayload,
  AvailabilitySlotDialog as AvailabilitySlotDialogBase,
  type AvailabilitySlotSubmitPayload,
  AvailabilityStartTimeDialog as AvailabilityStartTimeDialogBase,
  type AvailabilityStartTimeSubmitPayload,
  AvailabilitySectionHeader as SectionHeader,
} from "@voyantjs/availability-ui"
import { useUser } from "@/components/providers/user-provider"
import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  ProductOption,
} from "@/components/voyant/availability/availability-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"

export { SectionHeader }

export function AvailabilityRuleDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: AvailabilityRuleRow
  products: ProductOption[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()

  return (
    <AvailabilityRuleDialogBase
      {...props}
      messages={messages.availability}
      onSubmit={async (payload: AvailabilityRuleSubmitPayload, context) => {
        if (context.isEditing) {
          await api.patch(`/v1/availability/rules/${context.id}`, payload)
        } else {
          await api.post("/v1/availability/rules", payload)
        }
      }}
    />
  )
}

export function AvailabilityStartTimeDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  startTime?: AvailabilityStartTimeRow
  products: ProductOption[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()

  return (
    <AvailabilityStartTimeDialogBase
      {...props}
      messages={messages.availability}
      onSubmit={async (payload: AvailabilityStartTimeSubmitPayload, context) => {
        if (context.isEditing) {
          await api.patch(`/v1/availability/start-times/${context.id}`, payload)
        } else {
          await api.post("/v1/availability/start-times", payload)
        }
      }}
    />
  )
}

export function AvailabilitySlotDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot?: AvailabilitySlotRow
  products: ProductOption[]
  rules: AvailabilityRuleRow[]
  startTimes: AvailabilityStartTimeRow[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()

  return (
    <AvailabilitySlotDialogBase
      {...props}
      messages={messages.availability}
      onSubmit={async (payload: AvailabilitySlotSubmitPayload, context) => {
        if (context.isEditing) {
          await api.patch(`/v1/availability/slots/${context.id}`, payload)
        } else {
          await api.post("/v1/availability/slots", payload)
        }
      }}
    />
  )
}

export function AvailabilityCloseoutDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  closeout?: AvailabilityCloseoutRow
  products: ProductOption[]
  slots: AvailabilitySlotRow[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const { user } = useUser()

  return (
    <AvailabilityCloseoutDialogBase
      {...props}
      messages={messages.availability}
      onSubmit={async (payload: AvailabilityCloseoutSubmitPayload, context) => {
        const payloadWithUser = {
          ...payload,
          createdBy: user?.email ?? null,
        }

        if (context.isEditing) {
          await api.patch(`/v1/availability/closeouts/${context.id}`, payloadWithUser)
        } else {
          await api.post("/v1/availability/closeouts", payloadWithUser)
        }
      }}
    />
  )
}

export function AvailabilityPickupPointDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pickupPoint?: AvailabilityPickupPointRow
  products: ProductOption[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()

  return (
    <AvailabilityPickupPointDialogBase
      {...props}
      messages={messages.availability}
      onSubmit={async (payload: AvailabilityPickupPointSubmitPayload, context) => {
        if (context.isEditing) {
          await api.patch(`/v1/availability/pickup-points/${context.id}`, payload)
        } else {
          await api.post("/v1/availability/pickup-points", payload)
        }
      }}
    />
  )
}
