import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const editorState = vi.hoisted(() => ({
  options: undefined as
    | {
        editorProps?: {
          attributes?: Record<string, unknown>
        }
      }
    | undefined,
}))

vi.mock("@tiptap/react", () => ({
  EditorContent: () => null,
  useEditor: (options: typeof editorState.options) => {
    editorState.options = options
    return null
  },
}))

import { PhoneInput } from "../src/components/phone-input.js"
import { RichTextEditor } from "../src/components/rich-text-editor.js"

describe("form control accessibility", () => {
  it("keeps the phone country helper and search control named", () => {
    const html = renderToStaticMarkup(
      <PhoneInput aria-label="Phone" defaultCountry="RO" onChange={() => undefined} value="" />,
    )

    expect(html).toContain('aria-label="Phone number country"')
    expect(html).toContain('title="Phone number country"')
  })

  it("forwards rich-text labeling and validation metadata to the editable element", () => {
    renderToStaticMarkup(
      <RichTextEditor
        id="product-description"
        aria-labelledby="product-description-label"
        aria-describedby="product-description-error"
        aria-invalid="true"
        value=""
        onChange={() => undefined}
      />,
    )

    expect(editorState.options?.editorProps?.attributes).toMatchObject({
      id: "product-description",
      role: "textbox",
      "aria-labelledby": "product-description-label",
      "aria-describedby": "product-description-error",
      "aria-invalid": "true",
      "aria-multiline": "true",
    })
  })
})
