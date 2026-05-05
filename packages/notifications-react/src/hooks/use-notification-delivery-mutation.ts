"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantNotificationsContext } from "../provider.js"
import { notificationsQueryKeys } from "../query-keys.js"
import { notificationDeliverySingleResponse } from "../schemas.js"

export function useNotificationDeliveryMutation() {
  const { baseUrl, fetcher } = useVoyantNotificationsContext()
  const queryClient = useQueryClient()

  const resend = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/notifications/deliveries/${deliveryId}/resend`,
        notificationDeliverySingleResponse,
        { baseUrl, fetcher },
        { method: "POST" },
      )
      return data
    },
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.deliveries() })
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.delivery(delivery.id) })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.deliveries() })
    },
  })

  return { resend }
}
