# Agent Instructions

## Default Completion Flow

After finishing requested changes:

1. Run the relevant verification commands.
   - For app/code changes, run `pnpm test`, `pnpm lint`, and `pnpm build`.
   - For docs-only changes, run the smallest useful check and say what was or was not run.
2. If verification passes, commit the completed work with a concise message.
3. Push the commit to `origin main`.

Do not push if verification fails, if secrets or local-only files would be included, or if the user explicitly asks not to push.

## Repository Notes

- Use `pnpm`.
- Use Node from `.nvmrc`.
- The app runs through the custom Next server in `server.ts`.
