# What Works Daily operations runbook

This runbook is for the owner or operator of the private generation and review workflow. It assumes the protected workflow routes from Task 8 are deployed alongside the public reader.

## Daily schedule and protection

The intended run time is 07:00 Asia/Manila. Vercel Cron schedules are UTC, so `vercel.json` uses:

```text
0 23 * * *
```

That is 23:00 UTC on the preceding calendar day and 07:00 in Manila. Vercel Cron jobs run only for production deployments. On plans with hourly timing precision, the invocation may occur later within the scheduled hour; do not treat the minute as a publication guarantee.

The schedule is not an authentication mechanism. Set `CRON_SECRET` in the deployment environment. Vercel sends it as `Authorization: Bearer <secret>` when it invokes the cron path. The route must reject missing, malformed, or mismatched authorization with `401` and must not log the secret.

Vercel invokes Cron paths with `GET`. `/api/cron/generate` accepts an authenticated GET adapter for Vercel and retains authenticated POST for manual recovery. Both methods call the same workflow; neither bypasses `CRON_SECRET`.

Official platform references: [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs), [managing and securing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Required services

Live generation is unavailable until all of these are configured:

| Service | Environment | Operator check |
| --- | --- | --- |
| PostgreSQL | `DATABASE_URL` | Migrations have applied and the runtime can connect. |
| Research and writing | `OPENAI_API_KEY`, `OPENAI_MODEL` | The selected model is available to the account and server-side only. |
| YouTube discovery | `YOUTUBE_API_KEY` | The key is active and only verified, active channel IDs are enabled. |
| Review email | `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL` | The sending domain/from address is authorized and the owner address is correct. |
| Review links | `APPROVAL_SECRET`, `NEXT_PUBLIC_SITE_URL` | The public URL is canonical and the secret is set in the server environment. |
| Scheduled invocation | `CRON_SECRET` | The deployment environment and the cron route use the same value. |

The public seed experience can run without these values. That fallback is not a live-generation mode: external API keys are required for live research, article generation, YouTube discovery, and real review email delivery.

## Database migration and seed

From a checkout containing the current schema:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:generate` creates a Drizzle migration when the schema changes. Review it before running `db:migrate`; do not treat a migration as a disposable local file if it has been applied to a shared database.

`db:seed`:

- inserts the configured channel allowlist by stable channel ID;
- inserts the sample published article, citations, and static video records once by the stable article slug;
- leaves existing channel rows and operator-selected `active` values unchanged on reruns;
- inserts allowlist rows inactive, because a name or handle in source configuration is not proof of a verified YouTube channel;
- skips cleanly when `DATABASE_URL` is absent and never calls an external API.

The seed article is a safe public sample. Its static video records are fixtures for the public reader, not evidence of ministry endorsement or live YouTube discovery.

## Daily generation and review

The expected run lifecycle is:

```text
queued -> researching -> drafted -> needs_review -> approved -> published
                                      |              |
                                      v              v
                                  rejected        published
```

The workflow should persist a safe error code and a `failed` generation run when a provider or database operation fails. Error codes can identify a class such as `missing_openai_key`, `youtube_unavailable`, `email_failed`, or `database_unavailable`; they must not contain keys, connection strings, prompts with private data, signed tokens, or raw provider payloads.

The review link shows the exact generated version, source citations, video metadata, validation warnings, and safety notes. Review actions are explicit owner actions. Approval publishes once; a repeated approval request is idempotent. Request-changes must include feedback, and rejection must never publish the version.

## Retries and failed runs

Vercel does not automatically retry a failed Cron invocation. Use the deployment logs and the `generation_runs` record to identify the failure, correct the underlying problem, and then invoke the protected POST route manually:

```bash
curl -i -X POST "$NEXT_PUBLIC_SITE_URL/api/cron/generate" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Before retrying:

1. Confirm the previous run is `failed`, not already `needs_review`, `approved`, or `published`.
2. Check provider status, quota, key configuration, database connectivity, and the active approved-channel rows.
3. Retry once after a transient failure. Do not repeatedly replay an existing approval link or create duplicate review actions.
4. If the failure is content validation or safety-related, regenerate or edit through the review workflow rather than weakening the validator.
5. If failures repeat, disable the Vercel Cron job temporarily, preserve the safe error code and logs, and resolve the dependency before re-enabling it.

Never “fix” a failed run by marking it published directly in the database. Publication requires the legal approval transition and owner review.

## Email provider

Configure the Resend-compatible provider with a verified sending domain, a valid `EMAIL_FROM`, and the owner `ADMIN_EMAIL`. The review email should include the title, category, source count, video count, safety/validation warnings, and a signed review button. It must not include API keys or database credentials.

In local development without `RESEND_API_KEY`, the provider may use its server-side fallback logger and print only the rendered subject and review URL. Treat that URL as a secret: do not paste it into tickets, commit it, or send it to anyone other than the owner.

## Key rotation

Rotate secrets in the provider/deployment environment, then redeploy or restart the server so every function uses the new value. Never place the replacement in `.env.example`, source control, a review URL, or a log.

- `OPENAI_API_KEY`, `YOUTUBE_API_KEY`, and `RESEND_API_KEY`: create the replacement key, update production and local environments, verify the corresponding provider with a controlled run, then revoke the old key.
- `DATABASE_URL`: provision or rotate the database credential, verify migrations and a read-only public request, then revoke the old credential.
- `CRON_SECRET`: update Vercel and the operator's local environment together. Until redeployment, one side may reject the other. Keep the exact Bearer comparison and never expose the value in a URL.
- `APPROVAL_SECRET`: update the deployment and redeploy. Existing signed review links become invalid; send a new review email for any still-needed package.

After any rotation, run typecheck/tests locally and perform one controlled authenticated request without printing headers or response bodies that could contain secrets.

## Approved-channel operations

YouTube IDs and handles must be verified before enabling discovery. A display name alone is not sufficient.

1. Open the official channel page and confirm that the channel identity and handle match the intended ministry or creator.
2. Resolve the stable YouTube channel ID from the official page/API response. Do not copy a video ID, search-result URL, or model-supplied value into the channel ID field.
3. Confirm the returned API channel ID, handle, canonical URL, and displayed channel name agree.
4. Update the allowlist configuration with the verified ID and handle. Keep the canonical URL and the non-affiliation note.
5. Run `npm run db:seed`. The seed preserves existing rows and does not turn discovery on implicitly.
6. Set the corresponding database allowlist row `active` only after the checks above, using the normal operator/database change process.
7. Run a controlled generation or discovery test and confirm every returned video has the expected channel ID. Deactivate the row immediately if any result is outside the allowlist.

The allowlist is a discovery boundary, not an endorsement or partnership list. Do not add arbitrary public search results, and do not enable a channel because a generated article recommends it.

## Incident and privacy rules

Keep provider payloads and review data server-side. Logs may contain run IDs, safe error codes, timestamps, and high-level counts, but not secrets, signed tokens, full article drafts, private email addresses, or untrusted source instructions. Preserve the failed run record and relevant platform log reference for diagnosis, then redact or expire sensitive material according to the hosting/provider retention policy.

For content involving immediate danger, self-harm, abuse, serious medical symptoms, or threats to another person, stop the normal publish path and follow [the content policy](content-policy.md). A generated article is never a replacement for emergency, medical, counseling, or pastoral care.
