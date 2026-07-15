// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mutationState = vi.hoisted(() => ({
  create: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}))

vi.mock("../index.js", () => ({
  useChannels: () => ({
    data: {
      data: [
        {
          id: "channel_1",
          name: "Website",
          kind: "direct",
          status: "active",
          website: null,
          contactName: null,
          contactEmail: null,
        },
      ],
      total: 1,
    },
    isPending: false,
    refetch: vi.fn(),
  }),
  useChannelMutation: () => ({
    create: { isPending: false, mutateAsync: mutationState.create },
    remove: { isPending: false, mutateAsync: mutationState.remove },
    update: { isPending: false, mutateAsync: mutationState.update },
  }),
}))

import { ChannelsPage } from "./channels-page.js"

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

function buttonNamed(name: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === name,
  )
}

async function openChannelForm() {
  const addButton = buttonNamed("Add Channel")
  expect(addButton).toBeDefined()
  await act(async () => addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("ChannelsPage accessibility", () => {
  it("names the row action and associates all channel labels", async () => {
    await act(async () => root.render(<ChannelsPage />))

    const rowAction = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit / Delete: Website"]',
    )
    expect(rowAction?.title).toBe("Edit / Delete: Website")

    await openChannelForm()

    for (const id of [
      "channel-name",
      "channel-kind",
      "channel-status",
      "channel-website",
      "channel-contact-name",
      "channel-contact-email",
    ]) {
      expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull()
      expect(document.getElementById(id)).not.toBeNull()
    }
  })

  it("connects channel validation errors to their controls", async () => {
    await act(async () => root.render(<ChannelsPage />))
    await openChannelForm()

    const website = document.getElementById("channel-website") as HTMLInputElement
    const email = document.getElementById("channel-contact-email") as HTMLInputElement
    await act(async () => {
      setNativeInputValue(website, "not-a-url")
      setNativeInputValue(email, "not-an-email")
    })

    const form = document.querySelector("form")
    await act(async () =>
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    )

    for (const [controlId, errorId] of [
      ["channel-name", "channel-name-error"],
      ["channel-website", "channel-website-error"],
      ["channel-contact-email", "channel-contact-email-error"],
    ]) {
      const control = document.getElementById(controlId)
      expect(control?.getAttribute("aria-invalid")).toBe("true")
      expect(control?.getAttribute("aria-describedby")).toBe(errorId)
      expect(document.getElementById(errorId)).not.toBeNull()
    }
  })
})
