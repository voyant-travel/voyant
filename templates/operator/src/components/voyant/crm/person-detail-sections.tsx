import { type OrganizationRecord, useOrganizations } from "@voyantjs/crm-react"
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@voyantjs/ui/components/alert-dialog"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Separator } from "@voyantjs/ui/components/separator"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { cn } from "@voyantjs/ui/lib/utils"
import { currencies } from "@voyantjs/utils/currencies"
import { languages } from "@voyantjs/utils/languages"
import { formatMessage, useLocale } from "@voyantjs/voyant-admin"
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CircleDot,
  Clock,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  TrendingUp,
  User as UserIcon,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { PhoneInput } from "@/components/ui/phone-input"
import { useAdminMessages } from "@/lib/admin-i18n"
import {
  type AddressRecord,
  type AddressUpsertInput,
  formatAddressText,
  PersonAddressesSection,
} from "./person-addresses"

export const ACTIVITY_TYPES = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "task", label: "Task" },
  { value: "follow_up", label: "Follow-up" },
] as const

export type PersonNote = {
  id: string
  personId: string
  authorId: string
  content: string
  createdAt: string
}

export type ActivityRecord = {
  id: string
  subject: string
  type: "call" | "email" | "meeting" | "task" | "follow_up" | "note"
  status: "planned" | "done" | "cancelled"
  ownerId: string | null
  dueAt: string | null
  completedAt: string | null
  location: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export type OpportunityRecord = {
  id: string
  title: string
  status: "open" | "won" | "lost" | "archived"
  valueAmountCents: number | null
  valueCurrency: string | null
  expectedCloseDate: string | null
  stageId: string
  pipelineId: string
  tags: string[]
  createdAt: string
}

export type ListEnvelope<T> = { data: T[]; total: number; limit: number; offset: number }

export function initialsFrom(firstName: string | null, lastName: string | null): string {
  const f = firstName?.[0] ?? ""
  const l = lastName?.[0] ?? ""
  return (f + l).toUpperCase() || "?"
}

export function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatRelative(value: string): string {
  const d = new Date(value)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days < 1) return "today"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function formatMoney(cents: number | null, currency: string | null): string {
  if (cents == null) return "—"
  const amount = cents / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency ?? "USD",
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ""}`
  }
}

function formatPersonDate(value: string | null | undefined, locale: string): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatPersonRelative(
  value: string,
  messages: ReturnType<typeof useAdminMessages>["crm"]["personDetail"],
): string {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days < 1) return messages.relativeToday
  if (days < 7) return formatMessage(messages.relativeDaysAgo, { count: String(days) })
  if (days < 30) {
    return formatMessage(messages.relativeWeeksAgo, {
      count: String(Math.floor(days / 7)),
    })
  }
  if (days < 365) {
    return formatMessage(messages.relativeMonthsAgo, {
      count: String(Math.floor(days / 30)),
    })
  }
  return formatMessage(messages.relativeYearsAgo, {
    count: String(Math.floor(days / 365)),
  })
}

function personRelationLabel(
  relation: string,
  messages: ReturnType<typeof useAdminMessages>["crm"]["personDetail"],
): string {
  switch (relation) {
    case "client":
      return messages.relationClient
    case "partner":
      return messages.relationPartner
    case "supplier":
      return messages.relationSupplier
    case "other":
      return messages.relationOther
    default:
      return relation
  }
}

function personStatusLabel(
  status: string,
  messages: ReturnType<typeof useAdminMessages>["crm"]["personDetail"],
): string {
  switch (status) {
    case "active":
      return messages.statusActive
    case "inactive":
      return messages.statusInactive
    case "archived":
      return messages.statusArchived
    default:
      return status
  }
}

function personActivityTypeLabel(
  type: ActivityRecord["type"],
  messages: ReturnType<typeof useAdminMessages>["crm"]["personDetail"],
): string {
  switch (type) {
    case "note":
      return messages.activityTypeNote
    case "call":
      return messages.activityTypeCall
    case "email":
      return messages.activityTypeEmail
    case "meeting":
      return messages.activityTypeMeeting
    case "task":
      return messages.activityTypeTask
    case "follow_up":
      return messages.activityTypeFollowUp
    default:
      return type
  }
}

function personActivityStatusLabel(
  status: ActivityRecord["status"],
  messages: ReturnType<typeof useAdminMessages>["crm"]["personDetail"],
): string {
  switch (status) {
    case "planned":
      return messages.activityStatusPlanned
    case "done":
      return messages.activityStatusDone
    case "cancelled":
      return messages.activityStatusCancelled
    default:
      return status
  }
}

function opportunityStatusLabel(
  status: OpportunityRecord["status"],
  messages: ReturnType<typeof useAdminMessages>["crm"]["organizationDetail"],
): string {
  switch (status) {
    case "open":
      return messages.opportunityOpen
    case "won":
      return messages.opportunityWon
    case "lost":
      return messages.opportunityLost
    case "archived":
      return messages.opportunityArchived
    default:
      return status
  }
}

function getActivityTypeOptions(
  messages: ReturnType<typeof useAdminMessages>["crm"]["personDetail"],
) {
  return [
    { value: "note", label: messages.activityTypeNote },
    { value: "call", label: messages.activityTypeCall },
    { value: "email", label: messages.activityTypeEmail },
    { value: "meeting", label: messages.activityTypeMeeting },
    { value: "task", label: messages.activityTypeTask },
    { value: "follow_up", label: messages.activityTypeFollowUp },
  ] as const
}

function FieldRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  href?: string
}) {
  const content = value || <span className="text-muted-foreground">—</span>
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="truncate text-sm">
          {href && value ? (
            <a
              href={href}
              className="text-primary hover:underline"
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer" : undefined}
            >
              {content}
            </a>
          ) : (
            content
          )}
        </div>
      </div>
    </div>
  )
}

type InlineFieldKind = "text" | "email" | "url" | "date" | "phone"

function InlineField({
  icon: Icon,
  label,
  value,
  kind = "text",
  href,
  placeholder,
  disabled,
  onSave,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null
  kind?: InlineFieldKind
  href?: string
  placeholder?: string
  disabled?: boolean
  onSave: (next: string | null) => Promise<void>
}) {
  const adminMessages = useAdminMessages()
  const messages = adminMessages.crm.personDetail
  const shared = adminMessages.crm.shared
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    if (disabled) return
    setDraft(value ?? "")
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setDraft(value ?? "")
    setError(null)
    setEditing(false)
  }

  const commit = async () => {
    const trimmed = draft.trim()
    const next = trimmed === "" ? null : trimmed
    if (next === (value ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : shared.failedToSave)
    } finally {
      setSaving(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      void commit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancel()
    }
  }

  const displayValue = value?.trim() || null

  if (kind === "date") {
    const handleDateChange = async (next: string | null) => {
      if (next === (value ?? null)) return
      setSaving(true)
      setError(null)
      try {
        await onSave(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : shared.failedToSave)
      } finally {
        setSaving(false)
      }
    }
    return (
      <div className="group flex items-start gap-3 py-1.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <DatePicker
            value={value}
            onChange={(next) => void handleDateChange(next)}
            placeholder={formatMessage(shared.addTemplate, { label: label.toLowerCase() })}
            displayFormat="PP"
            className="-mx-1 mt-0.5 h-7 border-0 bg-transparent px-1 text-sm font-normal shadow-none hover:bg-muted/60 data-[empty=true]:italic"
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-3 py-1.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {editing ? (
          <div className="mt-0.5 flex flex-col gap-1">
            {kind === "phone" ? (
              <PhoneInput
                international
                autoFocus
                value={draft || undefined}
                onChange={(v) => setDraft(v ?? "")}
                onKeyDown={handleKey}
                disabled={saving}
              />
            ) : (
              <Input
                autoFocus
                type={kind === "email" ? "email" : kind === "url" ? "url" : "text"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKey}
                onBlur={() => void commit()}
                placeholder={placeholder}
                disabled={saving}
                className="h-8 text-sm"
              />
            )}
            {kind === "phone" && (
              <div className="flex gap-2">
                <Button size="sm" className="h-7" onClick={() => void commit()} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : messages.save}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={cancel}
                  disabled={saving}
                >
                  {messages.cancel}
                </Button>
              </div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={disabled}
            className={cn(
              "-mx-1 w-full truncate rounded px-1 py-0.5 text-left text-sm transition-colors",
              !disabled && "hover:bg-muted/60 cursor-text",
              !displayValue && "text-muted-foreground italic",
            )}
          >
            {href && displayValue ? (
              <span className="text-primary">{displayValue}</span>
            ) : (
              displayValue || formatMessage(shared.addTemplate, { label: label.toLowerCase() })
            )}
          </button>
        )}
      </div>
    </div>
  )
}

const CURRENCY_CODES = Object.keys(currencies).sort()

function InlineCurrencyField({
  icon: Icon,
  label,
  value,
  disabled,
  onSave,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null
  disabled?: boolean
  onSave: (next: string | null) => Promise<void>
}) {
  const adminMessages = useAdminMessages()
  const shared = adminMessages.crm.shared
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    if (disabled || saving) return
    setError(null)
    setEditing(true)
  }

  const commitSelection = async (next: string | null) => {
    if (next === (value ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : shared.failedToSave)
    } finally {
      setSaving(false)
    }
  }

  const displayValue = value?.trim() || null
  const currencyInfo = displayValue ? currencies[displayValue as keyof typeof currencies] : null

  return (
    <div className="group flex items-start gap-3 py-1.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {editing ? (
          <Combobox
            items={CURRENCY_CODES}
            defaultOpen
            autoHighlight
            filter={(code, query) => {
              const c = currencies[code as keyof typeof currencies]
              if (!c) return false
              const q = query.toLowerCase()
              return (
                c.code.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                c.symbol.toLowerCase().includes(q)
              )
            }}
            onValueChange={(v) => void commitSelection((v as string | null) ?? null)}
            onOpenChange={(open) => {
              if (!open) setEditing(false)
            }}
          >
            <ComboboxInput
              autoFocus
              placeholder={shared.searchCurrencyPlaceholder}
              className="mt-0.5 h-8 text-sm"
              disabled={saving}
            />
            <ComboboxContent>
              <ComboboxEmpty>{shared.noCurrenciesFound}</ComboboxEmpty>
              <ComboboxList>
                <ComboboxCollection>
                  {(code: string) => {
                    const c = currencies[code as keyof typeof currencies]
                    return (
                      <ComboboxItem key={code} value={code}>
                        <span className="min-w-10 font-mono text-xs text-muted-foreground">
                          {code}
                        </span>
                        <span className="truncate">{c?.name ?? code}</span>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={disabled}
            className={cn(
              "-mx-1 w-full truncate rounded px-1 py-0.5 text-left text-sm transition-colors",
              !disabled && "hover:bg-muted/60 cursor-text",
              !displayValue && "text-muted-foreground italic",
            )}
          >
            {displayValue ? (
              <span>
                <span className="font-mono">{displayValue}</span>
                {currencyInfo && (
                  <span className="ml-2 text-muted-foreground">{currencyInfo.name}</span>
                )}
              </span>
            ) : (
              formatMessage(shared.addTemplate, { label: label.toLowerCase() })
            )}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

const LANGUAGE_CODES = Object.keys(languages).sort()

function InlineLanguageField({
  icon: Icon,
  label,
  value,
  disabled,
  onSave,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null
  disabled?: boolean
  onSave: (next: string | null) => Promise<void>
}) {
  const adminMessages = useAdminMessages()
  const shared = adminMessages.crm.shared
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    if (disabled || saving) return
    setError(null)
    setEditing(true)
  }

  const commitSelection = async (next: string | null) => {
    if (next === (value ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : shared.failedToSave)
    } finally {
      setSaving(false)
    }
  }

  const displayValue = value?.trim() || null
  const languageName = displayValue
    ? (languages[displayValue as keyof typeof languages] ?? null)
    : null

  return (
    <div className="group flex items-start gap-3 py-1.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {editing ? (
          <Combobox
            items={LANGUAGE_CODES}
            defaultOpen
            autoHighlight
            filter={(item, query) => {
              const code = item as string
              const name = languages[code as keyof typeof languages]
              if (!name) return false
              const q = query.toLowerCase()
              return code.toLowerCase().includes(q) || name.toLowerCase().includes(q)
            }}
            onValueChange={(v) => void commitSelection((v as string | null) ?? null)}
            onOpenChange={(open) => {
              if (!open) setEditing(false)
            }}
          >
            <ComboboxInput
              autoFocus
              placeholder={shared.searchLanguagePlaceholder}
              className="mt-0.5 h-8 text-sm"
              disabled={saving}
            />
            <ComboboxContent>
              <ComboboxEmpty>{shared.noLanguagesFound}</ComboboxEmpty>
              <ComboboxList>
                <ComboboxCollection>
                  {(code: string) => {
                    const name = languages[code as keyof typeof languages]
                    return (
                      <ComboboxItem key={code} value={code}>
                        <span className="min-w-10 font-mono text-xs text-muted-foreground">
                          {code}
                        </span>
                        <span className="truncate">{name ?? code}</span>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={disabled}
            className={cn(
              "-mx-1 w-full truncate rounded px-1 py-0.5 text-left text-sm transition-colors",
              !disabled && "hover:bg-muted/60 cursor-text",
              !displayValue && "text-muted-foreground italic",
            )}
          >
            {displayValue ? (
              <span>
                <span className="font-mono">{displayValue}</span>
                {languageName && <span className="ml-2 text-muted-foreground">{languageName}</span>}
              </span>
            ) : (
              formatMessage(shared.addTemplate, { label: label.toLowerCase() })
            )}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

function InlineOrganizationField({
  icon: Icon,
  label,
  organizationId,
  organization,
  disabled,
  onSave,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  organizationId: string | null
  organization:
    | {
        id: string
        name: string
        website: string | null
        legalName: string | null
        industry?: string | null
        relation?: string | null
        status?: string
      }
    | null
    | undefined
  disabled?: boolean
  onSave: (next: string | null) => Promise<void>
}) {
  const adminMessages = useAdminMessages()
  const shared = adminMessages.crm.shared
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const organizationsQuery = useOrganizations({
    search: search || undefined,
    limit: 25,
    enabled: editing,
  })

  const options = useMemo(() => {
    const map = new Map<string, Pick<OrganizationRecord, "id" | "name" | "website" | "legalName">>()
    for (const item of organizationsQuery.data?.data ?? []) {
      map.set(item.id, item)
    }
    if (organization) {
      map.set(organization.id, {
        id: organization.id,
        name: organization.name,
        website: organization.website,
        legalName: organization.legalName,
      })
    }
    return Array.from(map.values())
  }, [organization, organizationsQuery.data?.data])

  const optionMap = useMemo(() => new Map(options.map((item) => [item.id, item])), [options])

  const startEdit = () => {
    if (disabled || saving) return
    setError(null)
    setSearch("")
    setEditing(true)
  }

  const commitSelection = async (next: string | null) => {
    if (next === organizationId) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : shared.failedToSave)
    } finally {
      setSaving(false)
    }
  }

  const displayValue = organization?.name ?? null

  return (
    <div className="group flex items-start gap-3 py-1.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {editing ? (
          <Combobox
            items={["__none__", ...options.map((item) => item.id)]}
            defaultOpen
            autoHighlight
            itemToStringValue={(item) => {
              if (item === "__none__") return "No organization"
              return optionMap.get(item as string)?.name ?? ""
            }}
            onInputValueChange={(next) => {
              setSearch(next)
            }}
            onValueChange={(value) =>
              void commitSelection(value === "__none__" ? null : ((value as string | null) ?? null))
            }
            onOpenChange={(open) => {
              if (!open) setEditing(false)
            }}
          >
            <ComboboxInput
              autoFocus
              placeholder="Search organizations..."
              showClear={!!organizationId}
              className="mt-0.5 h-8 text-sm"
              disabled={saving}
            />
            <ComboboxContent>
              <ComboboxEmpty>
                {organizationsQuery.isPending
                  ? "Loading organizations..."
                  : "No organizations found."}
              </ComboboxEmpty>
              <ComboboxList>
                <ComboboxCollection>
                  {(item: string) => {
                    if (item === "__none__") {
                      return (
                        <ComboboxItem key={item} value={item}>
                          <span className="text-muted-foreground">No organization</span>
                        </ComboboxItem>
                      )
                    }
                    const option = optionMap.get(item)
                    if (!option) return null
                    return (
                      <ComboboxItem key={option.id} value={option.id}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{option.name}</span>
                          {(option.website || option.legalName) && (
                            <span className="truncate text-xs text-muted-foreground">
                              {option.website || option.legalName}
                            </span>
                          )}
                        </div>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            disabled={disabled}
            className={cn(
              "-mx-1 w-full truncate rounded px-1 py-0.5 text-left text-sm transition-colors",
              !disabled && "hover:bg-muted/60 cursor-text",
              !displayValue && "text-muted-foreground italic",
            )}
          >
            {displayValue || formatMessage(shared.addTemplate, { label: label.toLowerCase() })}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

function IconDeleteButton({
  onConfirm,
  disabled,
  title,
  description,
  ariaLabel = "Delete",
}: {
  onConfirm: () => Promise<void> | void
  disabled?: boolean
  title: string
  description: string
  ariaLabel?: string
}) {
  const messages = useAdminMessages().crm.personDetail
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const handleConfirm = async () => {
    setPending(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        disabled={disabled || pending}
        render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label={ariaLabel} />}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{messages.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {messages.deleteButton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function TagsEditor({
  tags,
  onChange,
  saving,
}: {
  tags: string[]
  onChange: (next: string[]) => Promise<void>
  saving: boolean
}) {
  const adminMessages = useAdminMessages()
  const messages = adminMessages.crm.personDetail
  const shared = adminMessages.crm.shared
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  const addTag = async () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setError(shared.tagAlreadyAdded)
      return
    }
    setError(null)
    try {
      await onChange([...tags, trimmed])
      setDraft("")
    } catch (e) {
      setError(e instanceof Error ? e.message : shared.addTagFailed)
    }
  }

  const removeTag = async (tag: string) => {
    setError(null)
    try {
      await onChange(tags.filter((t) => t !== tag))
    } catch (e) {
      setError(e instanceof Error ? e.message : shared.removeTagFailed)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      void addTag()
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      e.preventDefault()
      const last = tags[tags.length - 1]
      if (last) void removeTag(last)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="gap-1 pr-1">
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => void removeTag(tag)}
                disabled={saving}
                aria-label={formatMessage(messages.removeTagAria, { tag })}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-sm hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onKeyDown={handleKey}
        placeholder={shared.addTagPlaceholder}
        disabled={saving}
        className="h-8 text-sm"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function NoteCard({
  note,
  compact = false,
  onSave,
  onDelete,
  savingEdit,
  deleting,
}: {
  note: PersonNote
  compact?: boolean
  onSave: (content: string) => Promise<void>
  onDelete: () => Promise<void>
  savingEdit: boolean
  deleting: boolean
}) {
  const messages = useAdminMessages().crm.personDetail
  const { resolvedLocale } = useLocale()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.content)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setDraft(note.content)
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setDraft(note.content)
    setError(null)
    setEditing(false)
  }

  const commit = async () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError(messages.noteCannotBeEmpty)
      return
    }
    if (trimmed === note.content) {
      setEditing(false)
      return
    }
    setError(null)
    try {
      await onSave(trimmed)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.failedToSaveNote)
    }
  }

  return (
    <div className="group relative rounded-md border p-3">
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[80px] resize-y"
            disabled={savingEdit}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={savingEdit}>
              {messages.cancel}
            </Button>
            <Button size="sm" onClick={() => void commit()} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {messages.saving}
                </>
              ) : (
                messages.save
              )}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap pr-16 text-sm">{note.content}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {compact
              ? formatPersonRelative(note.createdAt, messages)
              : new Date(note.createdAt).toLocaleString(resolvedLocale)}
          </p>
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={startEdit}
              aria-label={messages.editNoteAria}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <IconDeleteButton
              title={messages.deleteNoteTitle}
              description={messages.deleteNoteDescription}
              disabled={deleting}
              onConfirm={onDelete}
              ariaLabel={messages.deleteNoteAria}
            />
          </div>
        </>
      )}
    </div>
  )
}

export function ActivityTimelineItem({
  activity,
  onSave,
  onDelete,
  onToggleStatus,
  savingEdit,
  deleting,
  togglingStatus,
}: {
  activity: ActivityRecord
  onSave: (patch: {
    subject: string
    type: ActivityRecord["type"]
    description: string | null
  }) => Promise<void>
  onDelete: () => Promise<void>
  onToggleStatus: () => Promise<void>
  savingEdit: boolean
  deleting: boolean
  togglingStatus: boolean
}) {
  const messages = useAdminMessages().crm.personDetail
  const { resolvedLocale } = useLocale()
  const [editing, setEditing] = useState(false)
  const [draftSubject, setDraftSubject] = useState(activity.subject)
  const [draftType, setDraftType] = useState<ActivityRecord["type"]>(activity.type)
  const [draftDescription, setDraftDescription] = useState(activity.description ?? "")
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setDraftSubject(activity.subject)
    setDraftType(activity.type)
    setDraftDescription(activity.description ?? "")
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const commit = async () => {
    const subject = draftSubject.trim()
    if (!subject) {
      setError(messages.subjectRequired)
      return
    }
    setError(null)
    try {
      await onSave({
        subject,
        type: draftType,
        description: draftDescription.trim() || null,
      })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : messages.failedToSaveActivity)
    }
  }

  const isDone = activity.status === "done"
  const activityTypeOptions = getActivityTypeOptions(messages)

  return (
    <li className="mb-4 ml-6">
      <span
        className={cn(
          "absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background",
          isDone ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        <ActivityIcon type={activity.type} />
      </span>
      {editing ? (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex gap-2">
            <Select
              value={draftType}
              onValueChange={(v) => setDraftType(v as ActivityRecord["type"])}
            >
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activityTypeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={messages.subjectPlaceholder}
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="flex-1"
              disabled={savingEdit}
            />
          </div>
          <Textarea
            placeholder={messages.descriptionOptionalPlaceholder}
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            className="min-h-[60px]"
            disabled={savingEdit}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={savingEdit}>
              {messages.cancel}
            </Button>
            <Button size="sm" onClick={() => void commit()} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {messages.saving}
                </>
              ) : (
                messages.save
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="group relative">
          <div className="flex items-center gap-2 pr-20">
            <p
              className={cn("text-sm font-medium", isDone && "text-muted-foreground line-through")}
            >
              {activity.subject}
            </p>
            <Badge variant="outline" className="capitalize text-[10px]">
              {personActivityStatusLabel(activity.status, messages)}
            </Badge>
            <Badge variant="secondary" className="capitalize text-[10px]">
              {personActivityTypeLabel(activity.type, messages)}
            </Badge>
          </div>
          {activity.description && (
            <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{new Date(activity.createdAt).toLocaleString(resolvedLocale)}</span>
            {activity.location && <span>• {activity.location}</span>}
            {activity.dueAt && (
              <span>
                •{" "}
                {formatMessage(messages.dueDatePrefix, {
                  date: formatPersonDate(activity.dueAt, resolvedLocale),
                })}
              </span>
            )}
          </div>
          <div className="absolute right-0 top-0 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {activity.status !== "cancelled" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void onToggleStatus()}
                disabled={togglingStatus}
                aria-label={isDone ? messages.markAsPlannedAria : messages.markAsDoneAria}
                title={isDone ? messages.markAsPlannedTitle : messages.markAsDoneTitle}
              >
                {togglingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isDone ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={startEdit}
              aria-label={messages.editActivityAria}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <IconDeleteButton
              title={messages.deleteActivityTitle}
              description={messages.deleteActivityDescription}
              disabled={deleting}
              onConfirm={onDelete}
              ariaLabel={messages.deleteActivityAria}
            />
          </div>
        </div>
      )}
    </li>
  )
}

function ActivityIcon({ type }: { type: ActivityRecord["type"] }) {
  const map: Record<ActivityRecord["type"], React.ComponentType<{ className?: string }>> = {
    call: Phone,
    email: Mail,
    meeting: Calendar,
    task: CheckCircle2,
    follow_up: Clock,
    note: CircleDot,
  }
  const Icon = map[type]
  return <Icon className="h-4 w-4" />
}

function StatusBadge({ status }: { status: OpportunityRecord["status"] }) {
  const messages = useAdminMessages().crm.organizationDetail
  const variants: Record<
    OpportunityRecord["status"],
    "default" | "secondary" | "outline" | "destructive"
  > = {
    open: "default",
    won: "secondary",
    lost: "destructive",
    archived: "outline",
  }
  return (
    <Badge variant={variants[status]} className="capitalize">
      {opportunityStatusLabel(status, messages)}
    </Badge>
  )
}

export function PersonTopBar({
  displayName,
  onBack,
  onEdit,
  onDelete,
  deletePending,
}: {
  displayName: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  deletePending: boolean
}) {
  const messages = useAdminMessages().crm.personDetail
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          {messages.breadcrumbRoot}
        </button>
        <span>/</span>
        <span className="text-foreground">{displayName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          {messages.editButton}
        </Button>
        <ConfirmActionButton
          buttonLabel={messages.deleteButton}
          confirmLabel={messages.deleteButton}
          title={messages.deleteConfirmTitle}
          description={messages.deleteConfirmDescription}
          variant="destructive"
          confirmVariant="destructive"
          disabled={deletePending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  )
}

export function PersonSidebar({
  person,
  displayName,
  organization,
  websiteHref,
  primaryAddress,
  updateField,
}: {
  person: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    website: string | null
    jobTitle: string | null
    birthday: string | null
    source: string | null
    preferredLanguage: string | null
    preferredCurrency: string | null
    relation: string | null
    status: string
  }
  displayName: string
  organization:
    | {
        id: string
        name: string
        legalName: string | null
        industry: string | null
        website: string | null
        relation: string | null
        status: string
      }
    | null
    | undefined
  websiteHref?: string
  primaryAddress: AddressRecord | null
  updateField: (patch: Record<string, unknown>) => Promise<void>
}) {
  const messages = useAdminMessages().crm.personDetail
  const primaryAddressText = primaryAddress ? formatAddressText(primaryAddress) : null
  return (
    <aside className="col-span-12 flex flex-col gap-4 lg:col-span-3">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-xl">
              {initialsFrom(person.firstName, person.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold leading-tight">{displayName}</h2>
            {person.jobTitle && <p className="text-sm text-muted-foreground">{person.jobTitle}</p>}
            {organization && <span className="text-sm text-primary">{organization.name}</span>}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {person.relation && (
              <Badge variant="secondary" className="capitalize">
                {personRelationLabel(person.relation, messages)}
              </Badge>
            )}
            <Badge variant="outline" className="capitalize">
              {personStatusLabel(person.status, messages)}
            </Badge>
          </div>
          <Separator className="my-2" />
          <div className="grid w-full grid-cols-4 gap-1">
            <Button
              variant="ghost"
              className="h-12 flex-col gap-0.5 px-1 text-xs"
              disabled={!person.email}
              onClick={() => {
                if (person.email) window.location.href = `mailto:${person.email}`
              }}
            >
              <Mail className="h-4 w-4" />
              <span className="text-[10px]">{messages.actionEmail}</span>
            </Button>
            <Button
              variant="ghost"
              className="h-12 flex-col gap-0.5 px-1 text-xs"
              disabled={!person.phone}
              onClick={() => {
                if (person.phone) window.location.href = `tel:${person.phone}`
              }}
            >
              <Phone className="h-4 w-4" />
              <span className="text-[10px]">{messages.actionCall}</span>
            </Button>
            <Button variant="ghost" className="h-12 flex-col gap-0.5 px-1 text-xs">
              <Calendar className="h-4 w-4" />
              <span className="text-[10px]">{messages.actionMeet}</span>
            </Button>
            <Button variant="ghost" className="h-12 flex-col gap-0.5 px-1 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[10px]">{messages.actionTask}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{messages.aboutTitle}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <InlineField
            icon={Mail}
            label={messages.emailLabel}
            kind="email"
            value={person.email}
            href={person.email ? `mailto:${person.email}` : undefined}
            onSave={(next) => updateField({ email: next })}
          />
          <InlineField
            icon={Phone}
            label={messages.phoneLabel}
            kind="phone"
            value={person.phone}
            href={person.phone ? `tel:${person.phone}` : undefined}
            onSave={(next) => updateField({ phone: next })}
          />
          <InlineField
            icon={Globe}
            label={messages.websiteLabel}
            kind="url"
            value={person.website}
            href={websiteHref}
            placeholder="https://example.com"
            onSave={(next) => updateField({ website: next })}
          />
          <FieldRow
            icon={MapPin}
            label={messages.primaryAddressLabel}
            value={primaryAddressText ?? messages.noAddressValue}
          />
          <InlineOrganizationField
            icon={Building2}
            label={messages.organizationLabel}
            organizationId={organization?.id ?? null}
            organization={organization}
            onSave={(next) => updateField({ organizationId: next })}
          />
          <InlineField
            icon={UserIcon}
            label={messages.jobTitleLabel}
            value={person.jobTitle}
            onSave={(next) => updateField({ jobTitle: next })}
          />
          <InlineField
            icon={Calendar}
            label={messages.birthdayLabel}
            kind="date"
            value={person.birthday}
            onSave={(next) => updateField({ birthday: next })}
          />
          <InlineField
            icon={Tag}
            label={messages.sourceLabel}
            value={person.source}
            onSave={(next) => updateField({ source: next })}
          />
          <InlineLanguageField
            icon={Globe}
            label={messages.preferredLanguageLabel}
            value={person.preferredLanguage}
            onSave={(next) => updateField({ preferredLanguage: next })}
          />
          <InlineCurrencyField
            icon={TrendingUp}
            label={messages.preferredCurrencyLabel}
            value={person.preferredCurrency}
            onSave={(next) => updateField({ preferredCurrency: next })}
          />
        </CardContent>
      </Card>
    </aside>
  )
}

export function PersonMain({
  activeTab,
  setActiveTab,
  notes,
  notesPending,
  activities,
  activitiesPending,
  addNoteOpenValue,
  setAddNoteOpenValue,
  addNotePending,
  onAddNote,
  onOpenActivityComposer,
  activityOpen,
  setActivityOpen,
  activityType,
  setActivityType,
  activitySubject,
  setActivitySubject,
  activityDescription,
  setActivityDescription,
  addActivityPending,
  onSubmitActivity,
  noteSavingFor,
  noteDeletingFor,
  onSaveNote,
  onDeleteNote,
  activitySavingFor,
  activityDeletingFor,
  onSaveActivity,
  onDeleteActivity,
  onToggleActivityStatus,
  addresses,
  addressesPending,
  addressCreating,
  addressUpdatingFor,
  addressDeletingFor,
  onCreateAddress,
  onUpdateAddress,
  onDeleteAddress,
  openOpportunitiesCount,
  wonOpportunitiesCount,
  totalOpenValue,
  primaryCurrency,
}: {
  activeTab: "overview" | "notes" | "activities" | "addresses"
  setActiveTab: (tab: "overview" | "notes" | "activities" | "addresses") => void
  notes: PersonNote[]
  notesPending: boolean
  activities: ActivityRecord[]
  activitiesPending: boolean
  addNoteOpenValue: string
  setAddNoteOpenValue: (value: string) => void
  addNotePending: boolean
  onAddNote: () => void
  onOpenActivityComposer: () => void
  activityOpen: boolean
  setActivityOpen: (open: boolean) => void
  activityType: ActivityRecord["type"]
  setActivityType: (value: ActivityRecord["type"]) => void
  activitySubject: string
  setActivitySubject: (value: string) => void
  activityDescription: string
  setActivityDescription: (value: string) => void
  addActivityPending: boolean
  onSubmitActivity: () => void
  noteSavingFor: string | undefined
  noteDeletingFor: string | undefined
  onSaveNote: (noteId: string, content: string) => Promise<void>
  onDeleteNote: (noteId: string) => Promise<void>
  activitySavingFor: string | undefined
  activityDeletingFor: string | undefined
  onSaveActivity: (
    activityId: string,
    patch: {
      subject: string
      type: ActivityRecord["type"]
      description: string | null
    },
  ) => Promise<void>
  onDeleteActivity: (activityId: string) => Promise<void>
  onToggleActivityStatus: (activity: ActivityRecord) => Promise<void>
  addresses: AddressRecord[]
  addressesPending: boolean
  addressCreating: boolean
  addressUpdatingFor: string | undefined
  addressDeletingFor: string | undefined
  onCreateAddress: (input: AddressUpsertInput) => Promise<void>
  onUpdateAddress: (addressId: string, input: AddressUpsertInput) => Promise<void>
  onDeleteAddress: (addressId: string) => Promise<void>
  openOpportunitiesCount: number
  wonOpportunitiesCount: number
  totalOpenValue: number
  primaryCurrency: string | null
}) {
  const messages = useAdminMessages().crm.personDetail
  const activityTypeOptions = getActivityTypeOptions(messages)

  return (
    <main className="col-span-12 flex flex-col gap-4 lg:col-span-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="overview">{messages.overviewTab}</TabsTrigger>
          <TabsTrigger value="notes">
            {messages.notesTab}
            {notes.length > 0 ? ` (${notes.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="activities">
            {messages.activitiesTab}
            {activities.length > 0 ? ` (${activities.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="addresses">
            {messages.addressesTab}
            {addresses.length > 0 ? ` (${addresses.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Card size="sm">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{messages.statOpenDeals}</p>
                <p className="text-2xl font-semibold">{openOpportunitiesCount}</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{messages.statPipelineValue}</p>
                <p className="text-2xl font-semibold">
                  {formatMoney(totalOpenValue, primaryCurrency)}
                </p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{messages.statWonDeals}</p>
                <p className="text-2xl font-semibold">{wonOpportunitiesCount}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">
                {messages.recentActivityTitle}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onOpenActivityComposer}
              >
                <Plus className="mr-1 h-3 w-3" />
                {messages.logActivity}
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {activitiesPending ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-56" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.noActivitiesLoggedYet}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {activities.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <ActivityIcon type={activity.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{activity.subject}</p>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {personActivityStatusLabel(activity.status, messages)}
                          </Badge>
                        </div>
                        {activity.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {activity.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatPersonRelative(activity.createdAt, messages)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{messages.recentNotesTitle}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {notesPending ? (
                <div className="flex flex-col gap-3">
                  {["note-skeleton-1", "note-skeleton-2", "note-skeleton-3"].map((key) => (
                    <div key={key} className="rounded-md border p-3">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="mt-2 h-3 w-3/4" />
                      <Skeleton className="mt-3 h-2.5 w-20" />
                    </div>
                  ))}
                </div>
              ) : notes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.noNotesYet}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {notes.slice(0, 3).map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      compact
                      savingEdit={noteSavingFor === note.id}
                      deleting={noteDeletingFor === note.id}
                      onSave={(content) => onSaveNote(note.id, content)}
                      onDelete={() => onDeleteNote(note.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{messages.notesTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <Textarea
                  placeholder={messages.addNotePlaceholder}
                  value={addNoteOpenValue}
                  onChange={(e) => setAddNoteOpenValue(e.target.value)}
                  className="min-h-[80px] resize-y border-0 p-0 shadow-none focus-visible:ring-0"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!addNoteOpenValue.trim() || addNotePending}
                    onClick={onAddNote}
                  >
                    {addNotePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {messages.saving}
                      </>
                    ) : (
                      messages.addNoteButton
                    )}
                  </Button>
                </div>
              </div>

              {notes.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {messages.noNotesYet}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      savingEdit={noteSavingFor === note.id}
                      deleting={noteDeletingFor === note.id}
                      onSave={(content) => onSaveNote(note.id, content)}
                      onDelete={() => onDeleteNote(note.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">
                {messages.activityTimelineTitle}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onOpenActivityComposer}
              >
                <Plus className="mr-1 h-3 w-3" />
                {messages.newActivity}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-0">
              {activityOpen && (
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  <div className="flex gap-2">
                    <Select
                      value={activityType}
                      onValueChange={(v) => setActivityType(v as ActivityRecord["type"])}
                    >
                      <SelectTrigger className="w-[140px]" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activityTypeOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={messages.subjectPlaceholder}
                      value={activitySubject}
                      onChange={(e) => setActivitySubject(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <Textarea
                    placeholder={messages.descriptionOptionalPlaceholder}
                    value={activityDescription}
                    onChange={(e) => setActivityDescription(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActivityOpen(false)
                        setActivitySubject("")
                        setActivityDescription("")
                      }}
                      disabled={addActivityPending}
                    >
                      {messages.cancel}
                    </Button>
                    <Button
                      size="sm"
                      onClick={onSubmitActivity}
                      disabled={!activitySubject.trim() || addActivityPending}
                    >
                      {addActivityPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {messages.loggingActivity}
                        </>
                      ) : (
                        messages.logActivity
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {activitiesPending ? (
                <ol className="relative ml-3 border-l">
                  {[
                    "activity-skeleton-1",
                    "activity-skeleton-2",
                    "activity-skeleton-3",
                    "activity-skeleton-4",
                  ].map((key) => (
                    <li key={key} className="mb-6 ml-4">
                      <Skeleton className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="mt-2 h-3.5 w-48" />
                      <Skeleton className="mt-1.5 h-3 w-64" />
                    </li>
                  ))}
                </ol>
              ) : activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {messages.noActivitiesLoggedYet}
                </p>
              ) : (
                <ol className="relative ml-3 border-l">
                  {activities.map((activity) => (
                    <ActivityTimelineItem
                      key={activity.id}
                      activity={activity}
                      savingEdit={activitySavingFor === activity.id}
                      deleting={activityDeletingFor === activity.id}
                      togglingStatus={activitySavingFor === activity.id}
                      onSave={(patch) => onSaveActivity(activity.id, patch)}
                      onDelete={() => onDeleteActivity(activity.id)}
                      onToggleStatus={() => onToggleActivityStatus(activity)}
                    />
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses" className="mt-4">
          <PersonAddressesSection
            addresses={addresses}
            pending={addressesPending}
            creating={addressCreating}
            updatingAddressId={addressUpdatingFor}
            deletingAddressId={addressDeletingFor}
            onCreate={onCreateAddress}
            onUpdate={onUpdateAddress}
            onDelete={onDeleteAddress}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}

export function PersonAside({
  person,
  organization,
  organizationPending,
  opportunities,
  opportunitiesPending,
  updatePending,
  updateField,
}: {
  person: {
    organizationId: string | null
    tags: string[]
  }
  organization:
    | {
        id: string
        name: string
        industry: string | null
        website: string | null
        relation: string | null
        status: string
      }
    | null
    | undefined
  organizationPending: boolean
  opportunities: OpportunityRecord[]
  opportunitiesPending: boolean
  updatePending: boolean
  updateField: (patch: Record<string, unknown>) => Promise<void>
}) {
  const messages = useAdminMessages().crm.personDetail
  const { resolvedLocale } = useLocale()
  return (
    <aside className="col-span-12 flex flex-col gap-4 lg:col-span-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">{messages.organizationTitle}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!person.organizationId ? (
            <p className="py-2 text-sm text-muted-foreground">
              {messages.noOrganizationAssociated}
            </p>
          ) : organizationPending ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-40" />
              <div className="flex gap-1">
                <Skeleton className="h-4 w-14 rounded-full" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
            </div>
          ) : organization ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{organization.name}</p>
                  {organization.industry && (
                    <p className="truncate text-xs text-muted-foreground">
                      {organization.industry}
                    </p>
                  )}
                </div>
              </div>
              {organization.website && (
                <a
                  href={
                    organization.website.startsWith("http")
                      ? organization.website
                      : `https://${organization.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs text-primary hover:underline"
                >
                  {organization.website}
                </a>
              )}
              <div className="flex flex-wrap gap-1">
                {organization.relation && (
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {personRelationLabel(organization.relation, messages)}
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize text-[10px]">
                  {personStatusLabel(organization.status, messages)}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">{messages.organizationNotFound}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {messages.dealsTitle}
            {opportunities.length > 0 ? ` (${opportunities.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {opportunitiesPending ? (
            <div className="flex flex-col gap-3">
              {["opportunity-skeleton-1", "opportunity-skeleton-2", "opportunity-skeleton-3"].map(
                (key) => (
                  <div key={key} className="flex flex-col gap-1 rounded-md border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-4 w-14 rounded-full" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : opportunities.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{messages.noDealsYet}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {opportunities.slice(0, 5).map((opp) => (
                <div key={opp.id} className="flex flex-col gap-1 rounded-md border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{opp.title}</p>
                    <StatusBadge status={opp.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatMoney(opp.valueAmountCents, opp.valueCurrency)}</span>
                    {opp.expectedCloseDate && (
                      <span>{formatPersonDate(opp.expectedCloseDate, resolvedLocale)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{messages.tagsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <TagsEditor
            tags={person.tags}
            saving={updatePending}
            onChange={(next) => updateField({ tags: next })}
          />
        </CardContent>
      </Card>
    </aside>
  )
}
