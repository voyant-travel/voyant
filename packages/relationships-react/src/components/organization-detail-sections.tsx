"use client"

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionButton,
} from "@voyant-travel/ui/components"
import {
  ArrowLeft,
  Building,
  Calendar,
  CircleDot,
  GitMerge,
  Globe,
  Hash,
  Languages,
  Receipt,
  Tag,
  Users,
} from "lucide-react"
import type { ReactNode } from "react"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { UpdateOrganizationInput } from "../index.js"
import { InlineCurrencyField } from "./inline-currency-field.js"
import { InlineField } from "./inline-field.js"
import { InlineLanguageField } from "./inline-language-field.js"
import { InlineNumberField } from "./inline-number-field.js"
import { InlineSelectField } from "./inline-select-field.js"
import type { OrganizationData } from "./organization-detail-types.js"
import { initialsFrom } from "./organization-detail-types.js"
import { TagsEditor } from "./tags-editor.js"

export type {
  OrganizationActivity,
  OrganizationCommercialContextTabSlot,
  OrganizationData,
  OrganizationDetailPageSlots,
  OrganizationDetailTab,
  OrganizationPerson,
} from "./organization-detail-types.js"

export interface OrganizationTopBarProps {
  orgName: string
  onBack: () => void
  onMerge?: () => void
  onDelete: () => Promise<void>
  deletePending: boolean
}

export function OrganizationTopBar({
  orgName,
  onBack,
  onMerge,
  onDelete,
  deletePending,
}: OrganizationTopBarProps) {
  const messages = useCrmUiMessagesOrDefault()

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          {messages.organizationDetail.topBar.organizations}
        </button>
        <span>/</span>
        <span className="text-foreground">{orgName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {onMerge ? (
          <Button variant="outline" size="sm" onClick={onMerge}>
            <GitMerge className="size-4" aria-hidden="true" />
            {messages.organizationDetail.topBar.merge}
          </Button>
        ) : null}
        <ConfirmActionButton
          buttonLabel={messages.organizationDetail.topBar.delete}
          confirmLabel={messages.organizationDetail.topBar.delete}
          title={messages.organizationDetail.topBar.deleteTitle}
          description={messages.organizationDetail.topBar.deleteDescription}
          variant="destructive"
          confirmVariant="destructive"
          disabled={deletePending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  )
}

export interface OrganizationSidebarProps {
  org: OrganizationData
  websiteHref?: string
  onUpdateField: (patch: UpdateOrganizationInput) => Promise<void>
  children?: ReactNode
}

export function OrganizationSidebar({
  org,
  websiteHref,
  onUpdateField,
  children,
}: OrganizationSidebarProps) {
  const messages = useCrmUiMessagesOrDefault()
  const relationOptions = [
    { value: "client", label: messages.common.relationTypeLabels.client },
    { value: "partner", label: messages.common.relationTypeLabels.partner },
    { value: "supplier", label: messages.common.relationTypeLabels.supplier },
    { value: "other", label: messages.common.relationTypeLabels.other },
  ]
  const statusOptions = [
    { value: "active", label: messages.common.recordStatusLabels.active },
    { value: "inactive", label: messages.common.recordStatusLabels.inactive },
    { value: "archived", label: messages.common.recordStatusLabels.archived },
  ]

  return (
    <aside className="col-span-12 flex flex-col gap-4 lg:col-span-3">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-xl">{initialsFrom(org.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-tight">{org.name}</h2>
            {org.legalName && <p className="text-sm text-muted-foreground">{org.legalName}</p>}
            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {org.website}
              </a>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {org.relation && (
              <Badge variant="secondary">
                {messages.common.relationTypeLabels[
                  org.relation as keyof typeof messages.common.relationTypeLabels
                ] ?? org.relation}
              </Badge>
            )}
            <Badge variant="outline">
              {messages.common.recordStatusLabels[
                org.status as keyof typeof messages.common.recordStatusLabels
              ] ?? org.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {messages.organizationDetail.sidebar.about}
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <InlineField
            icon={Building}
            label={messages.organizationDetail.sidebar.fields.name}
            value={org.name}
            onSave={(next) => onUpdateField({ name: next ?? org.name })}
          />
          <InlineField
            icon={Building}
            label={messages.organizationDetail.sidebar.fields.legalName}
            value={org.legalName}
            onSave={(next) => onUpdateField({ legalName: next })}
          />
          <InlineField
            icon={Receipt}
            label={messages.organizationDetail.sidebar.fields.taxId}
            value={org.taxId}
            onSave={(next) => onUpdateField({ taxId: next })}
          />
          <InlineField
            icon={Globe}
            label={messages.organizationDetail.sidebar.fields.website}
            kind="url"
            value={org.website}
            onSave={(next) => onUpdateField({ website: next })}
          />
          <InlineField
            icon={Hash}
            label={messages.organizationDetail.sidebar.fields.industry}
            value={org.industry}
            onSave={(next) => onUpdateField({ industry: next })}
          />
          <InlineSelectField
            icon={Users}
            label={messages.organizationDetail.sidebar.fields.relation}
            value={org.relation}
            options={relationOptions}
            onSave={(next) => onUpdateField({ relation: next })}
          />
          <InlineSelectField
            icon={CircleDot}
            label={messages.organizationDetail.sidebar.fields.status}
            value={org.status}
            options={statusOptions}
            allowClear={false}
            onSave={(next) => onUpdateField({ status: next ?? "active" })}
          />
          <InlineCurrencyField
            label={messages.organizationDetail.sidebar.fields.defaultCurrency}
            value={org.defaultCurrency}
            onSave={(next) => onUpdateField({ defaultCurrency: next })}
          />
          <InlineLanguageField
            icon={Languages}
            label={messages.organizationDetail.sidebar.fields.preferredLanguage}
            value={org.preferredLanguage}
            onSave={(next) => onUpdateField({ preferredLanguage: next })}
          />
          <InlineNumberField
            icon={Calendar}
            label={messages.organizationDetail.sidebar.fields.paymentTerms}
            value={org.paymentTerms}
            min={0}
            max={365}
            onSave={(next) => onUpdateField({ paymentTerms: next })}
          />
          <InlineField
            icon={Tag}
            label={messages.organizationDetail.sidebar.fields.source}
            value={org.source}
            onSave={(next) => onUpdateField({ source: next })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {messages.organizationDetail.sidebar.tags}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TagsEditor tags={org.tags} onChange={(tags) => onUpdateField({ tags })} />
        </CardContent>
      </Card>

      {children}
    </aside>
  )
}

export type { OrganizationMainProps } from "./organization-detail-main.js"
export { OrganizationMain } from "./organization-detail-main.js"

export { initialsFrom } from "./organization-detail-types.js"
