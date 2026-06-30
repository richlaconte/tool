# GIF Search and Insertion Spec

## Status

Created on 2026-06-30. Not implemented.

## Idea

Add integrated GIF search and insertion to Cascadery.

The primary path should be an in-Area slash command:

```txt
/gif "ship it"
/gif ship it
```

Typing the command should open a compact preview flyout anchored to the current Area. The user can search, preview a small set of results, choose one with keyboard or pointer, and insert it as an image Area. Successful insertion removes the `/gif...` command text, matching the existing `/image` and CSS slash-command behavior.

This feature should make the canvas more expressive without turning Cascadery into a chat app, meme board, or general media browser.

## Research Basis

API research:

- GIPHY's API docs list Search, Trending, Autocomplete, Search Suggestions, content rating, rendition, attribution, and analytics endpoints: https://developers.giphy.com/docs/api/
- GIPHY requires API calls for Search to be made from the client side and requires conspicuous `Powered By GIPHY` attribution where the API is used: https://developers.giphy.com/docs/api/
- GIPHY recommends smaller fixed-height/fixed-width renditions for preview grids and a higher-resolution rendition after selection: https://developers.giphy.com/docs/api/
- GIPHY's SDK includes ready-made UI templates and wrappers, but that would be more product-shaping than Cascadery needs for the first implementation: https://developers.giphy.com/docs/sdk/
- Tenor should not be used for a new integration. Google/Tenor's help center says the Tenor API sunsets on June 30, 2026, and current integrations will be fully decommissioned: https://support.google.com/tenor/answer/10455265?hl=en

HCI and accessibility research:

- Nielsen Norman Group describes search suggestions as an expected search feature that helps users complete searches and understand available content: https://www.nngroup.com/articles/site-search-suggestions/
- WAI-ARIA combobox guidance supports editable inputs with a popup, arrow-key navigation, Enter to accept, Escape to close, and care around not interfering with native text-editing keys: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- WCAG 2.2.2 requires users to be able to pause, stop, or hide moving content that starts automatically, lasts more than five seconds, and is shown alongside other content: https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html
- MDN documents `prefers-reduced-motion` as a widely available user preference for reducing non-essential motion: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion

## Product Direction

GIF search should follow Cascadery's existing principles:

- Slash commands are accelerators, not the only path.
- Visible UI should exist for users who do not know the command.
- Inserted media should become ordinary canvas objects, not a separate feed or message thread.
- The feature should preserve calm editing and avoid noisy chrome.
- Provider metadata should remain agent-readable and exportable.
- External media should not weaken privacy, persistence, or share-link expectations.

## API Recommendation

Use a small provider abstraction with GIPHY as the first provider.

### Option 1: GIPHY API

Recommendation: use this for MVP.

Reasons:

- Large, actively maintained GIF catalog.
- Search, trending, autocomplete, ratings, renditions, analytics, and attribution are documented.
- Client-side API usage matches GIPHY's stated integration model.
- Direct API use lets Cascadery keep its own lightweight flyout UI.

Tradeoffs:

- Requires a GIPHY API key.
- Requires visible attribution.
- Requires respecting provider rules around direct media URLs, analytics, no proxying, and no unapproved caching.
- Beta keys are rate limited, so the UI needs debounce, request cancellation, and graceful disabled/error states.

### Option 2: GIPHY SDK

Recommendation: do not use for MVP.

Reasons:

- It provides UI templates and wrappers, which could speed implementation.
- But Cascadery needs a tiny in-Area flyout that matches its command language and canvas feel.
- Pulling in a full provider UI risks visual inconsistency and larger bundle cost.

The SDK can be revisited if we need provider-approved UI and analytics faster than we can maintain them ourselves.

### Option 3: Tenor API

Recommendation: do not use.

Tenor is not viable for new work because its API is being sunset on 2026-06-30.

### Option 4: Existing `/image` URL or Upload Only

Recommendation: keep as fallback, not as the GIF search solution.

This already works for users who have a GIF URL or file, but it does not solve discovery, preview, or quick expression from the current typing flow.

## User Experience

### Slash Command

Supported command forms:

```txt
/gif
/gif cats
/gif "standup win"
```

Behavior:

- `/gif` opens the GIF flyout with an empty search field state and, if available, a small trending or suggested starting set.
- `/gif cats` searches for `cats`.
- Quoted search text is optional and only helps users make the query boundary feel clear.
- The `/gif...` text is highlighted while the command is active.
- GIF slash commands are parsed before CSS declarations, just like `/image`.
- Successful insertion removes the command text.
- Canceling or failing insertion leaves the command text editable.

### Flyout

The flyout should be anchored to the active Area or command line, not centered like the global command palette.

Recommended layout:

- Query row at top, showing the parsed query and loading state.
- 6 to 8 GIF results in a compact grid.
- Optional suggestion chips when the query is empty or too short.
- Provider attribution in the lower-right or footer.
- Error and empty states inside the flyout.

Important: avoid internal scrolling. Cascadery has been moving toward "only the canvas scrolls." Keep the flyout bounded and page results with `More` or arrow navigation rather than creating a scrollable media panel.

### Keyboard Behavior

When the GIF flyout is open:

- `Enter` inserts the selected GIF.
- `Escape` closes the flyout and leaves the command text in place.
- `ArrowRight` and `ArrowLeft` move across the grid after results are loaded.
- `ArrowDown` and `ArrowUp` move between grid rows after results are loaded.
- Typing updates the query in the Area text.
- Standard text-editing shortcuts should continue to work. Do not capture platform editing shortcuts such as Option/Alt word movement, Cmd/Ctrl navigation, or text selection.

If no result is selected, the first visible result can become the default selection once results load. The selected result must be visually clear and exposed to assistive technology.

### Pointer Behavior

- Hovering a result can show a slightly larger preview or simply reveal selection styling.
- Clicking a result inserts it.
- Clicking outside the flyout closes it and leaves the command text.
- Pointer movement between the Area and flyout should not cause flicker or disappearance.

### Visible Non-Slash Entry Point

Add or refine a command palette option:

- Title: `Insert GIF`
- Aliases: `gif`, `giphy`, `reaction`, `media`
- Behavior: opens the same GIF flyout or a small dialog with the same provider abstraction.

The command palette route should ask for a search query first, then place the selected GIF near the viewport center or near the selected Area if one exists.

## Insertion Behavior

GIFs should become normal image Areas.

Rules:

- If the source Area contains only the `/gif...` command, replace that Area with the GIF image Area at the same position and size.
- If the source Area has other text, insert the GIF as a new image Area near the source Area, preferably below it with a small offset.
- If insertion comes from command palette with a selected Area, insert near the selected Area.
- If insertion comes from command palette with no selection, insert near the viewport center.
- Default size should preserve the GIF's aspect ratio and avoid dominating the canvas.
- The image toolbar should support existing image actions such as move, resize, duplicate, delete, replace, and edit alt text.

## Motion and Accessibility

GIFs are motion-heavy by default, so MVP must include motion controls.

Recommended behavior:

- Respect `prefers-reduced-motion` by showing still previews by default.
- Add a page or editor setting: `Animate GIFs`, defaulting off when reduced motion is requested and on otherwise.
- Provide a visible pause/play affordance on selected or hovered GIF Areas.
- Use still renditions in the flyout until a result is focused, hovered, or selected.
- Persist alt text from provider title where available, then allow editing through the existing image alt-text flow.
- Do not rely on animation alone to identify the selected result.

The goal is not to remove personality. The goal is to let motion be intentional and controllable.

## Data Model

Extend existing image assets with optional source metadata rather than creating a new canvas object type.

```ts
type AssetSourceProvider = 'giphy'

type GifAssetSource = {
  provider: AssetSourceProvider
  providerAssetId: string
  providerUrl: string
  title: string
  rating?: string
  rendition: string
  stillUrl?: string
  animatedUrl: string
  attributionLabel: 'Powered by GIPHY'
  analytics?: {
    onload?: string
    onclick?: string
    onsent?: string
  }
}

type AssetState = {
  id: string
  kind: 'image'
  mimeType: string
  width: number
  height: number
  storageKey: string
  createdAt: string
  source?: GifAssetSource
}
```

Persistence guidance:

- Do not download, proxy, or store copies of provider media for MVP.
- Do not build a backend cache of GIPHY media unless provider approval exists.
- Prefer storing provider ID plus source metadata so the app can refetch if a media URL expires or is unavailable.
- Treat the direct media URL as a render pointer, not as owned content.
- Cascadery JSON should remain readable and preserve the selected GIF identity.

## Provider Abstraction

Create a small wrapper that hides provider details from the editor UI:

```ts
type GifSearchResult = {
  provider: 'giphy'
  providerAssetId: string
  title: string
  previewUrl: string
  stillUrl?: string
  animatedUrl: string
  width: number
  height: number
  providerUrl: string
  rating?: string
  attributionLabel: string
  analytics?: {
    onload?: string
    onclick?: string
    onsent?: string
  }
}

type GifSearchProvider = {
  search(query: string, options: GifSearchOptions): Promise<GifSearchResult[]>
  trending(options: GifSearchOptions): Promise<GifSearchResult[]>
  suggestions?(query: string): Promise<string[]>
  registerEvent?(
    result: GifSearchResult,
    event: 'view' | 'click' | 'send'
  ): Promise<void>
}
```

Implementation notes:

- Use `VITE_GIPHY_API_KEY` for the client-side key.
- Use a conservative default rating such as `pg` unless product settings later expose a stricter choice.
- Debounce search requests.
- Use `AbortController` so fast typing cancels stale searches.
- Limit initial results to 6 or 8.
- Register provider analytics when a result is viewed in the flyout and when it is inserted.
- If no API key is configured, hide `/gif` suggestions and make `Insert GIF` show a clear setup message.

## Error and Empty States

Required states:

- No provider configured.
- Loading.
- No results.
- Provider rate limited or temporarily unavailable.
- Network offline.
- Result failed to insert.

Copy should stay calm and actionable:

- `GIF search is not configured.`
- `No GIFs found for "query".`
- `GIF search is temporarily unavailable. Try again in a moment.`

Do not delete the user's `/gif...` command on failure.

## Collaboration and View-Only Behavior

- The inserted GIF Area should sync like any other image Area.
- Remote collaborators should see the inserted GIF and provider metadata, not the transient search flyout.
- Only the user running the search sees the flyout and query previews.
- View-only links render inserted GIFs but do not expose search, command palette insertion, or editing controls.
- If GIF animation is disabled by page/editor setting, all collaborators should get the still rendering unless they explicitly play a selected GIF locally.

## Export and Agent Behavior

- Markdown export should include GIF alt/title text and provider URL.
- JSON Canvas export should map GIF Areas as image/file nodes where possible and preserve provider metadata in extension fields.
- MCP/page resources should expose GIF Areas as image Areas with safe provider metadata, excluding API keys and any private request details.
- Agent summaries can mention GIF Areas only if relevant. Reaction GIFs should not dominate handoff briefs.

## Security, Privacy, and Compliance

- Never expose API keys in MCP resources, exports, or page JSON.
- Client-side GIPHY API keys are expected to be visible in browser code, so they should be scoped and managed as public integration keys.
- Do not proxy GIPHY API or media requests unless provider approval and terms review allow it.
- Do not cache provider media files in Cascadery storage for MVP.
- Include provider attribution in the search UI and any selected GIF metadata UI required for compliance.
- Use provider content rating parameters.
- Consider a future enterprise setting to disable external media search entirely.

## Acceptance Criteria

- Typing `/gif` in an Area opens an anchored GIF flyout.
- Typing `/gif cats` searches for `cats` after a debounce.
- Typing `/gif "ship it"` searches for `ship it`.
- The active `/gif...` text is highlighted while the flyout is open.
- GIF results show as a compact, non-scrollable preview grid.
- Arrow keys move the selected result within visible results.
- Enter inserts the selected GIF as an image Area.
- Successful insertion removes the `/gif...` command text.
- Escape or outside click closes the flyout and leaves the command text.
- Command palette includes a visible `Insert GIF` option.
- Inserted GIFs persist through page JSON and server storage.
- Inserted GIFs sync across collaborators as normal image Areas.
- View-only mode renders GIF Areas but does not show insertion controls.
- Reduced-motion users get still previews by default.
- Provider attribution appears where GIF search is used.
- Missing API key and provider errors produce recoverable UI states.

## Suggested Test Coverage

- `gifSlashCommand.test.ts` for `/gif`, `/gif query`, quoted queries, and parser precedence over CSS slash commands.
- `gifSearchProvider.test.ts` with mocked fetch for GIPHY query construction, rating, result mapping, cancellation, and error handling.
- Source/UI test for `GifSearchFlyout` rendering attribution, loading, empty, error, and non-scrollable result grid.
- Keyboard behavior test for arrow navigation, Enter insertion, Escape close, and text-editing shortcut passthrough.
- Image insertion test showing source Area replacement vs nearby image Area creation.
- Persistence test for optional `asset.source` metadata round trip.
- Collaboration test that inserted GIF Areas sync as image Areas and flyout state stays local.
- Export/MCP tests that provider metadata is included but API keys are excluded.

## Non-Goals

- Uploading GIFs to GIPHY.
- A general sticker/meme browser.
- Audio GIFs or GIPHY Clips.
- Building a server-side media proxy or cache.
- Moderation workflows beyond provider rating/filter parameters.
- A full provider marketplace.
- Replacing the existing `/image` workflow.

## Open Questions

- Should the default rating be `g` or `pg` for Cascadery's audience?
- Should GIF animation be page-level state, editor preference, or both?
- Should inserted GIFs show provider attribution only in metadata/toolbar, or also on the canvas when selected?
- Should `/gif` with no query show trending results or only suggested search terms?
- Should future value autocomplete reuse GIPHY suggestions or keep suggestions separate from result preview?
