# Cascadery AI and MCP Agent Interface Spec

## Status

Created on 2026-06-26 as follow-up work for the Cascadery product direction.

Implementation note, 2026-06-26: the first endpoint may skip OAuth if it is explicitly enabled, rate-limited, and limited to read/search/suggest tools. Write tools, remote multi-user production access, and per-user permissions still require a stronger authorization model before broad exposure.

## Goal

Add a quiet AI integration layer that lets agents read, summarize, organize, and propose changes to Cascadery pages through MCP without making chat the primary interface.

## Product Thesis

Cascadery should become a high-quality context surface for coding agents. The canvas already contains the kind of material agents need: feature maps, decisions, architecture sketches, file references, UI states, implementation risks, and discussion artifacts.

AI should operate on that structure through explicit tools and patches. It should not silently mutate the page or rely on prompt-only safety.

## Research Basis

MCP and market research:

- MCP is an open-source standard for connecting AI applications to external systems and tools: https://modelcontextprotocol.io/docs/getting-started/intro
- MCP implementation guidelines call for robust consent and authorization flows, access controls, data protections, documentation of security implications, and privacy-aware feature design: https://modelcontextprotocol.io/specification/2025-06-18
- MCP security best practices cover risks and mitigations specific to MCP implementations: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- MCP authorization guidance recommends OAuth 2.1 for protected resources and operations: https://modelcontextprotocol.io/docs/tutorials/security/authorization
- Miro's MCP server positions visual boards as shared context that can flow into AI coding tools, including codebase visualization and turning requirements into code: https://miro.com/ai/mcp/
- Heptabase MCP/CLI lets coding agents create, read, edit, search, and organize notes and whiteboards with JSON-returning commands: https://support.heptabase.com/en/articles/14715462-how-to-use-heptabase-cli

AI risk and security research:

- OWASP GenAI Top 10 lists prompt injection, sensitive information disclosure, supply chain vulnerabilities, improper output handling, excessive agency, and other AI application risks: https://genai.owasp.org/llm-top-10/
- OWASP LLM01:2025 defines prompt injection as user or external inputs manipulating model behavior: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- NIST AI RMF provides a risk-management frame for AI systems across govern, map, measure, and manage functions: https://www.nist.gov/itl/ai-risk-management-framework

## Design Principles

- MCP first, in-app chat later. Expose structured tools before adding a conversational UI.
- Read is safer than write. The first MCP release should support read/search/summarize flows before write flows.
- Writes must be patch-based. Agents propose operations that Cascadery validates, previews, applies, and logs.
- Consent must be explicit. Users should understand which page and which capabilities an MCP client can access.
- Least privilege by default. Separate scopes for page read, page search, suggest changes, apply changes, asset access, and admin actions.
- Tool outputs must be structured. Return JSON with stable ids, timestamps, and error codes.
- Treat page content as untrusted. Areas can contain prompt injection text, malicious URLs, or instructions aimed at agents.
- Keep human ownership. Destructive, broad, or external side-effect actions require review.

## MCP Capability Model

### Resources

Initial resources:

- `cascadery://pages`
- `cascadery://pages/{pageId}`
- `cascadery://pages/{pageId}/areas`
- `cascadery://pages/{pageId}/assets`
- `cascadery://pages/{pageId}/agent-actions`

Resource payloads should include:

- Schema version.
- Page id and title.
- Area ids, parent ids, positions, dimensions, type, text summary, styles, timestamps.
- Asset metadata, not raw asset bytes by default.
- Permission mode for the current MCP client.

### Tools

Read-only MVP tools:

- `list_pages`
- `get_page`
- `search_areas`
- `get_area`
- `summarize_page`
- `extract_decisions`
- `extract_open_questions`

Suggest-only tools:

- `suggest_areas`
- `suggest_area_updates`
- `suggest_board_organization`
- `suggest_decision_log`
- `suggest_implementation_map`

Write tools, after review flow exists:

- `create_area`
- `update_area`
- `update_area_styles`
- `move_area`
- `nest_area`
- `delete_area`
- `apply_patch`

Write tools must require a patch id, dry-run response, or explicit confirmation token unless the user has granted a trusted write scope.

## Patch Model

Every agent write should produce a patch:

```json
{
  "schemaVersion": 1,
  "pageId": "page_123",
  "source": {
    "kind": "mcp-agent",
    "clientId": "client_123",
    "displayName": "Codex"
  },
  "operations": [
    {
      "op": "createArea",
      "tempId": "proposal_1",
      "area": {
        "type": "text",
        "text": "Decision: use Hocuspocus/Yjs for collaboration.",
        "x": 120,
        "y": 180,
        "width": 320,
        "height": 120,
        "styles": {
          "border": "1px solid #2563eb"
        }
      }
    }
  ]
}
```

Patch requirements:

- Validate schema before applying.
- Validate CSS declarations with the same rules as user slash commands.
- Apply size limits to text, operation count, style count, and asset references.
- Support dry-run validation.
- Record before/after summaries for audit.
- Make patches reversible where practical.

## UX Requirements

### MCP Connection

- Show connected MCP clients in a low-noise status surface.
- Show scopes granted to each client.
- Let users disconnect or revoke a client.
- If a client is acting, show a short "Codex is reading this page" or "Codex proposed 6 changes" status.

### Agent Suggestions

- Agent changes appear as a reviewable proposal layer.
- Users can accept all, reject all, or accept individual operations.
- Accepted changes should feel like normal canvas edits after apply.
- Rejected changes should not leave orphaned state.

### Error Handling

- Return structured tool errors.
- Show human-readable errors in the app for failed agent actions.
- Do not expose secrets, tokens, stack traces, or raw internal prompts in error responses.
- If validation fails, include field-level reasons.

## Security Requirements

- Use OAuth 2.1 or an equivalent secure local authorization flow for protected remote MCP access once MCP can mutate pages, access private/team data, or needs per-user permissions.
- For the first no-auth endpoint, require explicit environment enablement, rate limiting, and read/search/suggest-only tools.
- Use short-lived access tokens where possible.
- Do not pass user tokens through prompts or model-visible content.
- Enforce server-side access checks for every resource and tool call.
- Do not trust the MCP client name as an authority.
- Rate-limit MCP calls by token/client/user/IP as available.
- Log agent actions with client id, user id if available, page id, tool name, operation count, timestamp, and result.
- Redact secrets from logs.
- Treat all Area text as untrusted input when constructing prompts.
- Never let prompt instructions override tool permissions, server validation, or user-confirmation requirements.

## Privacy Requirements

- Make it clear when a page is exposed to an MCP client.
- Do not expose image binary data unless a tool explicitly requests it and has asset scope.
- Provide per-page disablement for MCP.
- Future team/workspace mode should support organization-level MCP controls.

## Acceptance Criteria

- MCP read-only tools can list, retrieve, and search pages and Areas with stable JSON.
- MCP tools never return raw secrets or hidden server data.
- Suggest tools return valid Cascadery patch objects without applying them.
- Patch validation rejects invalid CSS, oversized payloads, unknown Area ids, unauthorized actions, and malformed operations.
- UI can show proposed agent changes before applying them.
- Every applied agent patch creates an audit record.
- Tests cover prompt-injection text inside Areas to confirm it cannot escalate tool permissions.

## Open Questions

- Should local/self-hosted Cascadery expose MCP over stdio, HTTP, or both?
- Should cloud-hosted Cascadery ship remote MCP only after accounts and permissions exist?
- Should agents be allowed to create images/assets, or only reference existing assets at first?
- Should accepted agent patches be grouped into one undo event?
