# PartyPlay Account Access and Deletion Design

**Owner:** okok-gif9  
**Status:** Approved for implementation  
**Date:** 2026-08-20

## 1. Purpose and scope

PartyPlay currently supports passwordless email links only. This change keeps that low-friction entry method while adding three account capabilities: an optional password after the user has authenticated once, Google OAuth sign-in, and account deletion with a 30-day recovery window.

The scope is deliberately limited to the web client and the existing Supabase project. No secret key, credential, or privileged browser access will be exposed. Google OAuth will use the Supabase OAuth provider and Google Cloud credentials configured only in their respective dashboards.

## 2. Account-entry model

| Method | Availability | User flow | Notes |
|---|---|---|---|
| Magic link | Retained | Enter email, receive a sign-in link | Continues to create a first account where signup is allowed. |
| Password | Added after first verified sign-in | Set a password from Account Security, then sign in with email and password | Password is handled by Supabase Auth and never stored by PartyPlay. |
| Google | Added | Select Continue with Google, then return to the same PartyPlay URL after consent | Requires an OAuth client in Google Cloud and enabling Google in Supabase. |

The sign-in screen will offer an explicit method chooser. Magic link remains the default because it is already familiar to PartyPlay users. Password entry is available to users who have previously set one. The Google button is rendered only when OAuth has been configured successfully; until then the UI shows an accurate setup state rather than a non-functional control.

## 3. Account Security surface

The existing profile experience will gain a dedicated Account Security section. It contains a password setup or change form, a session sign-out control, a clear description of the active sign-in options, and a danger zone for account deletion.

Password changes require an authenticated session and use `supabase.auth.updateUser`. Password sign-in uses `supabase.auth.signInWithPassword`. The web client sends only the user-entered password to Supabase over its authenticated HTTPS connection and does not log, cache, display, or store it.

Google sign-in uses `supabase.auth.signInWithOAuth({ provider: 'google' })` with a redirect back to the current PartyPlay origin and path. The following callback URL must be registered in both providers:

```text
https://mpwdwarcvohxwxqzedrm.supabase.co/auth/v1/callback
```

The PartyPlay production URL must also be registered in Supabase Auth URL Configuration:

```text
https://okok-gif9.github.io/partyplay/
```

## 4. Account deletion and recovery

Deletion is a two-stage process. A user must enter a fixed confirmation phrase and explicitly choose Delete Account. The browser immediately signs the account out and PartyPlay records a deletion request with a purge deadline 30 days later.

During the recovery window, the account is not presented as active in the PartyPlay product. Signing in again through any verified method restores the profile by cancelling the deletion request. This makes the recovery decision intentional while avoiding a support-only recovery path.

After the deadline, a server-side purge procedure deletes the corresponding Auth user. The existing foreign-key cascades remove the profile and its dependent PartyPlay records. The procedure is designed to be invoked by a scheduled database job; if a scheduler is unavailable, it can be run through a tightly restricted administrative operation. No account data is removed before the deadline.

| State | User experience | Data treatment |
|---|---|---|
| Active | Normal sign-in and play | Normal profile and game data. |
| Pending deletion | Signed out immediately | Recovery request and purge deadline retained. |
| Recovered within 30 days | User signs in normally | Pending deletion request is cancelled. |
| Purged after 30 days | No sign-in is possible | Auth user and cascading PartyPlay data are removed. |

## 5. Database interfaces and security

A migration will add an account deletion request table, private access policies, and four narrowly scoped functions: request deletion, restore a pending account after verified sign-in, return account security state, and purge requests past their deadline. All browser calls use the public Supabase anonymous client with authenticated user context. Browser code receives no service role key.

The deletion request is bound to `auth.uid()` and cannot target another user. The purge procedure does not accept an arbitrary user ID from the browser. Account security state contains only non-sensitive flags and timestamps; it never returns authentication secrets, password metadata, or OAuth credentials.

## 6. UI components and state boundaries

| Unit | Responsibility | Dependencies |
|---|---|---|
| `AuthGate` | Choose magic link, password, or OAuth entry; show method-specific errors | Supabase Auth and translations. |
| `AccountSecurity` | Set password, initiate deletion, show recovery information | Auth session and account-security RPCs. |
| `useAccountSecurity` | Loads security state and performs scoped mutations | Typed functions in `partyplay.ts`. |
| Account deletion migration | Stores deadlines and enforces deletion/recovery operations | Supabase Auth, `pp_profiles`, database scheduler. |

Each component has a single purpose. Authentication UI does not make direct database table queries, and the account-security hook does not contain visual styling or page navigation decisions.

## 7. Failure handling and acceptance tests

Errors from expired links, unknown passwords, rate limiting, unavailable OAuth configuration, malformed confirmation phrases, and already-purged accounts receive direct, localized messages. The sign-in screen must remain usable if Google has not yet been configured.

Acceptance requires a successful production build and checks that: magic-link sign-in continues to work; a signed-in user can set a password and use it to sign in; the Google button correctly starts OAuth only after provider setup; account deletion signs the user out; a simulated recovery cancels the deletion request; and unauthenticated or non-owner deletion attempts are rejected by the database.

## 8. Moderation and account enforcement

The admin console gains a per-user moderation surface within the existing user detail workflow. Every administrative action requires a reason, records the acting administrator and timestamp, and is written to the existing immutable audit trail. An administrator cannot moderate or delete their own account.

| Action | Effect | Reversal and safety |
|---|---|---|
| Restrict | Blocks room creation, online play, chat, friend requests, group changes, and other social mutations while preserving sign-in and the profile. | A fixed expiry of 24 hours, 7 days, 30 days, or no expiry; the administrator can clear it early. |
| Suspend | Blocks all PartyPlay product actions while preserving data. | The administrator can reinstate the account from the same user detail page. |
| Schedule deletion | Uses the same 30-day recovery flow that a user can initiate personally. | Requires a reason and a double confirmation. The user can still recover through verified sign-in during the window. |
| Purge now | Permanently deletes the Auth user and cascading PartyPlay data. | Requires typing the user's username and a reason. It is unavailable for the acting administrator. |

Product RPCs must call a single account-status guard before creating or changing game, social, message, or group state. Direct table access continues to be governed by RLS. Account security and basic profile reads remain available to a restricted user so that the account can be understood, recovered, or remediated.

## 9. Scheduled purge

A deterministic daily database job invokes the private purge procedure. The job only processes deletion requests whose `purge_after` deadline has passed and skips active, restored, restricted, and suspended accounts. The manual administrator purge action remains available for exceptional moderation cases. The job emits an audit record for every irreversible deletion.

## 10. Out of scope

This change does not add social-account merging, multi-factor authentication, payment identity, or an email-password migration campaign. It does not request, store, or transmit Google OAuth secrets through GitHub, PartyPlay source files, chat messages, or the browser client.
