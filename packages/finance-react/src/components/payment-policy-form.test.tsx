// @vitest-environment jsdom

import type { PaymentPolicy } from "@voyant-travel/finance/payment-policy"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { PaymentPolicyForm } from "./payment-policy-form.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe("PaymentPolicyForm", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("renders a legacy deposit policy without throwing", async () => {
    const legacyPolicy: Partial<PaymentPolicy> & {
      type: "deposit"
      depositPercent: number
      balanceDueDays: number
    } = {
      type: "deposit",
      depositPercent: 30,
      balanceDueDays: 30,
    }

    await act(async () => {
      root.render(
        <PaymentPolicyForm
          value={legacyPolicy as PaymentPolicy}
          onChange={() => {}}
          inheritable={false}
        />,
      )
    })

    expect(container.textContent).toContain("Deposit kind")
    expect(container.textContent).toContain("Deposit percent")
    expect(container.textContent).toContain("Balance due")
  })

  it("keeps non-inheritable malformed policies editable", async () => {
    await act(async () => {
      root.render(
        <PaymentPolicyForm value={{} as PaymentPolicy} onChange={() => {}} inheritable={false} />,
      )
    })

    expect(container.querySelector("fieldset")?.disabled).toBe(false)
  })
})
