import { VoyantApiError } from "@voyantjs/customer-portal-react"

export function getErrorMessage(error: unknown): string {
  if (error instanceof VoyantApiError) {
    if (error.status === 401) {
      return "Customer session required. Sign in on the Voyant public origin first, then reload this page."
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Unknown error"
}
