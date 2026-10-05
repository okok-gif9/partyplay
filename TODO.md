# PartyPlay implementation checklist

## 1. Accounts + backend
- [x] Sign up / log in (email or Google) code paths exist; Google remains conditional on provider setup.
- [x] Unique username, avatar, bio (bio editor and RPC migration added).
- [x] Online / In game / Offline status (60-second active heartbeat; status becomes Offline after two minutes without an update).
- [ ] Keep GitHub Pages as the static frontend, connect auth, data and realtime to the existing Supabase project, and keep all secret game logic out of the browser. **Pending:** apply migrations to the empty Supabase database and configure GitHub Actions secrets; GitHub denied the secret write with 403.

## 2. Friends
- [x] Search by username, send / accept / decline requests (existing UI/RPCs).
- [x] Friends list with live status (Realtime subscriptions and bilingual presence labels; database deployment still pending).
- [x] Block and report (existing UI/RPCs).

## 3. Invites + lobby
- [x] "Invite to play" button on each online friend.
- [x] In-app notification with one-tap join.
- [x] Keep the room code only as an optional backup.
- [x] Host picks the game and settings, ready buttons, kick, start (host start requires all required active seats ready server-side).
- [x] Lobby chat.
- [x] Reconnect handling if a player drops (Realtime resubscription refreshes room state).

## 4. Chat
- [x] Private friend messages and in-game party chat (friend threads plus active-player chat for Tic-Tac-Toe/full-game; Mafia and Truth-or-Dare keep their existing scoped chat).

## 5. Mafia (5–15 players)
- [x] Roles: Mafia, Citizen, Doctor, Detective (Godfather is the Mafia-team leader role).
- [x] Server assigns roles secretly; each authenticated player gets only their own role and role-permitted team context.
- [x] Night: mafia pick a victim (mafia-only chat), doctor saves, detective checks (existing server RPCs retained).
- [x] Day: configurable per-speaker discussion timer, then timed voting; eliminated role reveal follows host setting.
- [x] Win: mafia >= all living city roles, or all mafia dead (winner logic corrected).
- [x] Dead players spectate only (server trigger rejects state changes from eliminated players).
- [x] Host settings: team size and special roles, discussion/vote timers, reveal on death.

## 6. Truth or Dare (2–12 players)
- [x] Random player picked by the server, chooses Truth or Dare, receives a localized question/challenge selected by the server.
- [x] Others can rate 1–5; one pass per player per match; live scoreboard tracks ratings, completed turns and passes.
- [x] Categories: Fun, Friends, Extreme default on; Spicy is mild/non-explicit and off by default.
- [x] Host custom prompts (T:/D: per line, up to 20) and server-side strict content filter; risky/private-data patterns are rejected.

## 7. Professional polish
- [x] Dashboard: Home, Friends, Games, Profile (existing navigation preserved).
- [x] Notifications plus a friends-only leaderboard and last-12-match history on Profile.
- [ ] Persian + English, RTL/LTR, mobile-first, light/dark mode. **Base dashboard already supports these**; new account/friend/T-D surfaces are bilingual and the existing responsive/theme system is preserved, but several legacy game screens remain Persian-only.
- [ ] Game logic and secret info must run on the server, not in the browser. **Core social game flows (Tic-Tac-Toe, Mafia, Truth-or-Dare) use server RPCs; the extra generic full-game modes still accept client-authored state and need a rule-engine migration.**

## Implementation log

- **Step 1 (accounts + backend, source):** fixed duplicate migration versions; added profile-bio and in-game presence RPCs; added the profile bio editor, automatic in-game status while a play/lobby view is open, and GitHub Pages setup documentation. Build passes; source lint has 0 errors. **Deployment is pending** because the active database has no tables/migrations and GitHub Actions secret writes are blocked by a 403.
- **Step 2 (friends, source):** added Realtime subscriptions for profile, friendship, and request changes plus bilingual presence labels. Migrations `0024_social_presence_realtime.sql` and `0031_expiring_social_presence.sql` add Realtime publication membership and heartbeat expiry; the client sends an active heartbeat every 60 seconds and treats presence older than two minutes as Offline. **Live two-account test is pending** until the migrations and Pages variables are configured.
- **Step 3 (invites + lobby, source):** friend-row invites create/join lobbies through authenticated RPCs; notification actions accept/decline; hosts can invite more friends into the current room. Added ready state, host kick, realtime lobby chat, reconnect refresh, and server-side start gating. Room URLs are no longer the primary invitation path; short codes remain backup only. **Live room test is pending** until migrations are deployed.
- **Step 4 (chat, source):** added a private friend-message dialog with read receipts and Realtime updates, plus server-checked in-game party chat for Tic-Tac-Toe and full-game rooms. Corrected direct-message activity type/icon handling. Mafia's private team chat and Truth-or-Dare's existing game chat remain separate. **Live chat test is pending** until migrations are deployed.
- **Step 5 (Mafia, source):** expanded room sizes to 5–15, added host role/timer/death-reveal settings, made session timers server-enforced, fixed the city count used for Mafia parity, and enforced spectator-only state at the database trigger. Role results remain private in per-player RPCs. The new migration parses as PostgreSQL and PL/pgSQL; production build passes and lint has 0 errors (34 warnings). **Live multi-account game test is pending** until migrations are deployed.
- **Step 6 (Truth-or-Dare, source):** restored the paused game and expanded it to 2–12 players; the server owns random turns, prompts, filtering, ratings and pass counts. Added Fun/Friends/Extreme, opt-in Spicy, host filtering/custom prompts, one pass per player, 1–5 ratings, scoreboard, and a friend-invite option. **Live multiplayer validation is pending** until migrations are deployed.
- **Step 7 (polish, source):** kept the existing Home/Friends/Games/Profile navigation, activity notifications, language switch, RTL/LTR direction, responsive layout and theme selector. Added a friends-only leaderboard and last 12 match-history rows to Profile; added heartbeat expiry; polished English Truth-or-Dare game/lobby labels. Final validation passes: `pnpm build`, `pnpm lint` (0 errors, 34 warnings), `git diff --check`, and SQL parsing for migrations `0030`/`0031`. **Remaining:** legacy game translation coverage and server-side rule validation for extra generic modes; live service tests remain blocked on migration/Pages setup.

## Bugs discovered and fixed

- Two migrations shared version `0008`; the duplicate was ordered into a unique version and later migrations renumbered after confirming the connected database had no applied migrations.
- Mafia victory parity compared against ordinary Citizens only; now counts all living town roles, including Doctor and Detective.
- Eliminated Mafia players could reach state-advancing RPCs; a database trigger now rejects their actions.
- Truth-or-Dare was marked paused/unavailable in the catalog; its 2–12 player source flow is now exposed again.
- Direct-message activity was absent from the client activity-kind union; its icon and route rendering are now mapped.
- Presence could remain stale after disconnect; online/in-game profiles now heartbeat and are treated as offline when no update arrives for two minutes.

## Known unfinished work

- The generic extra-game RPC accepts client-supplied state for games such as UNO, Codenames, Spyfall, and Ludo; server-side rule validation is still required before claiming all game logic runs on the server.
- Supabase migrations have not been applied; live E2E tests cannot pass until that is done and the repository's Pages secrets are set. The current GitHub token returned HTTP 403 when asked to write Actions secrets.
