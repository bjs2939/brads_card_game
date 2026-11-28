# Permanent accounts and rated matches

The current profile name is a local browser label. It is not a verified account identity and must not be used as an Elo key. The existing `multiplayer/elo.mjs` computes Elo changes; `multiplayer/account-ratings.mjs` now defines an idempotent ledger update keyed by stable account subjects and match IDs.

Before rated matchmaking goes live:

1. Create a Cognito User Pool and public SPA client, configure the game's production and local callback URLs, and use Authorization Code with PKCE. Do not put a client secret in the browser.
2. Verify Cognito JWTs on the server (issuer, audience/client ID, signature, expiration) and use the verified `sub` as the account ID. Keep anonymous VS Friend rooms playable but unrated.
3. Put account profiles, ratings, and processed match IDs in a durable server database. Apply `recordRatedMatch` in one transaction at a trusted match result, once per match. Never accept an Elo result or subject ID directly from the browser.
4. Expose a read-only profile/rating endpoint, then connect the profile UI to sign-in and account data. Test reconnects, duplicate result submissions, abandoned games, and two simultaneous match completions.

No Cognito resources, credentials, paid services, or live ratings are provisioned by this change.
