"use client"

import { usePerson } from "@voyantjs/crm-react"
import { Card, CardContent } from "@voyantjs/ui/components/card"
import { Loader2 } from "lucide-react"

import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import { PersonCard, type PersonCardProps } from "./person-card.js"

export interface PersonCardConnectedProps extends Omit<PersonCardProps, "person"> {
  personId: string
}

/**
 * Fetches a person by id and renders `<PersonCard />`. Use this when you
 * already have the id but not the full record.
 */
export function PersonCardConnected({ personId, ...props }: PersonCardConnectedProps) {
  const { data, isPending, isError, error } = usePerson(personId)
  const messages = useCrmUiMessagesOrDefault()

  if (isPending) {
    return (
      <Card data-slot="person-card-connected-loading">
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        </CardContent>
      </Card>
    )
  }

  if (isError || !data) {
    return (
      <Card data-slot="person-card-connected-error">
        <CardContent className="p-6 text-sm text-destructive">
          {messages.personCardConnected.loadFailed}{" "}
          {error instanceof Error ? error.message : messages.common.unknownError}
        </CardContent>
      </Card>
    )
  }

  return <PersonCard person={data} {...props} />
}
