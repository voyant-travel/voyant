"use client"

import {
  notificationLiquidSnippets,
  notificationTemplateVariableCatalog,
} from "@voyant-travel/notifications"

export function useNotificationTemplateAuthoring() {
  return {
    variableCatalog: notificationTemplateVariableCatalog,
    liquidSnippets: notificationLiquidSnippets,
  }
}
