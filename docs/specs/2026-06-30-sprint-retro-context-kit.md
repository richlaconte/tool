# Sprint Retro Context Kit Spec

## Status

Created on 2026-06-30. Not implemented.

## Idea

Add a "Sprint Retro" board option to Cascadery's context kits/templates.

The template should help a team quickly reflect on a sprint, collect feedback, turn patterns into insights, and leave with concrete actions for the next sprint. It should feel like a developer context canvas, not a generic meeting board.

## Research Basis

- Scrum.org describes the Sprint Retrospective as planning ways to increase quality and effectiveness: https://www.scrum.org/resources/what-is-a-sprint-retrospective
- Atlassian's retrospective guidance frames the activity as gathering feedback, generating insights, and implementing changes: https://www.atlassian.com/team-playbook/plays/retrospective

## User Experience

Add a new context kit option:

- `id`: `sprint-retro`
- `title`: `Sprint Retro`
- `description`: `Reflect on the sprint and choose next actions.`
- `icon`: use an existing lightweight icon keyword or add a simple `retro`/`cycle` icon mapping if the context kit UI needs one.

Recommended layout:

1. Sprint context
   - Area kind: `note`
   - Text: `Sprint context\n\nGoal:\nShipped:\nSurprises:`
   - Purpose: align everyone before collecting feedback.

2. Went well
   - Area kind: `note`
   - Text: `Went well\n\n- `
   - Purpose: capture strengths and repeatable behaviors.

3. Needs attention
   - Area kind: `risk`
   - Text: `Needs attention\n\n- `
   - Purpose: name friction without turning it into blame.

4. Learned
   - Area kind: `question`
   - Text: `Learned\n\n- `
   - Purpose: capture insights and useful surprises.

5. Try next sprint
   - Area kind: `task`
   - Text: `Try next sprint\n\n- [ ] `
   - Purpose: convert discussion into experiments.

6. Follow-up owners
   - Area kind: `task`
   - Text: `Follow-up owners\n\n- `
   - Purpose: prevent action items from becoming decorative notes.

Recommended links:

- `sprint-context` -> `went-well` as `relates-to`
- `sprint-context` -> `needs-attention` as `relates-to`
- `needs-attention` -> `try-next-sprint` as `depends-on`
- `learned` -> `try-next-sprint` as `implements`
- `try-next-sprint` -> `follow-up-owners` as `depends-on`

Recommended tags:

- Add `retro` to all Areas.
- Add `action` to action/follow-up Areas.
- Add `process` to `needs-attention` and `learned`.

## Product Fit

The template should reinforce Cascadery's positioning as a context canvas for developer teams:

- It is structured enough to drive a meeting.
- It is spatial enough to support discussion and grouping.
- It is semantic enough for agents and exports to summarize action items later.
- It avoids becoming a broad project-management board.

## Acceptance Criteria

- The empty-state context kit list includes `Sprint Retro`.
- The command/dialog context kit picker includes `Sprint Retro`.
- Inserting the kit creates the six recommended Areas.
- Inserted Areas use normal `area.styles`, metadata, and links.
- Inserted links connect the key retro flow from context to feedback to actions.
- The first Area is selected after insertion, matching existing context kit behavior.
- Existing context kits are unchanged.

## Suggested Test Coverage

- `contextKits.test.ts` verifies `sprint-retro` exists with the expected title, Area count, metadata kinds, tags, and links.
- UI/source test verifies the context kit picker and empty state source render context kits from `CONTEXT_KITS`, so the new option appears automatically.
- Persistence/export tests do not need new coverage if context kit insertion already creates ordinary Areas and links.

## Non-Goals

- Anonymous voting.
- Timers or facilitation flow.
- Jira/Linear sync.
- Sentiment analysis.
- Retro-specific permissions.
