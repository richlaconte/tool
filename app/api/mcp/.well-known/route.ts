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
