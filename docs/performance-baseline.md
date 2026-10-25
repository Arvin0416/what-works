# What Works Daily homepage performance baseline

Captured 2026-10-25 (Asia/Manila) against the anonymous public homepage at `/`.
This is a local production-build baseline for the checked-in seed experience, not
field data.

## Run

- Existing `.next` production build was used; no source file under `app/`,
  `components/`, `lib/`, `public/`, or `scripts/` was newer than the build.
- Server: Next.js 15.5.28 at `http://localhost:3100/`.
- Chromium: Playwright headless Chromium, fresh browser/context per run,
  device scale factor 1, no CPU or network throttling.
- Viewports: desktop `1440x900`; 390px Chromium `390x844`.
- Five runs per viewport (`10` total). Each run waited for
  `page.goto(..., { waitUntil: "networkidle" })`, then waited 1.5 seconds
  before taking the load snapshot.
- `PerformanceObserver` was installed before navigation with buffered observers
  for `largest-contentful-paint`, `layout-shift`, and `event` entries.
- One safe interaction was measured per run: scroll the second
  `.struggle-filter__button` into view and click it. The recorded interaction
  value is the maximum Event Timing `click` duration observed after load.

Commands used:

```sh
npm run start -- -p 3100
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3100/
node --input-type=module <<'NODE'
# Inline Playwright collector: five fresh Chromium runs at 1440x900 and 390x844;
# PerformanceObserver for LCP/CLS/Event Timing; PerformanceResourceTiming for JS;
# request.resourceType() plus viewport-intersecting document.images for images.
NODE
```

The existing build ID was `V_C5AmhSeXw1pNuVnolYi15.5.28`.

## Measurements

| Viewport | LCP per run (ms) | LCP median | CLS per run | CLS median | observed click duration per run (ms) | click median | JS transfer | JS requests | image requests | above-fold image requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop 1440×900 | 84, 32, 32, 32, 52 | **32 ms** | 0, 0, 0, 0, 0 | **0** | 40, 40, 48, 40, 48 | **40 ms** | **109,221 B** | 5 | 0 | 0 |
| Chromium 390×844 | 32, 32, 32, 28, 32 | **32 ms** | 0, 0, 0, 0, 0 | **0** | 48, 48, 48, 40, 40 | **48 ms** | **109,221 B** | 5 | 0 | 0 |

Additional observations:

- All 10 homepage responses were HTTP `200`.
- No console errors/warnings or failed network requests were observed in the
  collector runs.
- JS transfer is the sum of `PerformanceResourceTiming.transferSize` for five
  script resources (wire bytes, including response headers). The corresponding
  encoded JS response-body total was `107,721 B`.
- No image requests occurred. The homepage had no rendered `<img>` elements in
  either viewport; its hero/video artwork was CSS/HTML and the checked-in video
  records had empty thumbnail URLs.

## Interpretation and limitations

- LCP is available from the local `largest-contentful-paint` observer. It is a
  very fast localhost lab result (28–84 ms), not a production or field-user
  estimate. The observed LCP candidate in the first desktop run was a text
  `SPAN`, not an image.
- A statistically valid page-level INP is not available from this short
  synthetic run. Chromium did support Event Timing, so the filter click gives
  a transparent interaction sample of 40–48 ms. Treat it as interaction timing,
  not as field INP or a page-wide p98 INP value.
- CLS is the sum of `layout-shift` entries excluding shifts with recent input,
  observed through the 1.5-second post-network-idle window. It was `0` in all
  runs.
- The results use a local production server with no throttling, so they do not
  model mobile network, device CPU, cache state outside the fresh contexts, or
  third-party conditions.

## Read-only checks

The name-only secret audit was run without printing secret values:

```sh
rg --files --hidden -g '.env*' -g '!.git/**' -g '!node_modules/**' -g '!.next/**'
rg -l --hidden -g '!.git/**' -g '!node_modules/**' -g '!.next/**' \
  -g '!docs/performance-baseline.md' \
  '(DATABASE_URL|OPENAI_API_KEY|OPENAI_MODEL|YOUTUBE_API_KEY|RESEND_API_KEY|APPROVAL_SECRET|CRON_SECRET|NEXT_PUBLIC_SITE_URL|EMAIL_FROM|ADMIN_EMAIL)' .
```

The only environment file found was `.env.example`; references were the
expected configuration names in source, documentation, and tests. No values
were read or changed.

`git diff --check` was run after writing this document and passed.
