"use client"

import type {
  NotificationLiquidSnippet,
  NotificationTemplateVariableCategory,
  NotificationTemplateVariableDefinition,
} from "@voyantjs/notifications"

import {
  ContractTemplateAuthoringHelp,
  type TemplateAuthoringSnippet,
  type TemplateAuthoringVariable,
  type TemplateAuthoringVariableGroup,
} from "@voyantjs/ui/components/contract-template-authoring-help"

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
  return (
    <ContractTemplateAuthoringHelp
      className={className}
      title={messages?.title ?? "Notification variables"}
      description={
        messages?.description ??
        "Notifications render with Liquid. Use variables for subject/body content and control tags for conditionals or loops."
      }
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
