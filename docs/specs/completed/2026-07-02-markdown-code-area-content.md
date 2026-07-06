# Markdown and Code-Native Area Content

## Status

Created on 2026-07-02 from the Spec Suite Roadmap (Tier 1.2). Completed —
core path shipped in `src/markdownContent.ts`, `src/codeHighlight.ts`, and
`src/components/MarkdownContent.tsx` with colocated tests (stale "Active."
status corrected in the 2026-07-06 spec audit).

## Goal

Render a safe Markdown subset inside text Areas — including syntax-highlighted
fenced code blocks and clickable links — so the canvas is actually
developer-native. Raw Markdown source remains the stored text and is shown
while editing.

## Research Basis

- Obsidian Canvas renders full Markdown in canvas cards and treats source text
  as the durable format: https://obsidian.md/canvas
- Heptabase cards are real Markdown notes, which is a core reason developers
  trust the canvas as a knowledge surface: https://heptabase.com/
- OWASP XSS prevention: never inject unsanitized HTML; build DOM from a parsed
  representation instead:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

## Current State

- Text Areas store plain text: `PersistedTextArea.text` in
  `src/pagePersistence.ts`; collaborative text is a `Y.Text` inside the areas
  map (`src/collaborativePage.ts`, `getCollaborativeAreaText`).
- The Area component is `src/components/Area.tsx`; it renders text directly and
  switches to an editable control while editing (styles in
  `src/components/area.css`).
- Markdown *export* exists (`exportPageAsMarkdown` in `src/pageExports.ts`)
  but nothing renders Markdown in the app.
- The repo has effectively zero runtime dependencies beyond React/Next/Yjs;
  there is no sanitizer or highlighter installed, and artifact/CSP-style
  self-containment is a project value. Prefer small hand-rolled modules with
  thorough tests over new dependencies.

## Scope

### Markdown subset

Supported in v1 (nothing more):

- Headings `#` through `###`
- Bold `**text**`, italic `*text*`
- Inline code `` `code` ``
- Links `[label](https://…)` — `http:`, `https:`, and `mailto:` schemes only;
  anything else renders as plain text
- Unordered lists (`- item`) and ordered lists (`1. item`), one nesting level
- Fenced code blocks ``` with an optional language tag
- Paragraph breaks on blank lines; single newlines stay hard breaks (canvas
  notes are line-oriented; do not collapse single newlines)

Explicitly not supported in v1: tables, images (image Areas exist), block
quotes, task-list checkboxes (task state belongs to Area metadata), raw HTML
(always escaped and shown literally).

### Parser and renderer

- New pure module `src/markdownContent.ts`:
  - `parseMarkdown(text: string): MarkdownBlock[]` — a small line-based parser
    producing a typed AST (`heading | paragraph | list | codeBlock`), with
    inline nodes (`text | bold | italic | code | link`). No regex-based HTML
    generation, no `dangerouslySetInnerHTML` anywhere.
  - `isSafeLinkHref(href: string): boolean` — scheme allowlist.
- New React renderer `src/components/MarkdownContent.tsx` that maps the AST to
  elements. Links get `target="_blank" rel="noreferrer noopener"`.
- New pure module `src/codeHighlight.ts`:
  - `highlightCode(code: string, language: string): CodeToken[]` where a token
    is `{ text, kind: 'keyword' | 'string' | 'comment' | 'number' | 'plain' }`.
  - Support `ts`/`tsx`/`js`, `css`, `json`, `html`, `bash` with simple
    tokenizers; unknown languages render as plain text. Deterministic, pure,
    heavily tested. Do not add a highlighting dependency without recording the
    bundle-size tradeoff in this spec.
- Highlight colors come from CSS classes in `src/App.css` (e.g.
  `.md-token-keyword`) so they follow the app theme, with sufficient contrast
  in both the default and any dark background users set via Area styles.

### Editing model

- Obsidian-style toggle: while an Area is being edited, show the raw Markdown
  source in the existing editable control, unchanged. When not editing, render
  `MarkdownContent`. No live WYSIWYG in v1.
- Clicking a link in non-editing mode follows the link; clicking anywhere else
  on the Area behaves exactly as today (select, double-click/enter to edit).
- View-only mode renders Markdown (never raw source).

### Integration points

- `src/components/Area.tsx`: swap the static text rendering for
  `MarkdownContent`. Keep text measurement/overflow behavior working —
  `src/areaTextOverflow.test.ts` guards this today; update it deliberately.
- Slash commands: CSS and evidence slash commands operate on the raw text and
  are typed while editing, so they are unaffected. Verify
  `removeCssSlashCommand` (`src/cssSlashCommand.ts`) still sees raw text.
- Exports: `exportPageAsMarkdown` must pass Area text through verbatim (it is
  already Markdown); remove any escaping that would double-encode it.
- Agent surface: `agentInterface.ts` and MCP resources already carry raw text;
  document in the MCP tool descriptions that Area text is Markdown.
- Search (future spec) matches against raw text.

## Non-Goals

- WYSIWYG or live-preview editing.
- Markdown in image Area alt text or link labels.
- Embeds, transclusion, LaTeX, Mermaid (Mermaid may become a future spec).
- A `code` Area kind — fenced blocks inside notes cover v1.

## Acceptance Criteria

- A fenced ```ts block renders with keyword/string/comment/number coloring.
- Headings, bold, italic, inline code, links, and both list types render;
  everything outside the subset renders as literal text.
- `<script>alert(1)</script>`, `[x](javascript:alert(1))`, and
  `<img src=x onerror=…>` render as inert text; no HTML injection path exists
  (verified by tests asserting the AST, not by manual review alone).
- Editing shows raw source; blur/escape returns to rendered view; existing
  plain-text pages render unchanged (plain text parses to paragraphs).
- Links open in a new tab with `rel="noreferrer noopener"`; non-allowlisted
  schemes render as text.
- View-only pages render Markdown; Markdown export round-trips raw text.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/markdownContent.test.ts`: every block/inline type, nesting edge cases,
  malformed input (unterminated fences, unbalanced emphasis), XSS strings,
  scheme allowlist.
- `src/codeHighlight.test.ts`: per-language token snapshots, empty input,
  unknown language passthrough.
- Update `src/areaTextOverflow.test.ts` for rendered-mode measurement.

## Open Questions

- Should long code blocks scroll inside the Area or grow it? Recommend:
  scroll within the Area (`overflow: auto` on the block) so spatial layout
  stays stable.
- Should the editor apply Markdown-aware conveniences (auto-continue lists)?
  Recommend: defer; keep the raw editor dumb in v1.
