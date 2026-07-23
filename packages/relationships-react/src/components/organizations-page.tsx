"use client"

import { cn } from "@voyant-travel/ui/components"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { OrganizationRecord } from "../index.js"
import { OrganizationList } from "./organization-list.js"

export type OrganizationsPageProps = {
  pageSize?: number
  onOrganizationOpen?: (organization: OrganizationRecord) => void
  className?: string
}

export function OrganizationsPage({
  pageSize,
  onOrganizationOpen,
  className,
}: OrganizationsPageProps = {}) {
  const messages = useCrmUiMessagesOrDefault().organizationsPage

  return (
    <div data-slot="organizations-page" className={cn("flex flex-col gap-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <OrganizationList pageSize={pageSize} onSelectOrganization={onOrganizationOpen} />
    </div>
  )
}
