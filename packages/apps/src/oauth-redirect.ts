export function buildAppOAuthCallbackUrl(input: {
  redirectUri: string
  code: string
  state: string
  nonce?: string
}) {
  const redirectUrl = new URL(input.redirectUri)
  redirectUrl.searchParams.set("code", input.code)
  redirectUrl.searchParams.set("state", input.state)
  if (input.nonce) redirectUrl.searchParams.set("nonce", input.nonce)
  return redirectUrl
}
