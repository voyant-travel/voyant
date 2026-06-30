// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { VoyantNotificationsProvider } from "../provider.js"
import { TemplatePicker } from "./template-picker.js"

const template = {
  id: "ntpl_123",
  slug: "e2e-email-template-20260629",
  name: "E2E Email Template Updated",
  channel: "email",
  provider: null,
  status: "active",
  subjectTemplate: "Subject",
  htmlTemplate: null,
  textTemplate: null,
  fromAddress: null,
  isSystem: false,
  metadata: null,
  createdAt: "2026-06-29T00:00:00.000Z",
  updatedAt: "2026-06-29T00:00:00.000Z",
}

const emptyListResponse = { data: [], total: 0, limit: 20, offset: 0 }
const templateListResponse = { data: [template], total: 1, limit: 20, offset: 0 }
const hiddenTemplate = {
  ...template,
  id: "ntpl_hidden",
  slug: "hidden-email-template-20260629",
  name: "Hidden Email Template",
}

afterEach(() => {
  cleanup()
})

describe("TemplatePicker", () => {
  it("surfaces active templates returned by the server for the typed search", async () => {
    const fetcher = vi.fn(async (url: string) => {
      const parsed = new URL(url, "http://localhost")
      const search = parsed.searchParams.get("search")
      return Response.json(search === "e2e" ? templateListResponse : emptyListResponse)
    })

    renderPicker(fetcher, vi.fn(), { valueKey: "slug" })
    await waitFor(() => expect(fetcher).toHaveBeenCalled())

    const input = screen.getByRole("combobox")
    fireEvent.click(screen.getByRole("button"))
    fireEvent.change(input, { target: { value: "e2e" } })

    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/v1/admin/notifications/templates?channel=email&status=active&search=e2e",
        ),
        expect.anything(),
      ),
    )

    const listbox = screen.getByRole("listbox")
    expect(
      await within(listbox).findByRole("option", { name: /E2E Email Template Updated/ }),
    ).toBeInstanceOf(HTMLElement)
    expect(within(listbox).getByText("e2e-email-template-20260629")).toBeInstanceOf(HTMLElement)
  })

  it("emits the template slug when configured for slug-backed forms", async () => {
    const fetcher = vi.fn(async () => Response.json(templateListResponse))
    const onChange = vi.fn()

    renderPicker(fetcher, onChange, { valueKey: "slug" })
    fireEvent.click(screen.getByRole("button"))
    const listbox = await screen.findByRole("listbox")
    fireEvent.click(
      await within(listbox).findByRole("option", { name: /E2E Email Template Updated/ }),
    )

    expect(onChange).toHaveBeenCalledWith("e2e-email-template-20260629")
  })

  it("resolves a selected slug outside the current result page", async () => {
    const fetcher = vi.fn(async (url: string) => {
      const parsed = new URL(url, "http://localhost")
      return Response.json(
        parsed.searchParams.get("search") === "hidden-email-template-20260629"
          ? { data: [hiddenTemplate], total: 1, limit: 1, offset: 0 }
          : templateListResponse,
      )
    })

    renderPicker(fetcher, vi.fn(), {
      value: "hidden-email-template-20260629",
      valueKey: "slug",
    })

    expect(await screen.findByDisplayValue("Hidden Email Template")).toBeInstanceOf(HTMLElement)
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/v1/admin/notifications/templates?channel=email&status=active&search=hidden-email-template-20260629&limit=1&offset=0",
      ),
      expect.anything(),
    )
  })
})

function renderPicker(
  fetcher: (url: string, init?: RequestInit) => Promise<Response>,
  onChange: (value: string | null) => void,
  options: { value?: string | null; valueKey?: "id" | "slug" } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <VoyantNotificationsProvider baseUrl="/api" fetcher={fetcher}>
        <TemplatePicker
          value={options.value ?? null}
          onChange={onChange}
          channel="email"
          valueKey={options.valueKey}
        />
      </VoyantNotificationsProvider>
    </QueryClientProvider>,
  )
}
