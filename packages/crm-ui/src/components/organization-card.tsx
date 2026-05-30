"use client"

import type { OrganizationRecord } from "@voyantjs/crm-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Card, CardContent, CardHeader } from "@voyantjs/ui/components/card"
import { cn } from "@voyantjs/ui/lib/utils"
import { Building2, Globe } from "lucide-react"
import type * as React from "react"

import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { CrmRelationType } from "../i18n/messages.js"

export interface OrganizationCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  organization: OrganizationRecord
}

export function OrganizationCard({ organization, className, ...props }: OrganizationCardProps) {
  const messages = useCrmUiMessagesOrDefault()
  return (
    <Card data-slot="organization-card" className={cn("overflow-hidden", className)} {...props}>
      <CardHeader className="flex flex-row items-center gap-3">
        <div
          data-slot="organization-card-icon"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <Building2 className="size-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{organization.name}</div>
          {organization.industry || organization.taxId ? (
            <div className="text-sm text-muted-foreground truncate">
              {[organization.industry, organization.taxId].filter(Boolean).join(" - ")}
            </div>
          ) : null}
        </div>
        {organization.relation ? (
          <Badge variant="secondary" className="capitalize">
            {messages.common.relationTypeLabels[organization.relation as CrmRelationType] ??
              organization.relation}
          </Badge>
        ) : null}
      </CardHeader>
      {organization.website ? (
        <CardContent className="text-sm">
          <a
            href={organization.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Globe className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{organization.website}</span>
          </a>
        </CardContent>
      ) : null}
    </Card>
  )
}
