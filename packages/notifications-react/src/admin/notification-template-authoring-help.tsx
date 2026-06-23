"use client"

import type {
  NotificationLiquidSnippet,
  NotificationTemplateVariableCategory,
  NotificationTemplateVariableDefinition,
} from "@voyant-travel/notifications/template-authoring"

import {
  ContractTemplateAuthoringHelp,
  type TemplateAuthoringSnippet,
  type TemplateAuthoringVariable,
  type TemplateAuthoringVariableGroup,
} from "@voyant-travel/ui/components/contract-template-authoring-help"

import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"

type NotificationTemplateAuthoringHelpProps = {
  variableGroups: NotificationTemplateVariableCategory[]
  snippets?: NotificationLiquidSnippet[]
  onInsertVariable?: (variable: NotificationTemplateVariableDefinition) => void
  onInsertSnippet?: (snippet: NotificationLiquidSnippet) => void
  className?: string
  messages?: {
    title?: string
    description?: string
    tabs?: {
      variables?: string
      liquid?: string
    }
    searchPlaceholder?: string
    noVariables?: string
    example?: string
    insert?: string
    liquidUsage?: string
    noLiquidSnippets?: string
  }
}

export function NotificationTemplateAuthoringHelp({
  variableGroups,
  snippets = [],
  onInsertVariable,
  onInsertSnippet,
  className,
  messages,
}: NotificationTemplateAuthoringHelpProps) {
  const defaults = useNotificationsUiMessagesOrDefault().admin.authoringHelp

  return (
    <ContractTemplateAuthoringHelp
      className={className}
      title={messages?.title ?? defaults.title}
      description={messages?.description ?? defaults.description}
      messages={messages}
      variableGroups={variableGroups as TemplateAuthoringVariableGroup[]}
      snippets={snippets as TemplateAuthoringSnippet[]}
      onInsertVariable={
        onInsertVariable as ((variable: TemplateAuthoringVariable) => void) | undefined
      }
      onInsertSnippet={onInsertSnippet as ((snippet: TemplateAuthoringSnippet) => void) | undefined}
    />
  )
}
