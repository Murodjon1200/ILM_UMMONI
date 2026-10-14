# Ilm Ummoni

Ilm Ummoni is a full-stack educational center management platform for administrators, teachers, students, and the center owner. It provides role-based dashboards for courses, enrollments, attendance, grades, schedules, payments, applications, news, and business statistics.

The application supports Uzbek, Russian, and English through locale-prefixed routes such as `/uz`, `/ru`, and `/en`.

## Features

- Phone-number authentication using the `998XXXXXXXXX` format
- Role-based access for `OWNER`, `ADMIN`, `TEACHER`, and `STUDENT`
- Read-only owner analytics with revenue and student-growth charts
- Admin management for students, teachers, courses, applications, payments, and schedules
- Teacher tools for class schedules, attendance, grades, and student progress
- Student views for courses, grades, attendance, payments, and downloadable receipts
- Persistent login lockout after five failed attempts in 15 minutes
- API rate limiting, security headers, input sanitization, and Zod validation
- Immutable payment records with generated receipt numbers
- Audit logging for authentication and important data changes
- Uzbek, Russian, and English localization with `next-intl`

## Tech Stack

- Next.js 14 App Router
- React 18 and TypeScript
- Tailwind CSS 3
- NextAuth.js v5
- Prisma ORM 6
- PostgreSQL on Supabase
- next-intl 3
- Recharts 3
- Zod
- bcryptjs
- rate-limiter-flexible

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer
- A Supabase PostgreSQL project, or another PostgreSQL database

## Environment Variables

Copy the example file before running the project:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled PostgreSQL connection used by the application. For Supabase, use the transaction/session pooler and keep `connection_limit=1`. |
| `DIRECT_URL` | Yes | Direct PostgreSQL connection used by Prisma migrations. |
| `NEXTAUTH_SECRET` | Yes | Random secret used to sign sessions. Generate it with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Yes | Canonical application URL. Use `http://localhost:3000` locally and your production URL in production. |
| `AUTH_TRUST_HOST` | Recommended | Allows Auth.js to trust the deployment host. Set it to `true` when deploying behind a proxy. |
| `NEXT_PUBLIC_CENTER_PHONE` | Yes | Public contact phone displayed in the footer. |
| `NEXT_PUBLIC_CENTER_ADDRESS` | Yes | Public center address displayed in the footer. |

Example Supabase configuration:

```env
DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@POOLER_HOST:6543/postgres?schema=public&connection_limit=1"
DIRECT_URL="postgresql://postgres.PROJECT:PASSWORD@POOLER_HOST:5432/postgres?schema=public&sslmode=require"
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create the local environment file:

```bash
cp .env.example .env
```

3. Fill in the Supabase and Auth.js values in `.env`.

4. Apply database migrations:

```bash
npm run prisma:deploy
```

For schema development with a new migration, use:

```bash
npm run prisma:migrate
```

5. Seed development accounts:

```bash
npm run prisma:seed
```

6. Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. The root route redirects to the default Uzbek locale at `/uz`.

## Development Seed Accounts

These accounts are for local development only. Change or remove them before using a production database.

| Role | Phone | Password |
| --- | --- | --- |
| Owner | `998900000000` | `0wn3r@IlmUmm0n!#2026` |
| Admin | `998900000001` | `Adm!n@IlmUmm0n!#2026` |
| Teacher | `998900000002` | `T3ach3r@IlmUmm0n!#2026` |
| Student | `998900000003` | `Stud3nt@IlmUmm0n!#2026` |

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Start the production server locally. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript checks. |
| `npm run check` | Run lint, typecheck, and the production build. |
| `npm run prisma:generate` | Generate Prisma Client. |
| `npm run prisma:migrate` | Create and apply a development migration. |
| `npm run prisma:deploy` | Apply committed migrations. |
| `npm run prisma:seed` | Seed development accounts. |
| `npm run prisma:studio` | Open Prisma Studio. |

## Localization

The supported locales are:

- `uz` — Oʻzbek, default
- `ru` — Русский
- `en` — English

Translations live in:

```text
messages/uz.json
messages/ru.json
messages/en.json
```

Locale routing, negotiation, and persistence are configured in `src/i18n.ts`, `src/i18n/config.ts`, and `src/middleware.ts`.

## Project Structure

```text
messages/                    Translation catalogs
prisma/                      Schema, migrations, seed, and database security SQL
src/app/[locale]/            Localized App Router pages
src/app/api/                 Auth and payment receipt API routes
src/components/              Landing, dashboard, and chart components
src/lib/                     Auth, database, analytics, security, and formatting helpers
src/middleware.ts            Locale routing, API throttling, and role protection
```

## Deployment

### 1. Prepare the repository

Commit the project to your Git host. Ensure `.env` and `.env.local` remain ignored.

### 2. Build the project

Use `npm ci` to install dependencies and `npm run build` to create the production build. The `postinstall` script runs `prisma generate` automatically. Do not run `prisma db seed` as part of the production build.

### 3. Configure the host

This is a standard Next.js server application. Configure your hosting platform to:

1. Use Node.js 20.9 or newer.
2. Install with `npm ci` and build with `npm run build`.
3. Start the server with `npm run start` (`next start` reads the `PORT` environment variable automatically).
4. Supply the environment variables from `.env.example`.

For production, set:

```env
NEXTAUTH_URL="https://your-production-domain.com"
NEXTAUTH_SECRET="a-new-long-random-production-secret"
```

Choose a host region close to your database to reduce query latency.

### 4. Apply database migrations

Run committed migrations from a trusted local machine or CI environment:

```bash
npx prisma migrate deploy
```

Do not use `prisma migrate dev` in production.

### 5. Verify the deployment

After the first successful deployment, confirm that:

- `https://your-domain.com/uz` loads
- `/ru` and `/en` switch languages correctly
- phone-number login works
- role-protected dashboards are accessible only to the correct roles
- database queries and receipt downloads work from the production runtime

## Security Notes

- Never commit `.env` or `.env.local`.
- Use a unique `NEXTAUTH_SECRET` in every environment.
- Use the Supabase pooler for `DATABASE_URL` when the host enforces small connection limits.
- Payment records cannot be deleted; only their status can change.
- Owner accounts have read-only access to center analytics.
- Run `npm audit` and update dependencies before each production release.
