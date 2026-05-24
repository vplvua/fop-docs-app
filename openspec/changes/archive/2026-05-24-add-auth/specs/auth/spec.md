## ADDED Requirements

### Requirement: Admin sign-in via email and password

The system SHALL allow a single administrator to sign in at `/login` using an email and password. Credentials are not stored in the database — the system MUST verify the submitted email against the `ADMIN_EMAIL` environment variable and the submitted password against the `ADMIN_PASSWORD_HASH` environment variable (argon2id hash). On success the system SHALL create a server-side session and set a session cookie. On failure the system SHALL return a single generic error message in Ukrainian ("Невірний email або пароль") without disclosing whether the email or the password was wrong.

Covers: FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, NFR-SEC-03.

#### Scenario: Successful sign-in

- **WHEN** the admin submits the `/login` form with email matching `ADMIN_EMAIL` and password whose argon2id verification against `ADMIN_PASSWORD_HASH` returns true
- **THEN** the server SHALL create a `sessions` row, set an HTTP-only `Secure` `SameSite=Lax` cookie carrying an opaque random token (≥ 32 bytes of CSPRNG entropy), and redirect the browser to `/` (or to the `next` query parameter if present and same-origin)

#### Scenario: Wrong password

- **WHEN** the admin submits a form whose email matches `ADMIN_EMAIL` but the password fails argon2id verification
- **THEN** the response SHALL render the `/login` page with the generic error "Невірний email або пароль", no session cookie SHALL be set, and a `login_attempts` row with `success = false` SHALL be inserted

#### Scenario: Wrong email

- **WHEN** the admin submits a form whose email does not match `ADMIN_EMAIL`
- **THEN** the response SHALL behave exactly as the wrong-password scenario (same error text, same `login_attempts` insert) — the system MUST NOT disclose which field was wrong

#### Scenario: Empty form submission

- **WHEN** the admin submits the `/login` form with empty email and/or password fields
- **THEN** the response SHALL render the `/login` page with field-level validation errors in Ukrainian, no session cookie SHALL be set, and no `login_attempts` row SHALL be inserted (validation happens before rate-limit accounting)

### Requirement: Session persistence and validation

The system SHALL persist each active session as a row in the `sessions` table keyed by the HMAC-SHA-256 of the raw token using `SESSION_SECRET` as the key. The cookie sent to the browser contains the raw token; the database stores only its HMAC. Sessions SHALL expire 30 days after creation. On every request the system MUST treat a missing, malformed, or expired session as unauthenticated.

Covers: FR-AUTH-03, NFR-SEC-01.

#### Scenario: Returning request with valid session

- **WHEN** a request arrives carrying a session cookie whose HMAC matches a `sessions` row with `expires_at > now()`
- **THEN** the request SHALL be treated as authenticated and routed to its target handler without redirect

#### Scenario: Expired session

- **WHEN** a request arrives carrying a session cookie whose `sessions` row has `expires_at <= now()`
- **THEN** the system SHALL treat the request as unauthenticated and SHALL delete the expired row opportunistically (best-effort cleanup)

#### Scenario: Tampered or unknown token

- **WHEN** a request arrives with a session cookie whose HMAC does not match any row in `sessions`
- **THEN** the system SHALL treat the request as unauthenticated and SHALL clear the cookie in the response

### Requirement: Sign-out destroys session

The system SHALL provide a sign-out action that deletes the current session row from the database and clears the session cookie in the response. Sign-out SHALL be idempotent — calling it without a valid session SHALL still clear the cookie and return successfully.

Covers: FR-AUTH-04.

#### Scenario: Sign-out from authenticated state

- **WHEN** the admin invokes the sign-out server action while authenticated
- **THEN** the `sessions` row keyed by the current token's HMAC SHALL be deleted, the session cookie SHALL be cleared (`Max-Age=0`), and the browser SHALL be redirected to `/login`

#### Scenario: Sign-out without a session

- **WHEN** the sign-out server action is invoked with no session cookie or an unknown token
- **THEN** the response SHALL still clear the cookie and redirect to `/login` (no error surfaced)

### Requirement: IP-based rate limit on sign-in attempts

The system SHALL reject any sign-in attempt from a client IP that has accumulated 10 or more failed `login_attempts` rows within the preceding 60 minutes. The 60-minute window is sliding (computed at request time as `attempted_at > now() - interval '60 minutes'`). A successful sign-in SHALL reset the counter by deleting all failed `login_attempts` rows for that IP.

Covers: FR-AUTH-05.

#### Scenario: Counter increments on failure

- **WHEN** a sign-in attempt from IP `X` fails
- **THEN** a `login_attempts` row with `ip = X` and `success = false` SHALL be inserted, and the response SHALL render the generic error message

#### Scenario: Block on 10th failure within window

- **WHEN** a sign-in attempt from IP `X` arrives and there are already 10 or more `login_attempts` rows with `ip = X`, `success = false`, and `attempted_at > now() - interval '60 minutes'`
- **THEN** the system SHALL skip argon2id verification, SHALL NOT insert a new `login_attempts` row, SHALL respond with a Ukrainian message indicating "Забагато спроб. Спробуйте через ~Xхв" where X is rounded-up minutes until the oldest failed attempt in the window falls outside it, and the HTTP status code SHALL be 429

#### Scenario: Counter resets on success

- **WHEN** a sign-in attempt from IP `X` succeeds (after fewer than 10 failures in the window)
- **THEN** the system SHALL insert a `success = true` row and SHALL delete all `success = false` rows for `ip = X`, so a subsequent failure starts counting from 1

#### Scenario: Window expires naturally

- **WHEN** more than 60 minutes pass without new failed attempts from IP `X`
- **THEN** previously recorded failures SHALL no longer count toward the limit (they remain in the table but fall outside the sliding window)

### Requirement: Route protection via proxy.ts

The system SHALL gate all routes behind the session check in `proxy.ts`. Requests without a valid session SHALL be redirected to `/login?next=<path>` where `<path>` is the original request path including search params, URL-encoded. The following paths SHALL be exempt from the gate and SHALL be reachable without a session: `/login`, `/api/health`, and Next.js static asset paths (`/_next/static/*`, `/_next/image*`, `/_next/data/*`, `/favicon.ico`). An authenticated request to `/login` SHALL be redirected to `/`.

Covers: FR-AUTH-06.

#### Scenario: Unauthenticated request to protected page

- **WHEN** an unauthenticated request arrives at `/clients`
- **THEN** the proxy SHALL respond with HTTP 307 redirect to `/login?next=%2Fclients`

#### Scenario: Unauthenticated request to whitelisted path

- **WHEN** an unauthenticated request arrives at `/api/health` or `/login`
- **THEN** the proxy SHALL pass the request through without redirect

#### Scenario: Authenticated request to /login

- **WHEN** an authenticated request arrives at `/login`
- **THEN** the proxy SHALL respond with HTTP 307 redirect to `/`

#### Scenario: Static asset request bypasses session check

- **WHEN** a request arrives at `/_next/static/chunks/main.js` or `/favicon.ico`
- **THEN** the proxy SHALL pass the request through without session lookup (no DB query on the static path)

#### Scenario: Post-login redirect honors safe next parameter

- **WHEN** sign-in succeeds and the form carried `next=/clients/new`
- **THEN** the response SHALL redirect to `/clients/new` (same-origin, leading-slash path)

#### Scenario: Post-login rejects external next parameter

- **WHEN** sign-in succeeds and the form carried `next=https://evil.example/`
- **THEN** the system SHALL ignore the unsafe `next` value and redirect to `/`

### Requirement: Secrets are never logged or echoed

The system MUST NOT log, return in error messages, or otherwise echo the values of `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, raw session tokens, or the user-submitted password. Existing pino redact rules in `lib/logging/` apply; this requirement extends them to the auth surface specifically.

Covers: NFR-SEC-01, NFR-SEC-06.

#### Scenario: Failed sign-in log entry

- **WHEN** a sign-in attempt fails for any reason
- **THEN** the structured log entry MAY include `ip`, `email_attempted` (the submitted email — already public-ish for the admin), and the failure code, but MUST NOT include the submitted password or any session token

#### Scenario: Rate-limit log entry

- **WHEN** a request is blocked by the rate limiter
- **THEN** the structured log entry SHALL include `ip`, `attempts_in_window`, and `retry_after_seconds`, but MUST NOT include credentials
