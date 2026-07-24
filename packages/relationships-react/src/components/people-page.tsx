"use client"

import { cn } from "@voyant-travel/ui/components"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { PersonRecord } from "../index.js"
import { PersonList } from "./person-list.js"

export type PeoplePageProps = {
  pageSize?: number
  onPersonOpen?: (person: PersonRecord) => void
  className?: string
}

export function PeoplePage({ pageSize, onPersonOpen, className }: PeoplePageProps = {}) {
  const messages = useCrmUiMessagesOrDefault().peoplePage

  return (
    <div data-slot="people-page" className={cn("flex flex-col gap-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <PersonList pageSize={pageSize} onSelectPerson={onPersonOpen} />
    </div>
  )
}
