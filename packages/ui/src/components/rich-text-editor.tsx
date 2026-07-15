import type { Editor, Extensions } from "@tiptap/core"
import { Placeholder } from "@tiptap/extensions/placeholder"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
  Unlink,
} from "lucide-react"
import { useEffect } from "react"
import { cn } from "../lib/utils.js"
import { Button } from "./button.js"
import { RichTextVariable } from "./rich-text-variable-extension.js"

export type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
  placeholder?: string
  disabled?: boolean
  className?: string
  editorClassName?: string
  enableVariables?: boolean
  onEditorReady?: (editor: Editor | null) => void
}

type ToolbarButtonProps = {
  active?: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}

const EMPTY_CONTENT = "<p></p>"

function normalizeEditorContent(value: string) {
  return value.trim() ? value : EMPTY_CONTENT
}

function isAllowedLinkUri(uri: string) {
  const value = uri.trim()

  if (!value) {
    return false
  }

  if (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("./") ||
    value.startsWith("../")
  ) {
    return true
  }

  try {
    const parsed = new URL(value)
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

function isRelativeLinkUri(uri: string) {
  const value = uri.trim()

  return (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("./") ||
    value.startsWith("../")
  )
}

function hasLinkProtocol(uri: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(uri.trim())
}

function normalizeLinkHref(href: string) {
  const value = href.trim()

  if (!value) {
    return null
  }

  if (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    hasLinkProtocol(value)
  ) {
    return isAllowedLinkUri(value) ? value : null
  }

  const withProtocol = `https://${value}`
  return isAllowedLinkUri(withProtocol) ? withProtocol : null
}

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className="h-8 w-8 p-0"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
  "aria-invalid": ariaInvalid,
  placeholder = "Write something…",
  disabled = false,
  className,
  editorClassName,
  enableVariables = false,
  onEditorReady,
}: RichTextEditorProps) {
  const extensions: Extensions = [
    StarterKit.configure({
      heading: {
        levels: [2, 3],
      },
      link: {
        autolink: true,
        defaultProtocol: "https",
        linkOnPaste: true,
        openOnClick: false,
        protocols: ["mailto", "tel"],
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
        isAllowedUri: (url, { defaultValidate }) => {
          if (isRelativeLinkUri(url)) {
            return true
          }

          if (hasLinkProtocol(url)) {
            return isAllowedLinkUri(url) && defaultValidate(url)
          }

          return defaultValidate(url) && isAllowedLinkUri(`https://${url.trim()}`)
        },
      },
    }),
    Placeholder.configure({
      placeholder,
      showOnlyWhenEditable: false,
    }),
  ]

  if (enableVariables) {
    extensions.push(RichTextVariable)
  }

  const accessibilityAttributes = {
    ...(id ? { id } : {}),
    ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
    ...(ariaLabelledby ? { "aria-labelledby": ariaLabelledby } : {}),
    ...(ariaDescribedby ? { "aria-describedby": ariaDescribedby } : {}),
    ...(ariaInvalid !== undefined ? { "aria-invalid": String(ariaInvalid) } : {}),
  }

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions,
    content: normalizeEditorContent(value),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        ...accessibilityAttributes,
        class:
          "ProseMirror min-h-48 px-3 py-3 text-sm outline-none [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_p]:my-2",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.isEmpty ? "" : currentEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) {
      return
    }

    const nextContent = normalizeEditorContent(value)
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!onEditorReady) {
      return
    }

    onEditorReady(editor)

    return () => {
      onEditorReady(null)
    }
  }, [editor, onEditorReady])

  const setLink = () => {
    if (!editor) {
      return
    }

    const previousHref = editor.getAttributes("link").href
    const href = window.prompt("Link URL", typeof previousHref === "string" ? previousHref : "")

    if (href === null) {
      return
    }

    if (href.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }

    const normalizedHref = normalizeLinkHref(href)

    if (!normalizedHref) {
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedHref }).run()
  }

  return (
    <div className={cn("rounded-md border border-input bg-transparent", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <ToolbarButton
          label="Bold"
          active={editor?.isActive("bold")}
          disabled={!editor?.can().chain().focus().toggleBold().run()}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor?.isActive("italic")}
          disabled={!editor?.can().chain().focus().toggleItalic().run()}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Strike"
          active={editor?.isActive("strike")}
          disabled={!editor?.can().chain().focus().toggleStrike().run()}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor?.isActive("heading", { level: 2 })}
          disabled={!editor?.can().chain().focus().toggleHeading({ level: 2 }).run()}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor?.isActive("heading", { level: 3 })}
          disabled={!editor?.can().chain().focus().toggleHeading({ level: 3 }).run()}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor?.isActive("bulletList")}
          disabled={!editor?.can().chain().focus().toggleBulletList().run()}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Ordered list"
          active={editor?.isActive("orderedList")}
          disabled={!editor?.can().chain().focus().toggleOrderedList().run()}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Blockquote"
          active={editor?.isActive("blockquote")}
          disabled={!editor?.can().chain().focus().toggleBlockquote().run()}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          active={editor?.isActive("link")}
          disabled={!editor || disabled}
          onClick={setLink}
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Remove link"
          disabled={!editor?.isActive("link")}
          onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
        <div className="ml-auto flex items-center gap-2">
          <ToolbarButton
            label="Undo"
            disabled={!editor?.can().chain().focus().undo().run()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            disabled={!editor?.can().chain().focus().redo().run()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>
      <div
        className={cn(
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.variable-node]:inline-flex [&_.variable-node]:items-center [&_.variable-node]:rounded-md [&_.variable-node]:border [&_.variable-node]:border-emerald-500/30 [&_.variable-node]:bg-emerald-500/10 [&_.variable-node]:px-1.5 [&_.variable-node]:py-0.5 [&_.variable-node]:font-mono [&_.variable-node]:text-xs [&_.variable-node]:text-emerald-200",
          editorClassName,
        )}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
