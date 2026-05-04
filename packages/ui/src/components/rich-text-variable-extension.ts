import type { Editor } from "@tiptap/core"
import { InputRule, mergeAttributes, Node, PasteRule } from "@tiptap/core"

const variableInputRegex = /(?:^|\s)(\{\{\s*([^}]+)\s*\}\})$/
// Paste accepts `{{ ... }}` regardless of what precedes it. The
// live-typing rule above keeps requiring whitespace so we don't gobble
// braces mid-word, but pasted content commonly has the variable
// tucked between punctuation (`Document ({{ customer.document.type }}):`,
// `["{{ foo }}"]`, etc.) and we still want those tokenised.
const variablePasteRegex = /\{\{\s*([^}]+?)\s*\}\}/g

export const RichTextVariable = Node.create({
  name: "variable",

  group: "inline",
  inline: true,
  selectable: false,
  atom: true,
  draggable: false,

  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {
        class: "variable-node",
        "data-variable": "true",
      },
    }
  },

  addAttributes() {
    return {
      content: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-content") || element.textContent,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.content) {
            return {}
          }

          return {
            "data-content": String(attributes.content),
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable="true"]',
      },
      {
        tag: "span.variable-node",
      },
      {
        tag: "span",
        getAttrs: (node: unknown) => {
          const element = node as HTMLElement
          const text = element.textContent?.trim() || ""
          const match = text.match(/^\{\{\s*(.+?)\s*\}\}$/)

          if (match?.[1]) {
            return {
              content: match[1].trim(),
            }
          }

          return false
        },
      },
    ]
  },

  renderHTML({
    node,
    HTMLAttributes,
  }: {
    node: { attrs: { content?: unknown } }
    HTMLAttributes: Record<string, unknown>
  }) {
    const optionAttrs = (this.options as { HTMLAttributes: Record<string, string> }).HTMLAttributes
    const attributes = mergeAttributes(optionAttrs, HTMLAttributes)
    const content = String(node.attrs.content ?? "")

    return ["span", attributes, `{{ ${content} }}`]
  },

  renderText({ node }: { node: { attrs: { content?: unknown } } }) {
    const content = String(node.attrs.content ?? "")
    return `{{ ${content} }}`
  },

  addInputRules() {
    return [
      new InputRule({
        find: variableInputRegex,
        handler: ({ state, range, match }) => {
          if (!match[2]) return

          const variableContent = match[2].trim()
          const addedPosition = match[0].startsWith(" ") ? 1 : 0

          state.tr.replaceWith(
            range.from + addedPosition,
            range.to,
            this.type.create({
              content: variableContent,
            }),
          )
        },
      }),
    ]
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: variablePasteRegex,
        handler: ({ state, range, match }) => {
          if (!match[1]) return

          const variableContent = match[1].trim()

          state.tr.replaceWith(
            range.from,
            range.to,
            this.type.create({
              content: variableContent,
            }),
          )
        },
      }),
    ]
  },
})

export function insertVariableToken(editor: Editor, key: string) {
  return editor
    .chain()
    .focus()
    .insertContent({
      type: "variable",
      attrs: { content: key },
    })
    .run()
}

export function insertPlainText(editor: Editor, text: string) {
  const { from, to } = editor.state.selection

  editor.view.dispatch(editor.state.tr.insertText(text, from, to))
  editor.commands.focus()
}
