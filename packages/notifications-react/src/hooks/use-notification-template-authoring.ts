"use client"

import {
  notificationLiquidSnippets,
  notificationTemplateVariableCatalog,
} from "@voyant-travel/notifications/template-authoring"

export function useNotificationTemplateAuthoring() {
  return {
    variableCatalog: notificationTemplateVariableCatalog,
    liquidSnippets: notificationLiquidSnippets,
  }
}
