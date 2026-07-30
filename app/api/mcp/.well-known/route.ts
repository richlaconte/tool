// Authorization currency (2026-07-28 SEPs): the token model stays
// user-minted page-scoped bearer tokens, so `authorization_servers` is
// empty by design. The issuer-validation and OAuth-alignment SEPs only bind
// once a real authorization server ships (identity spec follow-up); until
// then there is no OAuth-compatible flow here to validate.
export const dynamic = 'force-dynamic'

export const GET = (request: Request) => {
  // Behind the Fly proxy, `request.url` reflects the internal listen address
  // (0.0.0.0:3000), so derive the public origin from forwarded headers first.
  const protocol =
    getFirstHeaderValue(request.headers.get('x-forwarded-proto')) ?? 'https'
  const host =
    getFirstHeaderValue(request.headers.get('x-forwarded-host')) ??
    getFirstHeaderValue(request.headers.get('host')) ??
    new URL(request.url).host
  const origin = `${protocol}://${host}`

  return Response.json({
    protected_resource: `${origin}/api/mcp`,
    authorization_servers: [],
    bearer_methods_supported: ['header'],
    resource: `${origin}/api/mcp`,
    scopes_supported: [
      'page:read',
      'page:search',
      'page:suggest',
      'page:write',
    ],
  })
}

const getFirstHeaderValue = (value: string | null) =>
  value?.split(',')[0]?.trim() || null
