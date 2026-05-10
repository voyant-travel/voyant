"use client"

import { Badge, Input } from "@voyantjs/ui/components"
import { X } from "lucide-react"
import { type KeyboardEvent, useState } from "react"

import { useCrmUiMessagesOrDefault } from "../i18n/index.js"

export interface TagsEditorProps {
  tags: string[]
  onChange: (next: string[]) => Promise<void>
  saving?: boolean
  disabled?: boolean
}

export function TagsEditor({ tags, onChange, saving, disabled }: TagsEditorProps) {
  const messages = useCrmUiMessagesOrDefault().inlineEditor
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function addTag(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setError(messages.tagAlreadyAdded)
      return
    }
    setError(null)
    try {
      await onChange([...tags, trimmed])
      setDraft("")
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.addTagFailed)
    }
  }

  async function removeTag(tag: string) {
    setError(null)
    try {
      await onChange(tags.filter((current) => current !== tag))
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.removeTagFailed)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      void addTag(draft)
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      const last = tags[tags.length - 1]
      if (last) void removeTag(last)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            <span className="max-w-[180px] truncate">{tag}</span>
            {!disabled ? (
              <button
                type="button"
                onClick={() => void removeTag(tag)}
                disabled={saving}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </Badge>
        ))}
      </div>
      {!disabled ? (
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void addTag(draft)}
          disabled={saving}
          placeholder={messages.addTagPlaceholder}
          className="h-8 text-sm"
        />
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
