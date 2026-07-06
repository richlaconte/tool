# Asynchronous Change Awareness: The "Since You Were Away" Recap

## Status

Priority: P2 — queue #6, after queue #5 (viewport-history dependency) (2026-07-06 audit). See the Priority Queue in README.md before starting work.

Created on 2026-07-06 from a UX research pass. Active. Builds on the
completed named-snapshots visual diff (`src/pageDiff.ts`), the agent work
journal, and identity-lite. Complements — does not overlap — the active
agent-mission-control spec, which covers *live* parallel agent sessions;
this spec covers the *returning* collaborator.

## Goal

Cascadery is an async-first artifact: implementation maps and visual RFCs
live across days while teammates and agents edit them. Today a returning
user gets no answer to "what changed since I was last here?" — the journal
has an unread dot, history and snapshot diffs exist but must be sought out
and compared manually. CSCW research is unambiguous that awareness of
asynchronous change must be shown by the artifact itself, not reconstructed
from memory or side channels. This spec adds a calm, dismissible recap: a
chip in the presence row summarizing changes since the user's last visit,
opening a grouped review with jump links and fading highlights on the
canvas.

## Research Basis

- Gutwin & Greenberg, *A Descriptive Framework of Workspace Awareness for
  Real-Time Groupware* (CSCW 2002) — the elements of awareness (who, what,
  where, when) and how people exploit them to coordinate:
  https://link.springer.com/article/10.1023/A:1021271517844
- Tam & Greenberg, *A framework for asynchronous change awareness in
  collaborative documents and workspaces* — when interaction is
  asynchronous, change awareness disappears unless the artifact displays
  its own changes; recaps should answer where/what/who/how much since the
  viewer's last state:
  https://www.sciencedirect.com/science/article/abs/pii/S1071581906000218
- NN/g recognition-rather-than-recall and visibility-of-system-status —
  changes should be shown in place, with the recap as an index, not a
  separate report the user must mentally map back to the canvas:
  https://www.nngroup.com/articles/recognition-and-recall/
- Product principle (product-DX spec): "System status should be obvious
  but calm" — the recap must be one quiet chip, never a blocking modal or
  toast storm.

## Current State

- Diffing exists and is pure: `diffPageStates` in `src/pageDiff.ts`
  (used by the snapshot visual diff UI) already classifies added, removed,
  and changed Areas between two `PageAppState`s.
- The journal (`state.journal`) records agent/human notes with timestamps;
  `lastReadJournalEntryId` is already a device-local read marker — the
  read-marker idiom this spec generalizes.
- Server snapshots (`src/server/pageSnapshots.ts`) persist full page
  states; the collaborative doc auto-saves through Hocuspocus.
- Identity-lite provides a stable user id when signed in; anonymous
  collaborators have a device profile (`collaboration.ts` cookie profile).
- Presence row (`collaboration-presence` in App.tsx) is the natural home
  for the recap chip; `jumpToArea` provides navigation; the wayfinding
  spec's viewport history makes recap-driven jumping safely reversible.

## Scope

### Last-visit state capture

- On page unload/idle, store a device-local visit marker per page:
  `{ pageId, leftAt, stateFingerprint }` plus a bounded serialized state
  snapshot (or snapshot reference) in localStorage/IndexedDB via the
  offline spec's cache — new pure module `src/changeAwareness.ts` decides
  what to store and when a return counts as "away" (recommend: > 30 min
  or a collaborative edit by someone else while away).
- If the local snapshot is missing/oversized, fall back to the newest
  server snapshot older than `leftAt`; if none, show journal-only recap.

### Recap computation

- `getChangeRecap(previousState, currentState, journal, actors, viewer)`
  in `src/changeAwareness.ts`: wraps `diffPageStates`, groups results into
  added / edited / removed / moved-only, attributes changes where the
  journal or agent-action records identify an actor, counts by actor kind
  (human vs agent), and caps each group for display with "and N more".
- Pure, deterministic, unit-tested; no network calls of its own.

### Recap surfaces

- **Chip:** in the presence row — "9 changes · 2 by agents" — appears only
  when the recap is non-empty, dismisses on click-through or explicit
  close, never re-appears for the same fingerprint. `aria-live` polite
  announcement on first render.
- **Review panel:** opening the chip shows the grouped list (actor, Area
  title excerpt via the outline's title logic, relative time); each row
  jumps to the Area with the existing navigation and a temporary highlight
  ring (same fade/reduced-motion behavior as search jumps). Removed Areas
  jump to their last position with a ghost outline.
- **Canvas hints:** while the recap is open, changed Areas get a subtle
  badge/ring; everything clears when the recap is dismissed. No permanent
  canvas decoration.

### Trust boundaries

- Everything is device-local view state: no per-user read receipts leave
  the device, nothing enters page JSON, exports, or the Yjs doc. Signed-in
  users get the marker keyed by user id so it follows them across their
  own devices only if a later identity spec adds server storage —
  explicitly out of scope here.

## Non-Goals

- Notifications outside the app (email, push, Slack) — registry/connector
  territory, different spec.
- Comment @mentions or per-user server-side read state.
- Real-time "someone is editing this Area now" affordances (presence
  already covers live awareness).
- A full activity feed UI — the history dialog remains the deep archive;
  the recap is an index over the delta.

## Acceptance Criteria

- Returning to a page changed while away (by another human or an agent)
  shows the chip with accurate counts; returning to an unchanged page
  shows nothing.
- The review panel groups added/edited/removed correctly against a fixture
  pair of states, attributes agent changes when journal/action records
  allow, and jumps to each Area with a fading highlight.
- Dismissing the recap clears all canvas hints and persists so the same
  delta never re-prompts; the next *new* delta prompts again.
- Anonymous and signed-in flows both work; clearing browser storage
  degrades gracefully to journal-only recap or silence, never an error.
- No bytes change in page JSON, exports, or the Yjs doc; view-only pages
  get the recap too (reading is the primary async use case).
- `pnpm test`, `pnpm lint`, and `pnpm build` pass.

## Testing

- `src/changeAwareness.test.ts`: away-threshold logic, fingerprinting,
  recap grouping/attribution/caps against fixture states (reusing
  `pageDiff` fixtures), dismiss-once semantics, fallback ladder (local
  snapshot → server snapshot → journal-only).
- Extend `src/pageDiff.test.ts` only if grouping needs new diff detail
  (moved-only classification).
- UI test (`src/changeAwarenessUi.test.ts`): chip renders from recap data,
  panel rows wire to `jumpToArea`, dismissal clears hints, live-region
  announcement present.

## Open Questions

- Away threshold: 30 minutes vs "any remote edit while unfocused"?
  Recommend starting with either-condition (time OR remote edit) and
  telemetry-counting chip impressions vs click-throughs to tune.
- Should agent-only deltas get a distinct chip treatment (the AI badge
  color) to prime review attention? Recommend: yes, reuse the existing
  agent presence styling.
- Local snapshot size cap for large pages — store full state up to ~1 MB,
  else fingerprint + server-snapshot fallback?
