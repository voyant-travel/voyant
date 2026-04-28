import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Check, Loader2, Pencil, X } from "lucide-react"
import { useState } from "react"

interface InlineSelectFieldOption {
  value: string
  label: string
}

interface InlineSelectFieldProps {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string | null
  options: readonly InlineSelectFieldOption[]
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  onSave: (next: string | null) => Promise<void>
}

export function InlineSelectField({
  icon: Icon,
  label,
  value,
  options,
  placeholder,
  disabled,
  allowClear = true,
  onSave,
}: InlineSelectFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCancel() {
    setDraft(value ?? "")
    setEditing(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft === "" ? null : draft)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const matched = options.find((o) => o.value === value)

  return (
    <div className="group flex items-start gap-3 py-1.5">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {editing ? (
          <div className="mt-1 flex items-center gap-2">
            <Select
              items={[
                ...(allowClear ? [{ label: "None", value: "__none__" }] : []),
                ...options.map((o) => ({ label: o.label, value: o.value })),
              ]}
              value={draft}
              onValueChange={(v) => setDraft(v ?? "")}
              disabled={saving}
            >
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue placeholder={placeholder || "Select…"} />
              </SelectTrigger>
              <SelectContent>
                {allowClear ? (
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground italic">None</span>
                  </SelectItem>
                ) : null}
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (draft === "__none__") setDraft("")
                void handleSave()
              }}
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
              {matched ? (
                matched.label
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
