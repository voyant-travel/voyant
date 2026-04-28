import { Badge, Input } from "@voyantjs/ui/components"
import { X } from "lucide-react"
import { useState } from "react"

interface TagsEditorProps {
  tags: string[]
  onChange: (next: string[]) => Promise<void>
  saving?: boolean
  disabled?: boolean
}

export function TagsEditor({ tags, onChange, saving, disabled }: TagsEditorProps) {
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function addTag(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setError("Tag already added")
      return
    }
    setError(null)
    try {
      await onChange([...tags, trimmed])
      setDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag")
    }
  }

  async function removeTag(tag: string) {
    setError(null)
    try {
      await onChange(tags.filter((t) => t !== tag))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove tag")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      void addTag(draft)
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      const last = tags[tags.length - 1]
      if (last) void removeTag(last)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            <span className="truncate max-w-[180px]">{tag}</span>
            {!disabled ? (
              <button
                type="button"
                onClick={() => void removeTag(tag)}
                disabled={saving}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </Badge>
        ))}
      </div>
      {!disabled ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void addTag(draft)}
          disabled={saving}
          placeholder="Add tag…"
          className="h-8 text-sm"
        />
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
