# Share Links Spec

## Idea

Generate two unique, unguessable links for each page: one edit link and one view-only link.

## HCI/UX Research Basis

- Box's shared-link model clearly separates edit and view-only capabilities, helping users understand what recipients can do.
- OWASP guidance around access control and authentication implies links should not rely on predictable identifiers.
- Security discussions around unguessable URLs note that secret URLs can leak through browser history, logs, and referrers, so the UI should avoid overstating their privacy.
- Nielsen Norman Group's consistency heuristic supports using familiar permission labels such as `Can edit` and `Can view`.

Sources:
- https://support.box.com/hc/en-us/articles/360043697094-Creating-Shared-Links
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://martinfowler.com/articles/web-security-basics.html
- https://www.nngroup.com/articles/ten-usability-heuristics/

## User Experience

The Share dialog should be explicit and low anxiety:

- Show two rows: `Can edit` and `Can view`.
- Each row has a copy button.
- Each row explains the capability in plain language.
- Regenerate/revoke controls are visible but secondary.
- View-only mode disables editing affordances and commands.
- Edit mode preserves the normal editor.

## Link Model

```ts
type ShareLinks = {
  pageId: string
  editTokenHash: string
  viewTokenHash: string
  createdAt: string
  updatedAt: string
  revokedAt: string | null
}
```

The raw tokens are only shown once in generated URLs. Store hashes server-side.

## Permission Rules

- Edit link can create, update, delete, move, resize, upload images, and change settings.
- View link can read page JSON and assets but cannot send edit operations.
- View-only users can use navigation/search/help but not destructive or editing commands.
- View-only UI should avoid showing disabled controls everywhere; it should feel like a clean read mode.

## Security Rules

- Use cryptographically strong random tokens.
- Never use sequential IDs as access secrets.
- Avoid putting sensitive page content directly in URLs.
- Provide revocation/regeneration for each link independently.
- Add `Referrer-Policy` to reduce token leakage to external sites.

## Acceptance Criteria

- Share dialog creates and displays edit/view URLs.
- Copy buttons provide visible success feedback.
- View-only link loads the page without editable controls.
- Edit link allows normal editing.
- Regenerating the edit link invalidates the old edit URL without changing the view URL.
- Server rejects edit operations from view-only sessions.

## Open Questions

- Should links expire by default?
- Should the owner need an account before links can be generated?
- Should view-only users see collaborator cursors?
