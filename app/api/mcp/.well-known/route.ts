// Authorization currency (2026-07-28 SEPs): the token model stays
// user-minted page-scoped bearer tokens, so `authorization_servers` is
// empty by design. The issuer-validation and OAuth-alignment SEPs only bind
// once a real authorization server ships (identity spec follow-up); until
// then there is no OAuth-compatible flow here to validate.
export const dynamic = 'force-dynamic'

export const GET = (request: Request) => {
  const origin = new URL(request.url).origin

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
