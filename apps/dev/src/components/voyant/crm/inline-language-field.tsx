import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { cn } from "@voyantjs/ui/lib/utils"
import { languages } from "@voyantjs/utils/languages"
import { Pencil } from "lucide-react"
import { useState } from "react"

const LANGUAGE_CODES = Object.keys(languages).sort()

interface InlineLanguageFieldProps {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string | null
  disabled?: boolean
  onSave: (next: string | null) => Promise<void>
}

export function InlineLanguageField({
  icon: Icon,
  label,
  value,
  disabled,
  onSave,
}: InlineLanguageFieldProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function commitSelection(next: string | null) {
    setSaving(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const languageName = value ? languages[value as keyof typeof languages] : null

  return (
    <div className="group flex items-start gap-3 py-1.5">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {editing ? (
          <Combobox
            items={LANGUAGE_CODES}
            defaultOpen
            autoHighlight
            filter={(code, query) => {
              const key = code as string
              const name = languages[key as keyof typeof languages]
              if (!name) return false
              const q = query.toLowerCase()
              return key.toLowerCase().includes(q) || name.toLowerCase().includes(q)
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
                        <span className="truncate">{name}</span>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => !disabled && setEditing(true)}
              disabled={disabled}
              className={cn(
                "-mx-1 flex-1 truncate rounded px-1 py-0.5 text-left text-sm transition-colors",
                !disabled && "hover:bg-muted/60 cursor-text",
                !value && "text-muted-foreground italic",
              )}
            >
              {value ? (
                <span>
                  <span className="font-mono">{value}</span>
                  {languageName ? (
                    <span className="ml-2 text-muted-foreground">{languageName}</span>
                  ) : null}
                </span>
              ) : (
                `Add ${label.toLowerCase()}`
              )}
            </button>
            {!disabled ? (
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
            ) : null}
          </div>
        )}
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}
