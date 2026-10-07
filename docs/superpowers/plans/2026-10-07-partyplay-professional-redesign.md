# PartyPlay professional redesign — implementation plan

## Architecture assessment

- **Application:** React 19 + TypeScript + Vite, deployed as a static site on GitHub Pages at `https://okok-gif9.github.io/partyplay/`.
- **Existing shell:** `src/App.tsx` owns a stateful page switcher and all game/social flows; `src/app/AppShell.tsx` provides desktop and mobile navigation, theme/language controls, notifications, and account entry. The routed screens currently sit behind `AuthGate`, so unauthenticated visitors cannot browse or reach solo play.
- **Existing product systems to preserve:** normalized-ish registry in `src/data/gameCatalog.ts`; EN/FA dictionaries/provider with document `lang`/`dir`; safe public Supabase client (`VITE_SUPABASE_URL` and publishable key only); hooks and RPCs for profiles, friends, groups, rooms, notifications, moderation, player progress; realtime online Tic-Tac-Toe, Mafia, Truth or Dare and additional full-game engines; 21 existing SQL migrations with RLS policies. Preserve these boundaries; do not expose service-role keys or replace real data with fixtures.
- **Known gaps / constraints:** the home page is Mafia-first and combines Farsi strings with English; catalog cards are mostly icons rather than game artwork; public discovery, advanced game filters, room-code entry, public room listing, results/history routes and settings/help/system pages are not represented by the existing route state. GitHub Pages is static, so it cannot add server-side matchmaking or anonymous-play authorization by itself. Some multiplayer RPCs currently require an authenticated Supabase user. Existing lint scans vendored game files and reports thousands of upstream warnings plus three errors; TypeScript/Vite build currently succeeds.
- **Live-service verification:** the existing public URL ([PartyPlay on GitHub Pages](https://okok-gif9.github.io/partyplay/)) was inspected and currently opens at an account gate. The only Supabase MCP project configured in this session is named `Real`; its visible table catalog contains `real_*` tables and its migration history has no PartyPlay migrations. It is not verifiably the production backend for this repository. No Supabase data or schema was changed. The codebase’s PartyPlay migrations remain local source evidence only; public room discovery, anonymous live-room authorization and other schema-backed capabilities must not be claimed as live until the correct project is connected and its schema/RLS/RPCs are verified.

## Implementation approach

Keep the present React/Vite/GitHub Pages/Supabase stack. Refactor in place instead of replacing game implementations. Introduce a small URL-aware route model that works with static GitHub Pages (hash routes, while continuing to accept legacy `?room=` invites and the existing admin query). Keep `App.tsx` as the integration point for already-owned hooks and game transitions; move new route-specific UI into focused components/pages and reusable presentational components. Preserve the online game hooks as the only path to server operations. Public browsing, settings presentation and supported local practice work without an account; protected online actions must give an explicit sign-in path and retain backend authorization.

Build a centralized, translatable game registry with player range, duration, categories, modes, availability, supported launch actions and replaceable artwork paths. Add game search/filter/sort and detail views only for actual registry entries. Connect create/join/public room UI only to existing Supabase room contracts; if public-room queries or guest room permissions do not exist, show a truthful unavailable/empty state and record the required backend work rather than inventing stale rooms, matchmaking, bot support or synchronized play. Keep game-specific engines lazy-loaded and keep private/hidden state in existing RPC/server boundaries.

Build a centralized, translatable game registry with player range, duration, categories, modes, availability, supported launch actions and replaceable artwork paths. Add game search/filter/sort and detail views only for actual registry entries. Connect create/join/public room UI only to existing Supabase room contracts; if public-room queries or guest room permissions do not exist, show a truthful unavailable/empty state and record the required backend work rather than inventing stale rooms, matchmaking, bot support or synchronized play. Keep game-specific engines lazy-loaded and keep private/hidden state in existing RPC/server boundaries.

### Project structure and responsibilities

- `src/app/`: existing shell plus route parsing/formatting; global providers remain in `src/i18n/`.
- `src/components/`: existing auth, social, room, notification and game components; add focused catalog/detail/room entry components where reused.
- `src/data/gameCatalog.ts`: the single metadata and asset registry consumed by home/discovery/detail.
- `src/i18n/en.ts`, `src/i18n/fa.ts`, `src/i18n/index.tsx`: centralized visible product copy and RTL/LTR state.
- `src/hooks/`: existing feature hooks own authenticated server state/realtime; UI components do not call Supabase directly.
- `src/lib/partyplay.ts`, `src/lib/supabase.ts`: preserve validated RPC/client boundaries; no service-role credential enters client code.
- `public/art/`: original, replaceable PartyPlay hero/game artwork, not embedded as Unicode symbols.
- `supabase/migrations/`: change only if a verified, user-authorized product requirement needs backend schema; do not deploy schema changes speculatively.

## Design system

- **Design movement:** indie editorial arcade — a tactile, contemporary tabletop-game clubhouse rather than a SaaS control panel.
- **Core principles:** start playing in one glance; make real social presence legible; use game art as the primary navigation cue; make complex account/safety controls progressive and quiet.
- **Color philosophy:** deep ink and warm paper ground the interface; PartyPlay's signature electric plum anchors actions; coral and citron identify game moments, not page-wide gradients. Dark mode remains a deliberate arcade surface, not an inverted page.
- **Layout paradigm:** asymmetric editorial playboard with a single wide featured table, a compact action rail and horizontal game shelves; retain the existing responsive sidebar/bottom-nav shell.
- **Signature elements:** custom split-diamond PartyPlay mark; small “table chips” for player range/time/status; layered, original illustrated game covers.
- **Interaction philosophy:** direct, tactile, decisive buttons; show loading, empty, error, disconnected and success states beside the action that caused them; never use hover as the only affordance.
- **Animation:** restrained 140–220 ms opacity/transform transitions for navigation, button feedback and newly joined players; no continuously drifting decoration; disable nonessential motion for `prefers-reduced-motion`.
- **Typography:** Vazirmatn for Persian and Latin UI (already bundled via the current font import), with a sturdy, compact display hierarchy and generous line-height for RTL copy; no second font family that degrades Persian glyphs.
- **Brand essence:** a fast, welcoming play table for friend groups and spontaneous browser-game nights; **social, nimble, trustworthy**.
- **Brand voice:** short, inviting, action-oriented. Example lines: “Pick a game. Bring your people.” and “Have a room code? You’re one tap away.”
- **Wordmark & logo:** retain PartyPlay wordmark with a custom split-diamond tabletop mark; do not replace it with generated text art.
- **Signature brand color:** electric plum (`#7357E8`), used on high-priority actions and selected states only.

## Serving and dependencies

The application stays a static Vite build on GitHub Pages; preserve the relative Vite base and existing Actions workflow. Do not introduce a new backend, external analytics SDK, UI framework or game engine just for appearance. Use the existing Lucide icon family, CSS design tokens and original generated artwork. Use existing Supabase public credentials/configuration and RPCs only. GitHub Pages publication happens through the existing `main`-branch Actions workflow; verify the workflow result before claiming the live site has updated.

## Delivery sequence

1. Make the unauthenticated first visit useful while keeping sign-in and server-side account checks intact.
2. Rework the global shell/home hierarchy, game catalog and game-specific launch/detail affordances; give the game registry original visual assets.
3. Add route-level room-code entry and room/public-room presentation only where the existing backend can truthfully supply behavior; preserve working lobbies and games.
4. Harmonize page-level language, responsive layout, dark/light tokens, accessibility and system/empty/error states.
5. Build, run focused lint/type checks, exercise relevant static and interactive paths, commit a feature branch and open a reviewable pull request. Do not publish directly to the broad-audience `main` deployment; confirm GitHub Pages after the user reviews and merges the exact changes.

## Material limits

A feature that depends on missing server-side authorization, room queries, anonymous-auth settings, durable result schemas, matchmaking queue or online-presence backend is not complete merely because its UI exists. No database changes or public claims about those capabilities are made without first confirming the actual schema/RLS/RPC support.


## Implementation verification

The public surface has been moved to guest-first home/discovery/room/detail pages and the existing account gate now protects the account-only flows rather than the whole app. A local auth-unavailable build gives a clear explanation and a return path. The catalog has unique optimized cover art for each published game, and hash routes preserve deep links on GitHub Pages. Browser verification confirmed the pages, bilingual RTL state, all current art requests, protected account message and human-vs-bot Tic-Tac-Toe interaction. The previously embedded Tic-Tac-Toe migration placeholder has been replaced with a fully local, accessible game (mark selection, easy/normal/expert bot, minimax at expert level, turn messages, score and repeat rounds).

Final local checks: `pnpm build` passed; `pnpm exec oxlint src --quiet` reported 36 warnings and 0 errors; the route manifest parsed; every registry art reference resolved. Browser checks were at the available 1280-pixel viewport; a separate phone-sized visual capture was not available in the sandbox browser. This is a feature-branch/PR release, not a production deployment: the existing GitHub Pages workflow deploys on `main`, so production stays untouched until review/merge. Backend items still blocked by the mismatched Supabase project are enumerated in the root `TODO.md`.
