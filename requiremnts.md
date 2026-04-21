Social Login (Google & Apple) - Detailed Backend Guide
This document expands the previous guide with detailed parameter lists for each endpoint and a step-by-step, runnable guide for revoking/unlinking Google and Apple social logins. It includes example requests (curl), Node.js snippets, database update steps, and audit suggestions.
1. Endpoint Parameters (detailed)
1.1 POST /auth/register
Purpose: Register a new user with email and password or attach a password to an existing social-only account.
Request (JSON):
{
  "email": "user@example.com",
  "password": "P@ssw0rd!",
  "fullName": "Ravi Kumar"
}
Server behaviors and parameter notes:
- email (string, required): The user's email address. Must be unique.
- password (string, required): Any user type
- fullName (string, optional but recommended): Display name for the account.
1.2 POST /auth/login
Purpose: Login with email and password.
Request (JSON):
{
  "email": "user@example.com",
  "password": "P@ssw0rd!"
}
1.3 POST /auth/social
Purpose: Unified social sign-in / sign-up for Google and Apple. The client should send whichever proof (id_token or authorizationCode) it has; the server must verify tokens server-side.
Request (JSON) — recommended fields:
{
  "provider": "google" | "apple",            // required
  "idToken": "eyJhbGciOi...",               // preferred (OIDC id_token) - optional if code provided
  "accessToken": "ya29.a0AR...",            // optional, rarely needed for authentication
  "authorizationCode": "c.abc123",          // optional - used by server to exchange for tokens (Apple flow)
  "redirectUri": "https://yourapp.com/cb",  // optional - when code was issued with redirect
  "nonce": "randomString",                  // optional - if used in client to mitigate replay
  "clientId": "com.example.app"             // optional - server usually has configured client id
}
Field details:
- provider: must be 'google' or 'apple'.
- idToken: For Google, the OIDC id_token is signed and contains email, sub (googleId), email_verified. For Apple, id_token is a JWT with 'sub' (appleId) and 'email' possibly present only in the first authorization. Always verify server-side. (See verification steps below.)
- authorizationCode: Use when the client performed an Authorization Code flow and you prefer the server to exchange code for tokens (required for Apple web/native flows if you need refresh tokens).
- redirectUri & clientId: Required by some flows where the code was generated with a redirect; include only if applicable.
1.4 POST /auth/unlink (or /auth/revoke)
Purpose: Unlink / revoke provider access and remove stored provider identifiers & tokens.
Request (JSON):
{
  "provider": "google" | "apple",
  "userId": "60a7e8f..."
}
Server actions: Fetch user's stored provider tokens (refresh/access), call provider revoke endpoint if available, delete social.<provider>Id and tokens.<provider> from DB, add audit record providerUnlinkedAt, and return success/failure.
2. Token verification (server-side)
2.1 Google (recommended)
- Verify the id_token using google-auth-library (verifyIdToken). Confirm:
  * payload.sub (googleId) - use to identify/link account
  * payload.email - user's email
  * payload.email_verified - boolean
  * payload.aud - must match your GOOGLE_CLIENT_ID
  * payload.iss - should be 'accounts.google.com' or 'https://accounts.google.com'
2.2 Apple
- Verify id_token JWT using Apple's JWKS at https://appleid.apple.com/auth/keys and check claims:
  * payload.sub (appleId) - stable unique id to link accounts
  * payload.email - may be present only on the initial authorization and may be a private relay email
  * payload.aud - should match your client_id (Service ID)
  * payload.iss - should be 'https://appleid.apple.com'
3. Apple token exchange (POST https://appleid.apple.com/auth/token) - parameters
Required form-encoded parameters (common flows):
- client_id (string) — the Service ID (your app's client id).
- client_secret (string) — a JWT you generate (ES256) signed with your private key from Apple (the .p8 key). See 'Creating a client secret' in Apple docs for claims and expiration rules.
- code (string) — the authorization code returned by Apple's authorization endpoint (for grant_type=authorization_code).
- grant_type (string) — one of 'authorization_code' or 'refresh_token'. Use 'authorization_code' when exchanging a newly-issued code. Use 'refresh_token' to obtain new tokens using a saved refresh token.
- redirect_uri (string) — include if your authorization request included a redirect URI and it must match.
Optional/other fields:
- refresh_token (string) — for grant_type=refresh_token.

Example curl to exchange authorization code:
curl -v -X POST "https://appleid.apple.com/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=GENERATED_CLIENT_SECRET" \
  -d "code=AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code"
Apple docs: token & revoke endpoints and client_secret generation provide exact parameter names and requirements.
4. Apple client_secret (JWT) - claims & creation
Create a JWT (signed with ES256 using your .p8 key) with the following claims:
- iss: Your 10-character Team ID from Apple Developer account.
- iat: Issued-at time (numeric date).
- exp: Expiration time (numeric date). Apple enforces a maximum lifetime; check Apple docs when generating. Typically set exp to iat + (max 6 months recommended).
- aud: 'https://appleid.apple.com'
- sub: client_id (your Service ID)
The JWT header should include 'alg': 'ES256' and 'kid' as the Key ID assigned by Apple for your private key. Save the .p8 private key securely and do not expose it on client apps. See Apple docs for exact rules and limits.
5. Revoke / Unlink - Apple (step-by-step, server-side)
Preconditions: You must have stored (and encrypted) the user's refresh token or access token from Apple when you originally exchanged the authorization code. If you do not have any token for the user, server-side revoke is not possible and you must instruct the user to remove the app from their Apple ID settings manually.
Step-by-step server flow:
1) Retrieve the user's record from the DB (by userId or session) and find tokens.apple.refreshToken (encrypted).
2) If no refreshToken or accessToken is stored -> abort revoke and return a response telling the client to guide the user to remove the app from Apple ID settings (manual unlink).
3) Decrypt the refresh token using your server's KMS or encryption key.
4) Generate client_secret JWT as described in Section 4.
5) Make a POST request (application/x-www-form-urlencoded) to https://appleid.apple.com/auth/revoke with parameters: client_id, client_secret, token (the refresh token), token_type_hint=refresh_token (optional).
6) If response is HTTP 200 (success) -> remove social.appleId and tokens.apple from DB, set providerUnlinkedAt and store an audit log entry with request/response (avoid storing the plain token in logs).
7) If response is an error (400/401) -> log detailed error, consider retry/backoff for 5xx, and return a meaningful message to client.
8) Return success to the client when DB cleanup and token revoke succeeded.

Example curl (Apple revoke):
curl -v -X POST "https://appleid.apple.com/auth/revoke" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_GENERATED_CLIENT_SECRET" \
  -d "token=REFRESH_OR_ACCESS_TOKEN" \
  -d "token_type_hint=refresh_token"
6. Revoke / Unlink - Google (step-by-step, server-side)
Google allows programmatic revocation via the OAuth2 revoke endpoint. Note: the revoke endpoint may revoke a user's grant for your app entirely; revoking one token can revoke other tokens associated to your app for that user.
Step-by-step server flow:
1) Retrieve user's record and find tokens.google.refreshToken or tokens.google.accessToken (encrypted).
2) If no token is present -> no server-side revoke possible; consider asking the user to revoke the app from Google Account -> Security -> Third-party apps with account access.
3) Decrypt the token.
4) Make a POST request to https://oauth2.googleapis.com/revoke with form parameter 'token' set to the refresh or access token. Example: POST https://oauth2.googleapis.com/revoke?token=TOKEN or POST form payload token=TOKEN.
5) On HTTP 200 -> remove social.googleId and tokens.google from DB, mark providerUnlinkedAt and add audit log entry.
6) On error (400/401) -> analyze; 400 means invalid token (treat as success for cleanup but log), 429/5xx -> backoff and retry.
7) Return success to client.

Example curl (Google revoke):
curl -X POST --header "Content-type:application/x-www-form-urlencoded" \
  --data "token=REFRESH_OR_ACCESS_TOKEN" \
  "https://oauth2.googleapis.com/revoke"
7. Example Node.js snippets (revoke)
Apple revoke (using node-fetch or axios):

const fetch = require('node-fetch');

async function revokeAppleToken(refreshToken) {
  const clientSecret = generateAppleClientSecret(); // implement per Section 4 (ES256 p8)
  const params = new URLSearchParams();
  params.append('client_id', process.env.APPLE_CLIENT_ID);
  params.append('client_secret', clientSecret);
  params.append('token', refreshToken);
  params.append('token_type_hint', 'refresh_token');

  const res = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    body: params.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Apple revoke failed: ' + res.status + ' ' + text);
  }
  return true;
}


Google revoke (using axios):

const axios = require('axios');

async function revokeGoogleToken(token) {
  const params = new URLSearchParams();
  params.append('token', token);
  const res = await axios.post('https://oauth2.googleapis.com/revoke', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return res.status === 200; // Google returns 200 on success, 400 if invalid token
}


8. Database cleanup & audit suggestions
- On successful revoke: atomically unset social.<provider>Id and tokens.<provider>, set providerUnlinkedAt, and insert an audit record in a separate collection (userId, provider, action: 'unlinked', timestamp, ip, requestId).
- If revoke fails but token is invalid: still perform DB cleanup and log the server response for investigation.
- Maintain logs but never store raw tokens in plain text logs; store only hashed or masked values if needed for troubleshooting.
9. User-facing steps to remove Sign in with Apple (iOS and Web)
iOS (or iPadOS) steps:
1) Open Settings → Tap your name (Apple ID banner).
2) Tap 'Password & Security'.
3) Tap 'Apps Using Apple ID' or 'Sign in with Apple' (label varies by iOS version).
4) Find your app in the list and tap it → Choose 'Stop Using Apple ID' / 'Remove'.

Web steps:
1) Visit https://appleid.apple.com and sign in with your Apple ID.
2) Go to 'Security' or 'Sign-in & Security' → 'Apps & Websites using Apple ID' or 'Apps Using Apple ID'.
3) Find and remove the app.
10. Edge cases & recommended behavior
- If a social provider gives you a proxied email (Apple Hide My Email), never rely solely on email for identity; use provider 'sub' as canonical id. Save the proxied email for contact use only.
- If a user registered via Apple (social-only) and you do not have a refresh token, you cannot programmatically revoke; instruct the user to remove the app from Apple ID settings and optionally show a help article.



App Flow

Google button (typical)
User taps “Continue with Google.”
Google’s SDK shows account picker → returns an ID Token (idToken) to your app. 
Your app sends this to your backend → POST /auth/social with:


provider: "google"
idToken: "<google_jwt_here>"
Apple button (best practice)
User taps “Sign in with Apple.”
Apple returns an ID Token and (on first consent) an Authorization Code.
Your app sends to backend → POST /auth/social with:
provider: "apple"
idToken: "<apple_jwt_here>"
authorizationCode: "<code_from_apple>" (important if you want revocation later)
B. What happens on your server (MongoDB-aware)
Step 1 — Verify the token (security)
Google: Verify the idToken with Google’s public keys. Extract:


sub → googleId (the one true Google identifier)


email, email_verified


Apple: Verify Apple idToken (and if you received authorizationCode, exchange it once to get Apple refresh token).


sub → appleId


email (might only appear on the very first login and can be “Hide My Email” relay)


Step 2 — Find or create the user (MongoDB)
Look up by provider ID first:


social.googleId == sub (for Google) or social.appleId == sub (for Apple).


If found → Login success (proceed to Step 3).


If not found, check by email (if you have one):


If there’s an existing email+password user:


Safer policy (recommended): return a clear error →
 “This email already exists with a different method. Please log in with email/password, then link Google/Apple from settings.”
 (Prevents accidental account split.)


Alternative: if you truly want auto-merge, do it only when email_verified === true and you’ve fully assessed risk.


If no existing user with that email:


Create a new user document:


email, fullName (if available), loginType: "google"/"apple"


social.googleId or social.appleId


Apple only: store tokens.apple.refreshToken (encrypted) if you exchanged the code.


Step 3 — Issue your app session
Create your app’s access/refresh tokens (or session cookie) and send back:


userId, email, fullName


loginType: "google" | "apple" | "email"


any flags/entitlements your app needs


From now on, that device is logged in—no password screen.

C. Logging in next time
User taps Google/Apple again → app gets a fresh idToken → sends to /auth/social → backend recognizes the same providerId → instantly logs in and returns session.


No password is ever shown for social-only users.



D. Linking & Unlinking (optional but valuable)
Link (attach) a provider to an existing account
User is already logged in (email user).


In “Account → Linked Accounts,” they tap “Link Google/Apple.”


App repeats the token step, but calls /auth/social/link.


Server verifies token and adds social.googleId or social.appleId to that same user doc.


UI now shows both providers as “linked.”


Benefit: They can log in via either method in the future.


Unlink (detach) a provider
User taps “Unlink Google/Apple.”


App calls /auth/unlink.


Server:


For Apple/Google: calls the provider revoke endpoint (if you stored refresh token).


Removes social.<provider>Id (and tokens) from MongoDB.


Adds an audit entry; returns success.


If a user is social-only and unlinks their only provider, you should require them to set a password first (or block unlink) so they don’t lock themselves out.



