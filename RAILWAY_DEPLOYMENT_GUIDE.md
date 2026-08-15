# Railway Deployment Guide — Cyber Security Club Portal

This guide provides simple, step-by-step instructions for deploying your website to [Railway](https://railway.app).

---

## Step 1: Create a Project on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `CYBERSECURITY WEBSITE` repository.

---

## Step 2: Add a MariaDB / MySQL Database on Railway

1. In your Railway project canvas, click **New** → **Database** → **Add MySQL** (or **Add MariaDB**).
2. Railway will spin up a cloud database instance and automatically provide a `DATABASE_URL`.

---

## Step 3: Configure Environment Variables

In your Railway web service settings, go to the **Variables** tab and add the following:

| Variable Name | Recommended Value / Notes |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{MySQL.DATABASE_URL}}` (Select from Railway Reference Variable or paste the database connection URL) |
| `SESSION_SECRET` | `IsxziOPEC-xh7F0MLX5PGcEXZeMjOxnqRS9vvT4HgYWESsXy-9TRuCSNh5kQ-hSn` (or any random 32+ character string) |
| `SESSION_ENCRYPTION_KEY` | `bvwvqKm85SqF4N2pUlpFCNTDOAoSn/QOxofnCIO6Ibg=` (32-byte base64 key) |
| `SESSION_MAX_AGE_MS` | `86400000` (24 hours) |
| `BCRYPT_ROUNDS` | `12` |
| `PRESIDENT_MEMBER_ID` | `25EU07R0015` |
| `PRESIDENT_INITIAL_PASSWORD` | `Dh@nush@dmin_csmrdu2029` |
| `PRESIDENT_NAME` | `Dhanush` |
| `VITE_API_BASE_URL` | `/api/v1` |

*(Optional for Email Recovery: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`)*

---

## Step 4: Run Initial Database Migration on Railway

Railway will automatically run `npm run build` (`prisma generate && vite build`) and start the server with `node server/server.js`.

To seed or apply migrations on your Railway database:
1. Open the Railway web service terminal (or run from your local terminal with Railway CLI):
   ```bash
   npx prisma migrate deploy
   ```
2. Run the account setup script to make sure the President account exists:
   ```bash
   node scripts/fix-login.js
   ```

---

## Step 5: Default Login Credentials

- **Primary President Admin**:
  - **Member ID**: `25EU07R0015`
  - **Password**: `Dh@nush@dmin_csmrdu2029`
- Once logged in, you can create new members with any of the 10 club roles from the **Members** command center!
