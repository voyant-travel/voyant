"use client"

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language"
import { EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, placeholder as placeholderExt } from "@codemirror/view"
import { tags as t } from "@lezer/highlight"
import { useEffect, useRef } from "react"

/**
 * A focused CodeMirror editor for the bounded reporting query language
 * (`from … where … select … group by … order by … limit …`). It is not a
 * general SQL editor: only the small grammar the server compiles is highlighted,
 * so authors get real editor affordances (line numbers, undo history, monospace,
 * keyword colouring) without implying arbitrary SQL is accepted.
 */

const KEYWORDS = new Set([
  "from",
  "where",
  "select",
  "group",
  "by",
  "order",
  "limit",
  "as",
  "and",
  "or",
  "not",
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "distinct",
  "asc",
  "desc",
  "between",
  "in",
  "is",
  "null",
  "true",
  "false",
  "like",
])

// Legacy StreamLanguage token names ("keyword"/"string"/… ) map onto lezer tags
// via CodeMirror's built-in table, so `syntaxHighlighting` can style them below.
const queryLanguage = StreamLanguage.define<Record<string, never>>({
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.match(/'([^'\\]|\\.)*'/)) return "string"
    if (stream.match(/-?\d+(\.\d+)?/)) return "number"
    if (stream.match(/[a-zA-Z_][\w.]*/)) {
      return KEYWORDS.has(stream.current().toLowerCase()) ? "keyword" : "variableName"
    }
    if (stream.match(/[=<>!]+|[(),*]/)) return "operator"
    stream.next()
    return null
  },
})

const highlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "var(--brand, oklch(0.7 0.21 40))", fontWeight: "600" },
  { tag: t.string, color: "oklch(0.78 0.13 155)" },
  { tag: t.number, color: "oklch(0.78 0.12 300)" },
  { tag: t.operator, color: "var(--muted-foreground, #71717a)" },
  { tag: t.variableName, color: "var(--foreground, inherit)" },
])

const editorTheme = EditorView.theme(
  {
    "&": {
      fontSize: "0.8125rem",
      color: "var(--foreground)",
      backgroundColor: "transparent",
      borderRadius: "0.375rem",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-content": {
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
      padding: "0.5rem 0",
      caretColor: "var(--foreground)",
      minHeight: "6rem",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--muted-foreground)",
      border: "none",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 0.5rem 0 0.75rem" },
    ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--foreground) 4%, transparent)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent" },
    "&.cm-editor.cm-focused .cm-cursor": { borderLeftColor: "var(--foreground)" },
    ".cm-placeholder": { color: "var(--muted-foreground)" },
  },
  { dark: true },
)

export interface QueryCodeEditorProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly ariaLabel?: string
}

export function QueryCodeEditor({
  value,
  onChange,
  placeholder = "from bookings.activity group by status select status, count() as total",
  ariaLabel = "Query editor",
}: QueryCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Keep the latest onChange without re-creating the editor on every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Create the editor once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-once CodeMirror setup — value/placeholder/ariaLabel are applied through the dedicated sync effect below; adding them here would re-instantiate the editor on every keystroke and clobber the cursor.
  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          queryLanguage,
          syntaxHighlighting(highlightStyle),
          editorTheme,
          placeholderExt(placeholder),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Sync external value changes into the editor without clobbering the cursor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return (
    <div
      ref={hostRef}
      className="border-input bg-background focus-within:ring-ring overflow-hidden rounded-md border focus-within:ring-2"
    />
  )
}
