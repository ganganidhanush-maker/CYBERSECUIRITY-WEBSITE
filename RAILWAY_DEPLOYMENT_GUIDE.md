# Railway Deployment Guide — Cyber Security Club Portal

This guide provides simple, step-by-step instructions for deploying your website to [Railway](https://railway.app).

---

## Step 1: Create a Project on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `CYBERSECURITY WEBSITE` repository.

---

## Step 2: Add a MySQL Database on Railway

1. In your Railway project canvas, click **+ Create** → **Database** → **Add MySQL**.
2. Railway will spin up a cloud database instance and automatically provide a `MYSQL_URL` / `DATABASE_URL`.

---

## Step 3: Configure Environment Variables

In your Railway web service settings, go to the **Variables** tab and configure your production environment variables:

| Variable Name | Recommended Value / Notes |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (or reference variable from your MySQL service) |
| `PORT` | `3000` |
| `SESSION_SECRET` | Generate a random 64-character string (e.g. run `openssl rand -base64 48`) |
| `SESSION_ENCRYPTION_KEY` | Generate a random 32-byte base64 key (e.g. run `openssl rand -base64 32`) |
| `PRESIDENT_MEMBER_ID` | Your intended President Member ID (e.g. your college roll/member number) |
| `PRESIDENT_INITIAL_PASSWORD` | Strong initial password (at least 12 chars with upper, lower, number, symbol) |
| `PRESIDENT_NAME` | Name of the club president |
| `VITE_API_BASE_URL` | `/api/v1` |

*(Optional for Email Recovery: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`)*

---

## Step 4: Access Your Live Portal

1. On your Web Service panel, click **Settings** → **Networking** → **Generate Domain**.
2. Visit your domain and log in with the `PRESIDENT_MEMBER_ID` and `PRESIDENT_INITIAL_PASSWORD` you configured in Step 3.
