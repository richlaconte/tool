# Telemetry

Cascadery collects anonymous, self-hosted usage counts to guide spec
prioritization. The rules are strict, because the product's data-ownership
positioning demands telemetry be exemplary or absent:

- No third-party scripts or services; counters live in the app's own SQLite
  database.
- No page content, page ids, titles, Area text, tokens, or URLs — ever.
- No cookies, no fingerprinting, no IP addresses, no user agents. The
  stored table is exactly `(event, day, count)`.
- A visible off-switch in the command palette ("Disable usage telemetry"),
  persisted per browser.
- A server-wide kill switch: `TOOL_TELEMETRY_DISABLED=true` makes the
  endpoint return 404 and the client no-op.
- The full event list is published below; a unit test keeps this list in
  parity with the code (`src/telemetry.test.ts`).

Read the counters with `pnpm telemetry:report`.

## Events

- `page_created`
- `area_created`
- `slash_command_used`
- `context_kit_inserted`
- `share_link_created`
- `export_markdown`
- `export_json_canvas`
- `export_sdd`
- `export_sdd_spec_kit`
- `export_mermaid`
- `import_mermaid`
- `import_page_json`
- `mcp_request`
- `agent_proposal_accepted`
- `agent_proposal_rejected`

Server-recorded MCP requests append the tool name as
`mcp_request:<tool_name>` (for example `mcp_request:get_page`) so the
signal answers "which agent capabilities matter". Tool names are part of
the public API surface, never content.
