// Thin CodeMirror 6 wrapper tuned for JSON payload input — dark
// theme, bracket matching, auto-indent, line numbers off for compact
// inline editors. Used by the trigger dialog and the waitpoint
// resolve form.

import { json } from "@codemirror/lang-json"
import { oneDark } from "@codemirror/theme-one-dark"
import CodeMirror, { EditorView } from "@uiw/react-codemirror"
import { cn } from "@voyantjs/ui/lib/utils"

const theme = EditorView.theme(
  {
    "&": {
      fontSize: "12px",
      borderRadius: "6px",
      overflow: "hidden",
      width: "100%",
      maxWidth: "100%",
    },
    ".cm-scroller": {
      // Horizontally scroll long lines instead of pushing the layout
      // wider — the wrapper constrains outer width.
      overflowX: "auto",
    },
    ".cm-content": {
      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
      padding: "8px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "1px solid var(--border)",
    },
    "&.cm-focused": {
      outline: "2px solid var(--ring)",
      outlineOffset: "-2px",
    },
  },
  { dark: true },
)

export function JsonEditor({
  value,
  onChange,
  placeholder,
  minHeight = "120px",
  maxHeight = "320px",
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  maxHeight?: string
  className?: string
  "aria-label"?: string
}): React.ReactElement {
  return (
    <div
      className={cn(
        "border-input bg-input/30 w-full min-w-0 overflow-hidden rounded-md border",
        className,
      )}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        theme={oneDark}
        extensions={[json(), theme]}
        width="100%"
        height="auto"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          autocompletion: false,
          searchKeymap: false,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
        }}
        style={{
          minHeight,
          maxHeight,
          maxWidth: "100%",
        }}
        aria-label={ariaLabel}
      />
    </div>
  )
}
