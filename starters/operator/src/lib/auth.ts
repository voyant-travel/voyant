"use client"

import { apiKeyClient } from "@better-auth/api-key/client"
import { emailOTPClient, organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { getApiUrl } from "./env"

export const authClient = createAuthClient({
  baseURL: `${getApiUrl()}/auth`,
  plugins: [apiKeyClient(), organizationClient(), emailOTPClient()],
  fetchOptions: {
    credentials: "include",
  },
})
