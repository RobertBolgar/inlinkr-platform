> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# TubeLinkr Codex Rules

## Branch Policy
- `master` is the live production branch for real users.
- `free-dev` is the staging branch for free-tier updates before release.
- `pro-dev` is the staging branch for Pro development before release.

## Hard Rules
- NEVER commit directly to `master`.
- ONLY work on the explicitly requested target branch: `free-dev` or `pro-dev`.
- Do not create or merge branches unless explicitly instructed.
- Do not change deployment settings, DNS, Cloudflare config, Clerk config, or environment variables unless explicitly instructed.
- Do not modify billing, auth, redirects, analytics, or database logic unless the task specifically requires it.

## Change Scope Rules
- Make the smallest safe change possible.
- Only edit files required for the task.
- Do not refactor unrelated code.
- Do not rename files, move files, or reorganize folders unless required for the task.
- Preserve current architecture unless the task specifically requires a structural change.

## Safety Rules
- Protect the live user experience at all times.
- Treat `master` as release-only.
- Treat `free-dev` as staging for free-version changes.
- Treat `pro-dev` as staging for unfinished Pro work.
- Unfinished Pro work must not be exposed to live free users.

## Output Rules
- Commit directly to the requested staging branch unless told otherwise.
- Use a clear, specific commit message.
- Summarize:
  - what changed
  - which files changed
  - any risks or follow-up checks
- If a task is high-risk, recommend a protected branch workflow instead of direct staging commits.

## High-Risk Changes
The following are high-risk and should be handled conservatively:
- Clerk auth
- redirect logic
- analytics tracking
- billing / upgrade logic
- D1 schema or queries
- middleware
- route protection
- anything affecting user access or production routing

For high-risk changes:
- prefer isolated work
- avoid broad edits
- do not make unrelated cleanups
