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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { cn } from "@voyantjs/ui/lib/utils"
import { currencies } from "@voyantjs/utils/currencies"
import { languages } from "@voyantjs/utils/languages"
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
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  TrendingUp,
  User as UserIcon,
  X,
} from "lucide-react"
import { useState } from "react"
import { PhoneInput } from "@/components/ui/phone-input"

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
      setError(e instanceof Error ? e.message : "Failed to save")
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
        setError(e instanceof Error ? e.message : "Failed to save")
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
            placeholder={`Add ${label.toLowerCase()}`}
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
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={cancel}
                  disabled={saving}
                >
                  Cancel
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
              displayValue || `Add ${label.toLowerCase()}`
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
      setError(e instanceof Error ? e.message : "Failed to save")
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
              placeholder="Search currency..."
              className="mt-0.5 h-8 text-sm"
              disabled={saving}
            />
            <ComboboxContent>
              <ComboboxEmpty>No currencies found</ComboboxEmpty>
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
              `Add ${label.toLowerCase()}`
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
      setError(e instanceof Error ? e.message : "Failed to save")
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
              placeholder="Search language..."
              className="mt-0.5 h-8 text-sm"
              disabled={saving}
            />
            <ComboboxContent>
              <ComboboxEmpty>No languages found</ComboboxEmpty>
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
              `Add ${label.toLowerCase()}`
            )}
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
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
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
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  const addTag = async () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setError("Tag already added")
      return
    }
    setError(null)
    try {
      await onChange([...tags, trimmed])
      setDraft("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add tag")
    }
  }

  const removeTag = async (tag: string) => {
    setError(null)
    try {
      await onChange(tags.filter((t) => t !== tag))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove tag")
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
                aria-label={`Remove ${tag}`}
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
        placeholder="Add tag…"
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
      setError("Note cannot be empty")
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
      setError(e instanceof Error ? e.message : "Failed to save note")
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
              Cancel
            </Button>
            <Button size="sm" onClick={() => void commit()} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap pr-16 text-sm">{note.content}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {compact ? formatRelative(note.createdAt) : new Date(note.createdAt).toLocaleString()}
          </p>
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={startEdit}
              aria-label="Edit note"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <IconDeleteButton
              title="Delete this note?"
              description="This action cannot be undone."
              disabled={deleting}
              onConfirm={onDelete}
              ariaLabel="Delete note"
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
      setError("Subject is required")
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
      setError(e instanceof Error ? e.message : "Failed to save activity")
    }
  }

  const isDone = activity.status === "done"

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
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Subject"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="flex-1"
              disabled={savingEdit}
            />
          </div>
          <Textarea
            placeholder="Description (optional)"
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            className="min-h-[60px]"
            disabled={savingEdit}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={savingEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void commit()} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
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
              {activity.status}
            </Badge>
            <Badge variant="secondary" className="capitalize text-[10px]">
              {activity.type.replace("_", " ")}
            </Badge>
          </div>
          {activity.description && (
            <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{new Date(activity.createdAt).toLocaleString()}</span>
            {activity.location && <span>• {activity.location}</span>}
            {activity.dueAt && <span>• Due {formatDate(activity.dueAt)}</span>}
          </div>
          <div className="absolute right-0 top-0 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {activity.status !== "cancelled" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => void onToggleStatus()}
                disabled={togglingStatus}
                aria-label={isDone ? "Mark as planned" : "Mark as done"}
                title={isDone ? "Mark as planned" : "Mark as done"}
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
              aria-label="Edit activity"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <IconDeleteButton
              title="Delete this activity?"
              description="This will permanently remove the activity. This action cannot be undone."
              disabled={deleting}
              onConfirm={onDelete}
              ariaLabel="Delete activity"
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
      {status}
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
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-6 py-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button type="button" onClick={onBack} className="hover:text-foreground">
          People
        </button>
        <span>/</span>
        <span className="text-foreground">{displayName}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <ConfirmActionButton
          buttonLabel="Delete"
          confirmLabel="Delete"
          title="Delete this person?"
          description="This will permanently remove the person from your CRM. This action cannot be undone."
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
  updateField,
}: {
  person: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    website: string | null
    jobTitle: string | null
    dateOfBirth: string | null
    source: string | null
    preferredLanguage: string | null
    preferredCurrency: string | null
    relation: string | null
    status: string
  }
  displayName: string
  organization: { name: string } | null | undefined
  websiteHref?: string
  updateField: (patch: Record<string, unknown>) => Promise<void>
}) {
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
                {person.relation}
              </Badge>
            )}
            <Badge variant="outline" className="capitalize">
              {person.status}
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
              <span className="text-[10px]">Email</span>
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
              <span className="text-[10px]">Call</span>
            </Button>
            <Button variant="ghost" className="h-12 flex-col gap-0.5 px-1 text-xs">
              <Calendar className="h-4 w-4" />
              <span className="text-[10px]">Meet</span>
            </Button>
            <Button variant="ghost" className="h-12 flex-col gap-0.5 px-1 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-[10px]">Task</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">About this contact</CardTitle>
        </CardHeader>
        <CardContent className="divide-y text-sm">
          <InlineField
            icon={Mail}
            label="Email"
            kind="email"
            value={person.email}
            href={person.email ? `mailto:${person.email}` : undefined}
            onSave={(next) => updateField({ email: next })}
          />
          <InlineField
            icon={Phone}
            label="Phone"
            kind="phone"
            value={person.phone}
            href={person.phone ? `tel:${person.phone}` : undefined}
            onSave={(next) => updateField({ phone: next })}
          />
          <InlineField
            icon={Globe}
            label="Website"
            kind="url"
            value={person.website}
            href={websiteHref}
            placeholder="https://example.com"
            onSave={(next) => updateField({ website: next })}
          />
          <FieldRow icon={Building2} label="Organization" value={organization?.name ?? null} />
          <InlineField
            icon={UserIcon}
            label="Job title"
            value={person.jobTitle}
            onSave={(next) => updateField({ jobTitle: next })}
          />
          <InlineField
            icon={Calendar}
            label="Date of birth"
            kind="date"
            value={person.dateOfBirth}
            onSave={(next) => updateField({ dateOfBirth: next })}
          />
          <InlineField
            icon={Tag}
            label="Source"
            value={person.source}
            onSave={(next) => updateField({ source: next })}
          />
          <InlineLanguageField
            icon={Globe}
            label="Preferred language"
            value={person.preferredLanguage}
            onSave={(next) => updateField({ preferredLanguage: next })}
          />
          <InlineCurrencyField
            icon={TrendingUp}
            label="Preferred currency"
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
  openOpportunitiesCount,
  wonOpportunitiesCount,
  totalOpenValue,
  primaryCurrency,
}: {
  activeTab: "overview" | "notes" | "activities"
  setActiveTab: (tab: "overview" | "notes" | "activities") => void
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
  openOpportunitiesCount: number
  wonOpportunitiesCount: number
  totalOpenValue: number
  primaryCurrency: string | null
}) {
  return (
    <main className="col-span-12 flex flex-col gap-4 lg:col-span-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">
            Notes{notes.length > 0 ? ` (${notes.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="activities">
            Activities{activities.length > 0 ? ` (${activities.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Card size="sm">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Open deals</p>
                <p className="text-2xl font-semibold">{openOpportunitiesCount}</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Pipeline value</p>
                <p className="text-2xl font-semibold">
                  {formatMoney(totalOpenValue, primaryCurrency)}
                </p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Won deals</p>
                <p className="text-2xl font-semibold">{wonOpportunitiesCount}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onOpenActivityComposer}
              >
                <Plus className="mr-1 h-3 w-3" />
                Log activity
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {activitiesPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No activities logged yet.
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
                            {activity.status}
                          </Badge>
                        </div>
                        {activity.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {activity.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatRelative(activity.createdAt)}
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
              <CardTitle className="text-sm font-semibold">Recent notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {notesPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : notes.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No notes yet.</p>
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
              <CardTitle className="text-sm font-semibold">Notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <Textarea
                  placeholder="Add a note..."
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
                        Saving…
                      </>
                    ) : (
                      "Add note"
                    )}
                  </Button>
                </div>
              </div>

              {notes.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
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
              <CardTitle className="text-sm font-semibold">Activity timeline</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onOpenActivityComposer}
              >
                <Plus className="mr-1 h-3 w-3" />
                New activity
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
                        {ACTIVITY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Subject"
                      value={activitySubject}
                      onChange={(e) => setActivitySubject(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <Textarea
                    placeholder="Description (optional)"
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
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={onSubmitActivity}
                      disabled={!activitySubject.trim() || addActivityPending}
                    >
                      {addActivityPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging…
                        </>
                      ) : (
                        "Log activity"
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {activitiesPending ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No activities logged yet.
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
  return (
    <aside className="col-span-12 flex flex-col gap-4 lg:col-span-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Organization</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!person.organizationId ? (
            <p className="py-2 text-sm text-muted-foreground">No organization associated.</p>
          ) : organizationPending ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                    {organization.relation}
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize text-[10px]">
                  {organization.status}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">Organization not found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Deals{opportunities.length > 0 ? ` (${opportunities.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {opportunitiesPending ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : opportunities.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No deals yet.</p>
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
                    {opp.expectedCloseDate && <span>{formatDate(opp.expectedCloseDate)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Tags</CardTitle>
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
