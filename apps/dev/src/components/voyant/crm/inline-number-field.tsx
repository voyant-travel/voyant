import { Button, Input } from "@voyantjs/ui/components"
import { Check, Loader2, Pencil, X } from "lucide-react"
import { useState } from "react"

interface InlineNumberFieldProps {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: number | null
  placeholder?: string
  disabled?: boolean
  min?: number
  max?: number
  onSave: (next: number | null) => Promise<void>
}

export function InlineNumberField({
  icon: Icon,
  label,
  value,
  placeholder,
  disabled,
  min,
  max,
  onSave,
}: InlineNumberFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value != null ? String(value) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCancel() {
    setDraft(value != null ? String(value) : "")
    setEditing(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (draft.trim() === "") {
        await onSave(null)
      } else {
        const parsed = Number.parseInt(draft, 10)
        if (!Number.isFinite(parsed)) throw new Error("Invalid number")
        if (min != null && parsed < min) throw new Error(`Must be at least ${min}`)
        if (max != null && parsed > max) throw new Error(`Must be at most ${max}`)
        await onSave(parsed)
      }
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      void handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancel()
    }
  }

  return (
    <div className="group flex items-start gap-3 py-1.5">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <Input
              autoFocus
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className="h-8 text-sm"
              placeholder={placeholder}
              min={min}
              max={max}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleSave()}
              disabled={saving}
              className="h-8 w-8 p-0"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
              className="h-8 w-8 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate text-sm">
              {value != null ? (
                value.toLocaleString()
              ) : (
                <span className="text-muted-foreground italic">{placeholder || "Not set"}</span>
              )}
            </div>
            {!disabled ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        )}
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}
