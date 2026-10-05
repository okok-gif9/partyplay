# PartyPlay

PartyPlay is an existing Persian-first social game platform built with React, TypeScript, and Vite. The app keeps its current dashboard, game catalogue, responsive navigation, Persian RTL / English LTR, and light/dark themes.

## Run locally

```bash
pnpm install
cp .env.example .env.local
# Fill in the Supabase project URL and publishable key in .env.local
pnpm dev
```

The public GitHub Pages client must use only the Supabase **publishable** key. Never put a service-role key or database password in `VITE_*` variables or commit them to this repository.

## Existing Supabase backend

The matching Supabase project is already present (project ref `kdsazsbeypzosbkkwvpl`), but it currently has no PartyPlay tables or applied migrations. Apply this repository's ordered migrations before testing live auth/social/game features. The duplicate historical `0008` version is corrected; apply them with the Supabase CLI from the repository root:

```bash
supabase login
supabase link --project-ref kdsazsbeypzosbkkwvpl
supabase db push
```

Review the pending migration list before applying it to any database with existing user data. The current session's GitHub token could not write Actions secrets (403), so a repository maintainer must configure the two values below in GitHub. PartyPlay uses authenticated RPCs and row-level security for social operations and the Mafia, Truth-or-Dare, and Tic-Tac-Toe game flows. The additional generic full-game modes still accept client-authored state and are **not yet server-authoritative**; do not use them for secret or competitive play until that engine is hardened.

## GitHub Pages connection

The existing `.github/workflows/deploy-pages.yml` builds the Vite frontend and deploys `dist/`. In **GitHub → Settings → Secrets and variables → Actions**, set these repository secrets:

- `VITE_SUPABASE_URL`: `https://kdsazsbeypzosbkkwvpl.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the project's public publishable key (not a service-role key)

To enable Google sign-in, enable/configure Google under **Supabase → Authentication → Providers**, set the Google client credentials there, add the GitHub Pages URL (`https://okok-gif9.github.io/partyplay/`) to the Supabase allowed redirect URLs, and set the Actions repository variable `VITE_PARTYPLAY_GOOGLE_AUTH_ENABLED` to `true`. The workflow passes that variable at build time. Email/password and email-link flows are already implemented.

For local development, put the same public URL and publishable key in `.env.local`; Google remains hidden unless its provider is configured and the flag is `true`.

## Validate

```bash
pnpm build
pnpm lint
```

`pnpm lint` checks authored code under `src/` so vendored game assets under `public/` do not overwhelm project diagnostics.

## Current feature notes

The existing codebase provides the account shell, profiles/avatars, username-based friend requests, blocking/reporting, groups, activity notifications, progress/achievements, and game catalog. This change adds bio editing, heartbeat-backed friend presence, invite notifications, ready/chat/kick lobby controls, private friend/party chats, Mafia host settings, Truth-or-Dare rounds and a friends-only leaderboard/recent-match panel. Live social/game testing remains pending until the migrations and Pages secrets are configured. The ordered checklist is in [`TODO.md`](TODO.md); the audit and implementation notes are in [`docs/partyplay-audit-and-plan.md`](docs/partyplay-audit-and-plan.md).
