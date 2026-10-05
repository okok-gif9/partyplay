# PartyPlay audit and implementation plan

**Audit date:** 2026-10-05
**Repository:** `okok-gif9/partyplay`
**Existing site:** https://okok-gif9.github.io/partyplay

## Audit summary

PartyPlay is an existing React 19 + TypeScript + Vite application built for static deployment to GitHub Pages. Its design system already has a Persian-first RTL interface, English localization, light/dark/system themes, responsive navigation, account settings, notifications, and an arcade catalogue. Preserve these working visuals and game pages; do not replace the product with a new project.

### What is already in the code

- **Accounts:** Supabase Auth email/password sign-up and sign-in, email magic-link and password reset flows, account recovery, unique username validation, profile display name and avatar. Google OAuth is implemented conditionally and only appears when `VITE_PARTYPLAY_GOOGLE_AUTH_ENABLED=true` and Google is enabled/configured in Supabase.
- **Social:** username lookup, friend requests (send/accept/decline), friend removal, groups, block/report workflows, and presence preferences (`online`, `away`, `busy`, `offline`). Friend lists currently load as snapshots, not live presence subscriptions.
- **Notifications/progress:** in-app activity feed, browser-notification preferences, achievements, game progress, match history/progress surfaces, admin and moderation tools.
- **Rooms/games:** server-RPC-backed online Tic-Tac-Toe, Mafia, Truth-or-Dare, and additional full-game sessions; private room codes/links; Realtime refresh hooks; solo/practice games remain available.
- **Safety:** database RLS/RPC design, report review, account security, blocking, and server-side Mafia role visibility are represented in migrations.
- **Localization/polish:** Persian and English text systems, RTL/LTR direction handling, mobile bottom navigation, and theme preferences are present.
- **Direct-social backend groundwork:** migration `0021` defines game invites, friend threads/messages, and friend-room/invite RPCs. The current React views do not yet expose friend message threads or accept/decline game invites as one-tap actions.

### What is missing or broken against the requested behavior

- **Backend is not provisioned:** the user's existing active Supabase project is `kdsazsbeypzosbkkwvpl` (`Real`), and its URL host matches this repo's `SUPABASE_URL`, but Supabase reports **zero applied migrations and zero `public` tables**. GitHub Pages itself cannot provide auth, database, Realtime, or authoritative game logic; it can serve the frontend when connected to Supabase.
- **Deployment connection:** `.github/workflows/deploy-pages.yml` already expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. This session's GitHub integration returned HTTP 403 when attempting to write the Actions secrets, so the connection cannot be completed here. Google also requires provider setup and the build flag.
- **Profile/status:** there is no ordinary editable bio field. Presence is manually selected and includes `away`/`busy`; it is not automatically live and has no `in_game` state.
- **Friends:** relationship actions exist, but status isn't realtime. The direct-message database functions are not connected to a friend chat view.
- **Invites:** current game lobbies emphasize sharing links/codes. The notifications dropdown displays activity but does not provide invite accept/decline/join actions. Direct invite RPCs exist, but the UI does not call them.
- **Lobby:** current lobbies show seats and host start controls, but do not implement ready toggles, kick, general lobby chat, or reliable reconnect treatment.
- **Mafia:** secret role assignment and protected mafia actions/chat are server-side; the shipped capacity is only 5/7/9 (not 5–15), with no configurable role set, timer settings, or reveal-on-death host choice. The current winner function counts the `citizen` role rather than every living city-faction player, which can award Mafia a premature win if Doctor/Detective remain alive.
- **Truth-or-Dare:** the code exists but `gameCatalog.ts` sets `availability: 'paused'`, and the app blocks unavailable games; therefore the game cannot currently be launched from normal game selection. It supports only 2–8 players and lacks requested category selection, passes, rated-result scoreboard, custom prompts, and host content-filter controls.
- **Migration deployment bug:** `supabase/migrations` contains two files with version prefix `0008`; migration runners require unique versions. The active Supabase project's migration list is empty, making it possible to correct the local migration sequence before deploying this repo's schema.
- **Validation baseline:** `pnpm build` passes. `pnpm exec oxlint src --quiet` reports 0 errors (34 warnings). The unscoped `pnpm lint` scans bundled/vendor files under `public/`, producing thousands of third-party warnings and 3 errors; it should be scoped to authored source for useful checks.

## Short implementation plan (requested order)

1. **Accounts + backend:** reuse this matching Supabase project, correct migration ordering, document the GitHub Pages/Supabase connection, and add a normal profile bio while retaining existing email/Google auth and avatar flows.
2. **Friends:** keep existing request/block/report behavior; subscribe to profile/request changes so friend status and requests update live.
3. **Invites + lobby:** wire server-side friend invites to the notification UI and one-tap room joining; retain room code as optional backup; add ready/kick and reconnection handling without replacing the current lobby layout.
4. **Chat:** expose the existing private-friend messaging RPCs and add room/party chat through authenticated server-enforced operations.
5. **Mafia:** make capacities 5–15, correct victory checks, and add host-controlled role/timer/death-reveal settings while keeping all role assignment and secret information server-side.
6. **Truth or Dare:** restore the game only with safe defaults and server-backed 2–12 player rounds, requested categories (Spicy off by default), passes, ratings/scoreboard, custom prompts, and host filtering.
7. **Polish:** preserve current navigation/design, complete bilingual status and invite copy, accessibility/mobile flows, and validate the production build plus source-scoped lint.

## Project structure

- `src/App.tsx`: application view switching, game room routing, shared hooks and actions.
- `src/app/AppShell.tsx`, `src/App.css`, `src/index.css`: existing brand shell, responsive layout, themes, and shared visual system.
- `src/components/`: auth, social pages, notification center, room/game screens, account safety and settings.
- `src/hooks/`: data orchestration and Supabase Realtime subscriptions.
- `src/lib/partyplay.ts`, `src/lib/supabase.ts`: typed game/social RPC access and public Supabase client.
- `src/i18n/`, `src/data/`: Persian/English strings and game catalogue/cards.
- `supabase/migrations/`: server schema, RLS, RPCs, realtime publication, and game rules; keep secrets out of source control.
- `.github/workflows/deploy-pages.yml`: static build/deploy to GitHub Pages; inject only Supabase URL and publishable key at build time.

## Design guardrails

Retain the established neon-accented dark/light dashboard visual language, existing spacing, avatars, cards, side navigation, RTL alignment, and mobile bottom navigation. Add controls inside existing cards and account/social views rather than re-skinning the application. Keep secret game logic and access checks in Postgres SECURITY DEFINER RPCs plus RLS; browser code may display only data allowed to that authenticated player.

## Implementation log and test steps

### Step 1 — accounts + backend (source implementation)

The duplicate `0008` migration version was repaired by renumbering migrations after the original full-game engine migration; the connected database had zero migrations, so this project has a unique ordered sequence. Added an editable 280-character profile bio, authenticated bio RPCs, an `in_game` presence value, and app-driven status while a lobby or active game view is open. The existing email/password, email-link, Google OAuth, username and avatar flows remain intact. Updated `.env.example`, the Pages workflow, and `README.md` with the matching Supabase project and provider setup.

**Local verification:** `pnpm build` passes, `pnpm lint` reports 0 errors (34 existing warnings), and `git diff --check` is clean. **Live verification is blocked:** the project has no deployed schema, and GitHub denied the Actions-secret write with HTTP 403. After access is available, apply migrations, set the Pages URL and publishable-key secrets, enable Google in Supabase if desired, then sign in, save a bio, open a room/game and verify status changes to “In game.”

### Step 2 — friends (source implementation)

Added Realtime subscriptions to profile, friendship and request changes; friend rows now display bilingual Online / In game / Away / Busy / Offline labels with the existing status-chip style. Online/in-game accounts send a 60-second heartbeat, and friend rows treat presence older than two minutes as Offline; the Friends page refreshes so stale clients expire even without another server event. Existing username search, request responses, block and report flows are preserved. Migrations `0024_social_presence_realtime.sql` and `0031_expiring_social_presence.sql` publish social changes and implement heartbeat expiry.

**Live test after backend setup:** open two authenticated browser sessions that are friends, set one to Online, then open a game in that session; the other friend view should update its status without reload. Send, accept and decline requests between accounts; both lists should refresh live. These cannot yet be exercised against the current empty database.

### Step 3 — invites + lobby (source implementation)

Added **Invite to play** on online-friend rows, server-backed invitations into a new room or an existing lobby, one-tap Join/Decline actions in both notification surfaces, and optional backup room codes rather than default link sharing. Lobby UI now includes readiness, host kick, realtime lobby chat, connection/retry state, and refresh on Realtime reconnect. The server prevents starting before required players are present and ready (Truth-or-Dare remains a 2-to-capacity game, not a must-fill-all-seats lobby).

**Live test after backend setup:** make two accounts friends; from one account invite the online friend from Friends and accept from Notifications. In a larger room, send several invites into that same room. Verify ready/unready changes, host-only kick, lobby messages, reconnect refresh, and that starting is refused until all required seats are ready. The code fallback should work without a URL.

### Step 4 — chat (source implementation)

Added a private friend-message dialog backed by the existing thread/message RPCs, read receipts and Realtime updates. Added active-player-only party chat for online Tic-Tac-Toe and full-game rooms with new migration `0027_in_game_party_chat.sql`. Fixed the direct-message activity type/icon mapping. Mafia's role-scoped night/day chat and Truth-or-Dare's existing game chat are preserved; the generic party chat is not exposed in Mafia where it could reveal hidden roles.

**Live test after backend setup:** send private messages both ways between friends in separate browsers and confirm read state / live delivery. Start Tic-Tac-Toe and a full-game room with two players and exchange party messages. Verify non-members and users outside a playing room cannot use the party-chat RPCs. Build passes; live tests await database provisioning.

### Step 5 — Mafia (source implementation)

Expanded Mafia capacity to every value from 5 through 15, with host controls for total Mafia team size, Doctor/Detective inclusion, discussion length, voting length, and reveal-on-death. Postgres settings are sanitized and stored at room creation; server RPCs still randomize assignments and return the player's private role view only. Added server-side timer enforcement that survives phase-state rebuilds and a database trigger that rejects gameplay state changes by eliminated spectators. The corrected win function compares the Mafia faction against **all** living city players (including Doctor and Detective), and ends when Mafia count is greater than or equal to city count or Mafia reaches zero. The old duplicate migration-version bug is already fixed.

**Local verification:** `pnpm build` passes; `pnpm lint` has 0 errors (34 warnings); `git diff --check` is clean; all 23 outer SQL statements and all 6 PL/pgSQL bodies in migration `0028_mafia_5_to_15_host_settings.sql` parse. **Live scenario tests after database setup:** create 5-, 9-, and 15-player rooms; test role toggles and count bounds; confirm each account receives its own private role (Mafia team gets its existing team view); exercise Mafia target, Doctor save, Detective check, timed discussion/vote; test both reveal-on-death settings; verify dead accounts cannot vote/advance state; and verify parity/equal-count and all-Mafia-eliminated victory outcomes.

### Step 6 — Truth-or-Dare (source implementation)

Restored Truth-or-Dare from its paused catalogue state and expanded rooms to 2–12 players. Server RPCs choose the random cycle and prompt; prompts are bilingual, categorized, and checked server-side. Host setup selects Fun, Friends, Extreme, and opt-in Spicy (off by default), a strict safety filter, and up to 20 custom `T:`/`D:` prompts. The curated Spicy cards are mild/flirty and non-explicit. Added one pass per player per match, 1–5 ratings by other players, and a live session scoreboard (ratings, completed turns, passes). The game is now available from Games and from the online-friend invite selector.

**Local verification:** build passes, lint has 0 errors (34 warnings), `git diff --check` is clean, and migration `0029_truth_dare_categories_ratings.sql` parses as 30 SQL statements plus 8 PL/pgSQL bodies. **Live test after database setup:** test 2- and 12-player rooms; confirm a random starting player; choose each category and confirm Spicy is not selected by default; try both accepted and rejected custom prompts under strict filtering; exercise one pass then a second rejected pass; rate from another account, confirm self-rating is rejected, and verify score/realtime refresh. Also invite a friend to Truth-or-Dare from Friends and use notification Join.

### Step 7 — professional polish and known limitations

The existing Home/Friends/Games/Profile navigation, activity notification center, Persian/English app language selection, RTL/LTR direction, mobile navigation, and light/dark/system themes remain in place. Added a Profile social panel backed by a new authenticated RPC: a leaderboard limited to the viewer and accepted friends, ranked by finished match count, plus the viewer's latest 12 match records. Added a 60-second heartbeat for online/in-game profiles; friend rows map a missing heartbeat older than two minutes to Offline and refresh while the Friends page is open. Polished additional Truth-or-Dare game/lobby copy for English without replacing its layout.

**Local verification:** `pnpm build` passes; source-scoped `pnpm lint` reports 0 errors (34 warnings); `git diff --check` is clean. The new overview/presence migrations parse as 6 and 11 SQL statements; both presence PL/pgSQL bodies parse locally. **Still incomplete:** some legacy game screens remain Persian-only. More importantly, the generic extra-game RPC (`partyplay_apply_full_game_state`) validates turn/membership/version but writes a client-supplied state for UNO, Codenames, Spyfall, Ludo and other extra modes; full server-side rule validation is not implemented. Mafia, Truth-or-Dare and Tic-Tac-Toe are server-backed, but this does **not** yet satisfy a blanket server-authority claim for every catalog game.

## Backend/deployment handoff

GitHub Pages can host the static UI but cannot provide authentication, database, Realtime subscriptions or server-authoritative game logic. PartyPlay already has a matching Supabase project; the project's migration list and public-table inventory were empty during audit. No new project was created and no backend migrations have yet been applied. To enable the live features:

1. From the repository root, review `supabase migration list`, then run `supabase login`, `supabase link --project-ref kdsazsbeypzosbkkwvpl`, and `supabase db push`.
2. In GitHub repository Actions settings, set `VITE_SUPABASE_URL=https://kdsazsbeypzosbkkwvpl.supabase.co` and the project's **publishable** key as `VITE_SUPABASE_PUBLISHABLE_KEY`. This task's GitHub credential returned 403 on secret write, so a repository maintainer must perform this step.
3. Optionally configure Google credentials under Supabase Auth Providers, allow `https://okok-gif9.github.io/partyplay/` as a redirect, and set the Actions variable `VITE_PARTYPLAY_GOOGLE_AUTH_ENABLED=true`.
4. Re-run two-account sign-in, friend request, presence, invite/join, lobby/chat, Mafia and Truth-or-Dare end-to-end scenarios. Until then, only source/build validation is verified.
