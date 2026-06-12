import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  type AdminDestinationResolvers,
  AdminNavigationProvider,
  useAdminHref,
  useAdminNavigate,
} from "../../src/navigation/destinations.js"

// `AdminDestinations` is empty inside this package (domain packages augment it
// via `declare module "@voyantjs/admin"`, which can't bind to the relative
// imports used in tests), so the tests exercise the contract with a
// locally-typed resolver map cast into the declared types. The real
// declaration-merging path is type-tested in @voyantjs/catalog-react.
type LooseResolvers = Record<string, (params: never) => string>

function asResolvers(resolvers: LooseResolvers): AdminDestinationResolvers {
  return resolvers as AdminDestinationResolvers
}

type LooseHrefResolver = (key: string, params: unknown) => string
type LooseNavigator = (key: string, params: unknown, options?: { replace?: boolean }) => void

function HrefProbe({ destination, params }: { destination: string; params: unknown }) {
  const resolveHref = useAdminHref() as LooseHrefResolver

  return <a href={resolveHref(destination, params)}>destination link</a>
}

function NavigateProbe({
  destination,
  params,
  options,
}: {
  destination: string
  params: unknown
  options?: { replace?: boolean }
}) {
  const navigateTo = useAdminNavigate() as LooseNavigator

  return (
    <button type="button" onClick={() => navigateTo(destination, params, options)}>
      go
    </button>
  )
}

describe("admin navigation destinations", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("resolves hrefs through the provider resolver map", () => {
    render(
      <AdminNavigationProvider
        resolvers={asResolvers({
          "supplier.detail": ({ supplierId }: { supplierId: string }) => `/suppliers/${supplierId}`,
        })}
        navigate={vi.fn()}
      >
        <HrefProbe destination="supplier.detail" params={{ supplierId: "sup_1" }} />
      </AdminNavigationProvider>,
    )

    expect(screen.getByRole("link").getAttribute("href")).toBe("/suppliers/sup_1")
  })

  it('returns "#" and warns once per key when no resolver is registered', () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(
      <AdminNavigationProvider resolvers={asResolvers({})} navigate={vi.fn()}>
        <HrefProbe destination="missing.resolver" params={{}} />
        <HrefProbe destination="missing.resolver" params={{}} />
      </AdminNavigationProvider>,
    )

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toBe("#")
    }
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"missing.resolver"'))
  })

  it('returns "#" and warns when rendered outside the provider', () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(<HrefProbe destination="missing.provider" params={{}} />)

    expect(screen.getByRole("link").getAttribute("href")).toBe("#")
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("AdminNavigationProvider"))
  })

  it('returns "#" and warns when a resolver throws (never throws in render)', () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    render(
      <AdminNavigationProvider
        resolvers={asResolvers({
          "throwing.resolver": () => {
            throw new Error("boom")
          },
        })}
        navigate={vi.fn()}
      >
        <HrefProbe destination="throwing.resolver" params={{}} />
      </AdminNavigationProvider>,
    )

    expect(screen.getByRole("link").getAttribute("href")).toBe("#")
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("navigates by calling the injected navigate with the resolved href", () => {
    const navigate = vi.fn()

    render(
      <AdminNavigationProvider
        resolvers={asResolvers({
          "product.detail": ({ productId }: { productId: string }) => `/products/${productId}`,
        })}
        navigate={navigate}
      >
        <NavigateProbe destination="product.detail" params={{ productId: "prod_7" }} />
      </AdminNavigationProvider>,
    )

    fireEvent.click(screen.getByRole("button"))

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith("/products/prod_7", undefined)
  })

  it("forwards replace navigation options to the injected navigate", () => {
    const navigate = vi.fn()

    render(
      <AdminNavigationProvider
        resolvers={asResolvers({
          "product.detail": ({ productId }: { productId: string }) => `/products/${productId}`,
        })}
        navigate={navigate}
      >
        <NavigateProbe
          destination="product.detail"
          params={{ productId: "prod_7" }}
          options={{ replace: true }}
        />
      </AdminNavigationProvider>,
    )

    fireEvent.click(screen.getByRole("button"))

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith("/products/prod_7", { replace: true })
  })

  it("warns and no-ops navigation for an unresolvable destination", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const navigate = vi.fn()

    render(
      <AdminNavigationProvider resolvers={asResolvers({})} navigate={navigate}>
        <NavigateProbe destination="missing.navTarget" params={{}} />
      </AdminNavigationProvider>,
    )

    fireEvent.click(screen.getByRole("button"))
    fireEvent.click(screen.getByRole("button"))

    expect(navigate).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
