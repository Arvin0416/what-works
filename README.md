# What Works Daily

What Works Daily is a Christian, Jesus-centered daily guide for ordinary real-life struggles. Each generated article is research-backed, source-attributed, safety-checked, and private until the owner reviews and approves it.

The public reader can run from checked-in seed content. Live research, generation, YouTube discovery, database-backed review, and email delivery require their server-side environment variables and external provider access.

## Local setup

Prerequisites: Node.js, npm, and PostgreSQL for the private workflow. A PostgreSQL database is not required to view the public seed experience.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `DATABASE_URL`, the public site uses the checked-in article and does not attempt a database connection. `npm run db:seed` also exits without changing anything when `DATABASE_URL` is not set.

For the database-backed workflow, set `DATABASE_URL` in `.env.local`, then apply the schema and seed the initial records:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Run `db:generate` only when the Drizzle schema changes; review the generated migration before applying it. The seed command is safe to repeat: channel IDs are stable, existing channel rows are preserved, and the initial article is inserted once by its stable slug.

## Environment variables

Keep `.env.local` out of version control. Never put a secret in a client component, `NEXT_PUBLIC_*` variable, rendered HTML, an approval URL, or a log message.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | PostgreSQL migrations, seed data, generation runs, review packages, and published content. |
| `OPENAI_API_KEY` | Live web research and article generation. This is required for live generation. |
| `OPENAI_MODEL` | Server-side model selection. |
| `YOUTUBE_API_KEY` | Live discovery from verified approved channels. This is required for live video discovery. |
| `RESEND_API_KEY` | Review email delivery. `EMAIL_FROM` and `ADMIN_EMAIL` are required for a real send. |
| `APPROVAL_SECRET` | Signing and verifying expiring review links. |
| `CRON_SECRET` | Authenticating scheduled or operator-triggered generation requests. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public and review links. This is the only public-facing URL setting. |
| `DAILY_GENERATION_HOUR` | Documents the intended local hour (`7`); Vercel uses the UTC schedule in `vercel.json`. |

An empty provider key is acceptable for the static public shell and unit tests. It is not enough to generate a live article: live generation needs a database, `OPENAI_API_KEY`, `YOUTUBE_API_KEY` after channel verification, and a configured review email path.

## Public site and review flow

Use `npm run dev` for the public reader. With no database URL it reads the checked-in seed article; with a configured database it reads published records only.

The private daily flow is:

1. The protected generation endpoint selects a topic, researches it, discovers videos from the approved-channel allowlist, validates the draft, and stores a private review package.
2. The configured mailer sends the owner a mobile-readable preview.
3. The owner opens the signed review link, checks the exact article, sources, videos, warnings, and safety note, then chooses approve, request changes, or reject.
4. Only approval can publish the article and its video gallery. A GET review request must never mutate state.

For a local/manual run, use the protected operator request once the Task 8 route is present:

```bash
curl -i -X POST http://localhost:3000/api/cron/generate \
  -H "Authorization: Bearer $CRON_SECRET"
```

Vercel Cron invokes the configured path with `GET`; the route accepts that authenticated GET and routes it through the same protected generation workflow as `POST`. Keep POST for manual recovery. Both methods require `CRON_SECRET`.

YouTube channel IDs and handles must be verified against the official channel before any allowlist row is activated. The seed command intentionally inserts the checked-in channel records as inactive. See [the operations runbook](docs/operations.md) for activation and recovery procedures.

## Deployment

`vercel.json` schedules `/api/cron/generate` at `23:00 UTC`, the UTC equivalent of `07:00 Asia/Manila` on the following local calendar day. Vercel production Cron Jobs are protected only when the project has a `CRON_SECRET` environment variable; the schedule itself is not authentication.

Set the production values for `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `YOUTUBE_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `APPROVAL_SECRET`, `CRON_SECRET`, and `NEXT_PUBLIC_SITE_URL` in the deployment provider. Vercel Cron jobs run on production deployments; preview deployments are not a substitute for the live schedule.

## Checks

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

The public browser check can be run with `npm run test:e2e` after starting the app. Provider calls should be mocked or run only in an environment with the required keys. External API keys are never required for the static public-reader tests.

Read [docs/operations.md](docs/operations.md) for scheduling, migrations, retries, failures, key rotation, email, and approved-channel operations. Read [docs/content-policy.md](docs/content-policy.md) before reviewing or approving generated content.
