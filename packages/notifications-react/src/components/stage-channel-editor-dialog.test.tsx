// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { VoyantNotificationsProvider } from "../provider.js"
import { StageChannelEditorDialog } from "./stage-channel-editor-dialog.js"

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

afterEach(() => {
  cleanup()
})

describe("StageChannelEditorDialog", () => {
  it("submits the selected template slug for new stage channels", async () => {
    let submittedBody: unknown
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const parsed = new URL(url, "http://localhost")
      if (parsed.pathname.endsWith("/notifications/templates")) {
        return Response.json({ data: [template], total: 1, limit: 20, offset: 0 })
      }
      if (init?.method === "POST" && parsed.pathname.endsWith("/stages/stage_1/channels")) {
        submittedBody = JSON.parse(String(init.body))
        return Response.json({
          data: {
            id: "rsc_123",
            stageId: "stage_1",
            orderIndex: 0,
            channel: "email",
            provider: null,
            templateId: null,
            templateSlug: "e2e-email-template-20260629",
            recipientKind: "primary",
            recipientRole: null,
            metadata: null,
            createdAt: "2026-06-29T00:00:00.000Z",
            updatedAt: "2026-06-29T00:00:00.000Z",
          },
        })
      }
      return Response.json({ data: null }, { status: 404 })
    })
    const onOpenChange = vi.fn()

    renderDialog(fetcher, onOpenChange)
    const templateInput = screen.getByPlaceholderText(/Search templates/)
    const templateTrigger = templateInput
      .closest('[data-slot="input-group"]')
      ?.querySelector("button")
    if (!templateTrigger) throw new Error("Template combobox trigger not found")
    fireEvent.click(templateTrigger)
    fireEvent.change(templateInput, { target: { value: "e2e" } })

    const listbox = await screen.findByRole("listbox")
    fireEvent.click(
      await within(listbox).findByRole("option", { name: /E2E Email Template Updated/ }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() =>
      expect(submittedBody).toMatchObject({
        channel: "email",
        templateId: null,
        templateSlug: "e2e-email-template-20260629",
        recipientKind: "primary",
      }),
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

function renderDialog(
  fetcher: (url: string, init?: RequestInit) => Promise<Response>,
  onOpenChange: (open: boolean) => void,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <VoyantNotificationsProvider baseUrl="/api" fetcher={fetcher}>
        <StageChannelEditorDialog
          reminderRuleId="rule_1"
          stageId="stage_1"
          channel={null}
          defaultOrderIndex={0}
          open
          onOpenChange={onOpenChange}
        />
      </VoyantNotificationsProvider>
    </QueryClientProvider>,
  )
}
