# PartyPlay: direct social play, private messages, localized auth email, and performance design

**Status:** Approved for specification review  
**Date:** 2026-08-21  
**Scope:** Supabase-backed social play and realtime behavior for the static PartyPlay client

## 1. Objective

PartyPlay must allow confirmed friends to play together without exchanging a room link, let a host assemble a multi-player room directly from friends, and provide private messaging only between confirmed friends. The revised system must also deliver authentication email content in the language recorded for the user, make in-app notifications predictably open and close, and remove known sources of refresh storms and interface stalls.

The implementation deliberately retains invite links as an optional fallback for private rooms. Links are no longer the primary flow for existing friends.

| User outcome | Required behavior |
|---|---|
| New account email | The sign-up request records the browser-derived language as `fa` or `en` in Auth metadata. Hosted email templates use that metadata to render the matching language. |
| Existing account email | The app synchronizes the user’s current PartyPlay language to Auth metadata and profile preference after an authenticated session. Existing users without a stored preference receive the English fallback until their first authenticated app session writes it. |
| Direct two-player game | The initiator chooses a confirmed friend and a supported online game. The recipient presses **Accept and start**; the recipient joins, the invite becomes accepted, and the server starts the two-player session atomically. |
| Group game without a link | The host selects confirmed friends, creates a room with those selected players already represented as participants, and starts the game from the room lobby. Recipients receive an in-app invite and can open the room directly. |
| Private messaging | Only users with an accepted friendship can open a direct conversation, read its messages, or send a new message. Blocking or removing the friendship revokes access. |
| Notification behavior | A panel opens and closes by its own control. Opening an item marks that item as read, and navigating to its destination closes the panel. New realtime items are appended locally rather than reloading the entire feed. |

## 2. Selected architecture

The selected approach uses **stateful direct invitations** rather than adding friends to the existing link-only room flow. The design keeps authority in PostgreSQL RPCs, with the client acting only as a caller and renderer. This preserves the existing security model: a client cannot create a room for arbitrary users, join a room without eligibility, read private messages, or start a game by writing directly to privileged tables.

A single migration, `0021_direct_social_play_messaging_and_performance.sql`, will introduce the data contracts and server-side validation. The web client will receive small bounded adapters for invitations, friend threads, and granular realtime subscriptions. Existing link joining remains intact.

> The application must never infer friendship from a profile lookup, group membership, client-side state, or a notification payload. Every privilege check occurs in the relevant RPC using the authenticated user ID.

## 3. Language and authentication email contract

The client uses `navigator.language` only to determine the initial value for an unauthenticated sign-up. It normalizes `fa*` to `fa` and all other languages to `en`; it never sends an uncontrolled locale string. The sign-up call saves `language` in `auth.users.raw_user_meta_data`, together with existing display name and username fields.

For authenticated users, a small locale-sync operation updates both the Auth metadata language and `pp_profiles.preferred_locale` whenever the PartyPlay language preference is changed. The profile column lets in-app UI, direct-message notifications, and future server-side notification rendering use the same two-value contract.

The hosted Supabase confirmation, magic-link, and recovery templates will use Go template conditions against `.Data.language`. Their Persian branch uses RTL-safe Persian content and their English branch is the fallback. Template subjects use clear bilingual fallback wording only where the dashboard does not support conditional subject rendering. Redirect URLs preserve the selected locale as a query parameter so the destination opens in the same language.

## 4. Direct invitation and friend-room contract

### 4.1 Data model

`pp_game_invites` holds invitations that require an explicit recipient decision. It contains an invitation ID, sender ID, recipient ID, room ID, game type, status (`pending`, `accepted`, `declined`, `cancelled`, `expired`), expiry timestamp, and audit timestamps. A partial unique constraint prevents more than one pending invite from the same room to the same recipient.

Invitation-related activity events are recorded as typed events with machine-readable payloads, not as language-specific authoritative strings. New kinds include `room_invite`, `game_started`, and `direct_message`. Clients resolve display text in the recipient’s language from the type and payload, while old events retain their stored title/body as a fallback.

### 4.2 Server RPCs

`partyplay_create_friend_game_invite` verifies that the target is a confirmed, unblocked friend, verifies a supported two-player game, creates a room with capacity two, inserts the host membership, inserts a pending invitation, and creates a recipient activity event in one transaction.

`partyplay_accept_game_invite` locks and validates the pending invite, revalidates the friendship/block status, adds the recipient to the room, marks the invitation accepted, creates a game-started activity event for both players, and starts the correct server-authoritative two-player session before returning. If any condition fails, none of those changes commit. The decline and cancel RPCs only affect invitations where the current user is allowed to act.

`partyplay_create_friends_room` accepts a supported game type, a display name, and a bounded list of confirmed friend IDs. It validates that every selected user remains an unblocked confirmed friend, creates the room at exactly the selected capacity, adds members, and creates a typed in-app invitation for each recipient. A room host starts the multi-player session from the lobby with the existing game-specific minimum/capacity rules. No join link is required for selected friends; the old link path remains available only as a fallback.

## 5. Private friend messages

A canonical `pp_friend_threads` table stores the lower and higher participant UUIDs in separate columns with a uniqueness constraint. `pp_friend_messages` stores a thread ID, sender ID, body, sent time, and read time; it carries no arbitrary recipient ID supplied by the browser.

`partyplay_open_friend_thread` validates an accepted, unblocked friendship and returns the existing or newly created canonical thread. `partyplay_list_friend_messages` uses cursor pagination, returning a small ordered page. `partyplay_send_friend_message` rechecks the friendship and block state, validates a bounded message body, inserts the message, and creates a direct-message activity event for the other participant. `partyplay_mark_friend_thread_read` marks only messages that belong to the reader’s thread.

RLS policies allow a participant to select a thread or message only after the server-defined participant and friendship checks. Direct writes are denied. Removing a friendship or blocking a profile prevents all new reads and writes through the RPCs. The direct-message surface is lazy-loaded from the friends page and displays only confirmed friends; it has no public profile-search entry point.

## 6. Notification correctness

`NotificationCenter` becomes controlled state owned by the application shell. It closes on its close action, Escape, route navigation, and item activation. It does not depend on an implicit click propagation path. Each activity item invokes `partyplay_mark_activity_read` for only its own ID before navigation; **Mark all read** remains a separate explicit command.

`useActivityFeed` handles realtime events incrementally. An `INSERT` event appends a normalized activity record or triggers one bounded item fetch; an `UPDATE` adjusts only that record’s read state. It must not call the full activity-feed RPC for every update. Browser push continues to use the activity-event path, subject to the recipient’s notification preferences.

## 7. Performance and realtime isolation

The current shared room subscription listens to several tables without room or session filters and causes a full room reload for every change. It will be split into small subscriptions.

| Surface | Subscription scope | Update behavior |
|---|---|---|
| Room membership and session | `pp_rooms`, `pp_room_members`, and `pp_game_sessions`, filtered by room ID | A debounced room-summary refresh. |
| Room chat | `pp_room_messages`, filtered by room and session ID | Append or update only the affected message. |
| Reactions | A relation with an explicit room/session key, filtered by the current room/session | Update only the matching message reaction collection. |
| Mafia private state | `pp_mafia_players`, team messages, reactions, and private state filtered by session ID | Refresh only the relevant private panel. |
| Activity feed | `pp_activity_events`, filtered by recipient ID | Append/patch a single activity item. |
| Direct messages | `pp_friend_messages`, filtered by current thread ID | Append/patch a single message. |

The migration supplies missing filterable keys where needed and indexes invitation, thread, message, and activity lookups. Subscriptions are created only when their page is mounted and are removed on unmount. Full room refreshes use a short debounce and `AbortController`/generation guards so a slow older request cannot overwrite a newer state. Chat, friend picker, and direct-message UI remain lazy-loaded to preserve the fast initial bundle.

## 8. Error handling and safety

The server returns stable error codes for expired invitations, duplicate actions, non-friends, blocked users, capacity conflicts, and unavailable game modes. The UI displays localized messages and provides one retry action only for transient failures. Invite actions are disabled while their command is in flight, and the invite status in local state updates optimistically only after the server confirms success.

A direct invitation cannot circumvent a game’s own player-count rules. In particular, Mafia retains its established minimum and exact-capacity rules. A direct two-player invitation is exposed only for supported two-player online modes.

## 9. Acceptance tests

The release is accepted only after these tests pass against the hosted project:

1. Creating a Persian and an English account produces metadata that selects the correct language branch in the confirmation email template.
2. A confirmed friend receives a direct two-player invite, accepts it, and both users land in a running session without copying a URL.
3. A host selects at least two confirmed friends for a multi-player room; every selected player sees the room in-app without using a link, and the host starts within the valid game rules.
4. A non-friend, a removed friend, and a blocked user cannot open, list, or send a private message.
5. A friend can exchange messages in both directions; unread state and direct-message notifications update correctly.
6. Opening a notification, navigating through it, and clicking outside/close leave no stuck panel and update the read count correctly.
7. Room chat and notifications update on realtime inserts without triggering broad full-room reload loops.
8. Production build succeeds and the public GitHub Pages version supports Persian and English directionality.

## References

[1] Supabase. [Customizing emails by language](https://supabase.com/docs/guides/troubleshooting/customizing-emails-by-language-KZ_38Q).

[2] Supabase. [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
