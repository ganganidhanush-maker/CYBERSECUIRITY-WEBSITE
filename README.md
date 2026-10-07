# Cyber Security Club MRDU portal

This is the production-oriented Cyber Security Club portal: React/Vite client, Express API, MySQL/Prisma database, and HTTP-only encrypted server-side sessions. The browser has no password, role, or session-token storage.

## Security controls

- SameSite=Strict, HTTP-only cookies; Secure cookies and HSTS in production
- AES-256-GCM encrypted session records in MySQL
- CSRF tokens on every state-changing request
- CSP, Permissions-Policy, secure CORS allowlist, request IDs, and rate limits
- Strong passwords, bcrypt work-factor configuration, login lockout, and logout-all-devices
- TOTP multi-factor authentication endpoints with encrypted secrets
- Time-limited, hashed password-reset tokens; SMTP delivery is required in production
- Parameter validation, President-only authorization, permission boundaries, hashed User-Agent audit records, and scheduled audit-log retention

## First local setup

1. Install Node.js 20 or newer and the project dependencies:

   ```powershell
   npm install
   ```

2. Create the ignored local configuration. This must be done before starting the included Docker database because its setup reads `.env`. The setup command generates unique session keys and writes the initial President account configuration; it does not print or commit the password.

   ```powershell
   $env:CSC_INITIAL_PASSWORD = '<your President password>'
   npm run setup:local-env
   Remove-Item Env:CSC_INITIAL_PASSWORD
   ```

3. Start a local MySQL/MariaDB database. If Docker Desktop is available, the included command creates a persistent MariaDB container, generates a unique local database password, and updates `DATABASE_URL` in `.env`:

   ```powershell
   npm run db:local:start
   ```

   If Docker is unavailable but MariaDB Server 12.3 is installed, use the native fallback:

   ```powershell
   npm run db:local:start-native
   ```

   Otherwise, create the `cyber_security_club` database and an application user with only the privileges this database needs, then set `DATABASE_URL` in `.env` to those credentials. Never copy a secret into a `VITE_` variable.

4. Prepare the database and provision the President account:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   Seeding creates the configured President only when it does not already exist. It never resets an existing President password. Regular accounts are created through President-only APIs.

5. Run locally:

   ```powershell
   npm run dev
   ```

   The React client is available at `http://localhost:5173`. Its `/api` requests proxy to the local Express API at `http://localhost:3000`, so development uses the same cookie and API paths as deployment.

## Production deployment

1. Build the client with `NODE_ENV=production npm run build`.
2. Set `NODE_ENV=production`, an HTTPS `CORS_ORIGIN` allowlist, and a reachable MySQL `DATABASE_URL` in the deployment secret manager. Set an HTTPS `PUBLIC_APP_URL` for password-reset links; Render, Railway, and Vercel public URLs are detected as a fallback. Configure SMTP to deliver password-reset email.
3. Apply migrations with `npm run db:migrate`, then launch `npm start` behind HTTPS. The Express server serves `dist` and the versioned API from one origin.

The server fails startup when its database is unreachable. SMTP is optional, but password recovery email is disabled until SMTP and a public application URL are available.

## API

The live OpenAPI document is at `GET /api/v1/docs`; health is `GET /api/v1/health`. Primary endpoints include:

- `POST /api/v1/auth/login`, `/verify-2fa`, `/logout`, `/logout-all-devices`
- `POST /api/v1/auth/forgot-password`, `/reset-password`
- `POST /api/v1/auth/two-factor/setup`, `/two-factor/confirm`, `/two-factor/disable`
- `GET /api/v1/auth/csrf`, `/me`
- `GET|POST /api/v1/admin/members`; `PUT /api/v1/admin/members/:id/status|permissions`
- `GET /api/v1/admin/audit-logs` and `GET /api/v1/member/dashboard`

State-changing API requests must first retrieve `/api/v1/auth/csrf` and then send its `csrfToken` as `X-CSRF-Token`. `src/lib/api.js` performs this automatically for the included browser client.

## Verification

```powershell
npm run build
npm run lint
npm test
npm run audit:dependencies
```

Run database-backed checks after MySQL is configured: `npm run db:migrate`, `npm run db:seed`, then `npm run dev` and visit `/api/v1/health`.
