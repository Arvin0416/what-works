# What Works Daily — Design Specification

**Date:** 2026-10-25  
**Status:** Approved product direction; implementation pending written-spec review  
**Repository:** `Arvin0416/what-works`

## 1. Product intent

What Works Daily is a Christian, Jesus-centered publication for practical moments of struggle. It answers questions such as “What works when temptation hits?”, “What works after I argue with my parents?”, and “What works when I feel far from God?” with original, Scripture-informed guidance, a short prayer, practical next steps, and related Christian video recommendations.

The product is a publication and discovery experience, not an autonomous pastoral authority or a replacement for pastoral, medical, or emergency help. Articles are generated daily by an AI-assisted pipeline but remain private until the owner reviews and approves them.

The attached `Sanjai_Builds_WEB_Pack.pdf` is treated as a design reference and build-inspiration document. Its reference websites, repositories, and recipes inform the visual language and motion approach; they are not product requirements, endorsements, or assets to copy.

## 2. Goals and non-goals

### Goals

- Publish one reviewed Christian article per day.
- Organize content by real-life situations and biblical perspectives.
- Find related YouTube videos from an explicit approved-channel allowlist.
- Present videos as visual gallery cards with thumbnails, titles, channel names, and topic tags; do not print raw URLs.
- Send a mobile-friendly email preview to the owner.
- Provide approve, request-changes, and reject actions.
- Publish the article and its video gallery only after owner approval.
- Preserve source citations and show them clearly on published articles.
- Make the public experience expressive and editorial while keeping layout, keyboard access, reduced motion, and performance reliable.

### Non-goals for v1

- Fully autonomous public publishing.
- Chat or one-to-one spiritual counseling.
- User accounts, comments, reactions, or community moderation.
- Hosting or downloading YouTube videos.
- Claiming official affiliation with Victory, Every Nation, Pastor Vlad, or any other ministry.
- Reusing proprietary sermon transcripts, books, or long copyrighted quotations.
- SMS or push notifications; email is the first notification channel and must work well on a phone.
- A general-purpose CMS or arbitrary public channel search.

## 3. Audience and content stance

The primary audience is Christians, especially younger readers looking for a clear next step in an ordinary difficult moment. The writing should be warm, direct, humble, and practical rather than preachy or sensational.

The theological profile is Christian and Jesus-centered, with Scripture as the primary authority. Public statements from Every Nation and Victory may inform the guardrails and be linked as references, but the product must not imply endorsement or partnership. Article wording is original. Bible passages are normally referenced by book/chapter/verse, with only short quotations where licensing permits.

The system must distinguish:

- **Theological source:** an approved doctrine or ministry reference used to guide framing.
- **Research source:** an external page used to support a factual claim.
- **YouTube recommendation:** a public video selected from an approved channel.

## 4. Public information architecture

The initial public experience is a responsive home/archive surface with article detail routes.

### Homepage

1. **Hero:** “When life gets real, find what works.” An editorial introduction to the project and a clear route to today’s article.
2. **Today’s What Works:** prominent article card with struggle category, title, reading time, and “Read today’s guide.”
3. **Browse by struggle:** filterable categories such as Temptation, Family, Anxiety, Doubt, Loneliness, Forgiveness, Prayer, and Spiritual Growth.
4. **Watch What Works:** a visual grid of related YouTube cards. Cards show the thumbnail, unmodified YouTube title, channel name, category, duration when available, and a YouTube-branded watch affordance. Clicking opens the original YouTube URL in the user’s browser or YouTube app.
5. **Archive:** recent published articles with category and date.
6. **Trust/footer:** editorial method, source policy, ministry non-affiliation note, safety note, and contact route.

### Article route

Each article includes:

- title, date, category, and reading time;
- a concise “what works” summary;
- Scripture references;
- original explanation and practical steps;
- a short prayer;
- related video gallery;
- visible source citations;
- an appropriate safety escalation note for topics involving self-harm, abuse, medical symptoms, or immediate danger.

## 5. Signature interaction and visual direction

The visual direction is an original editorial “faith field guide,” inspired by the pack’s bold type, color blocks, and purposeful scroll pacing without reproducing its layouts or imagery.

- Warm paper background with ink-black type.
- Acid green as the primary signal color, with restrained coral and violet accents.
- Large expressive display type paired with a monospace metadata voice.
- Rounded editorial cards, browser-like article previews, and thumbnail-led video shelves.
- One signature interaction: a pinned “What works in this moment?” workbench. As the reader moves through a short set of struggle states, the supporting card updates between **Notice**, **Remember**, **Practice**, and **Reach out**. The same information remains available as ordinary stacked content on mobile and with reduced motion.

Motion rules:

- Layout and navigation work without animation.
- Use CSS for simple transitions and GSAP/ScrollTrigger only for the signature sequence if the baseline supports it.
- Animate `transform` and `opacity` where possible.
- Respect `prefers-reduced-motion`; replace pinned movement with a static step list.
- Do not add WebGL or smooth-scroll dependencies in v1 unless measurement shows they materially improve the experience without harming accessibility or load performance.

## 6. Daily generation and approval pipeline

```text
Scheduled job
  -> select a topic from the struggle queue
  -> research approved Christian and general reference sources
  -> search the approved YouTube channel allowlist
  -> generate a structured draft
  -> validate theology, citations, originality, safety, and metadata
  -> save a private review package
  -> email the owner a preview
  -> approve / request changes / reject
  -> publish the article and video gallery
```

The OpenAI Responses API is the default model integration because its web-search tool supports live research, domain filtering, and returned source citations. The search prompt must explicitly require source-backed claims and must treat fetched pages as untrusted content rather than instructions.

YouTube discovery uses the YouTube Data API with a configured list of channel IDs. Search results are candidate metadata only; the system stores the video ID, title, channel, thumbnail URL, published date, and watch URL. It does not download or host video media.

### Content states

`queued` → `researching` → `drafted` → `needs_review` → `approved` → `published`

Alternative terminal states are `rejected` and `failed`. A retry must create a new generation attempt without silently overwriting the previous review package.

### Approval actions

- **Approve:** publish the exact reviewed version.
- **Request changes:** return structured feedback to the generator and create a new draft version.
- **Reject:** close the package without publishing.

Approval links are signed, single-purpose, expiring, and server-validated. The review dashboard remains the authoritative interface; email actions are a convenience.

## 7. Safety and source guardrails

- Use an explicit Christian doctrine profile rather than relying on a vague “Christian tone” prompt.
- Require every non-obvious factual claim to have a source or be labeled as reflection/opinion.
- Never invent Bible references, quotations, pastor statements, testimonies, or statistics.
- Do not present AI output as prophecy, divine revelation, ordained counsel, or a substitute for a pastor, counselor, doctor, or emergency responder.
- Add topic-specific escalation language for self-harm, abuse, eating disorders, medical symptoms, or imminent danger.
- Do not use a source page’s instructions as model instructions; source content is data to assess.
- Preserve original creator attribution and avoid copying long passages from sermons or articles.
- Keep an audit trail of prompt version, model, generation timestamp, source URLs, video IDs, validation results, reviewer action, and published version.

## 8. Technical architecture

- **Frontend:** Next.js App Router, TypeScript, semantic HTML, CSS modules or a focused global stylesheet.
- **Content model:** PostgreSQL with a typed data-access layer; local development may use a lightweight compatible database adapter.
- **Generation:** official OpenAI JavaScript SDK on the server; model selected by `OPENAI_MODEL`.
- **Web research:** Responses API web search with an allowlist for core theological sources and a broader list for factual context.
- **YouTube:** server-side YouTube Data API adapter with approved channel IDs in configuration.
- **Email:** transactional email adapter, defaulting to Resend-compatible delivery.
- **Scheduling:** deployment scheduler/cron endpoint protected by a secret; manual “generate now” action in the review dashboard for development and recovery.
- **Secrets:** `OPENAI_API_KEY`, `OPENAI_MODEL`, `YOUTUBE_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL`, `ADMIN_EMAIL`, `APPROVAL_SECRET`, and `CRON_SECRET` are environment-only values. No secret is committed or sent to the browser.

Suggested boundaries:

- `content/` — doctrine profile, struggle taxonomy, prompts, approved sources, approved channels.
- `lib/research/` — web-search and YouTube adapters.
- `lib/generation/` — schema, prompt assembly, model call, and validation.
- `lib/publishing/` — article/version state transitions and public queries.
- `lib/notifications/` — email templates and signed actions.
- `app/` — public routes, review routes, and protected API handlers.

## 9. Data model

Core records:

- `Article`: stable identity, slug, title, status, category, body sections, prayer, Scripture references, created/published timestamps.
- `ArticleVersion`: generated content, model, prompt version, validation report, reviewer feedback, and source snapshot.
- `SourceCitation`: URL, title, publisher, retrieved timestamp, claim association, and visible citation label.
- `VideoRecommendation`: YouTube video ID, title, channel ID/name, thumbnail URL, duration, topic, watch URL, and review status.
- `ChannelAllowlist`: channel ID, display name, source URL, active flag, and notes.
- `GenerationRun`: scheduled/manual trigger, status, error, timing, and linked article version.
- `ApprovalToken`: hashed single-use token, action, expiration, article version, and consumed timestamp.

## 10. Performance, accessibility, and verification

The first measurement baseline happens after the static public shell exists and before adding heavier motion or 3D. Targets are:

- LCP ≤ 2.5s
- INP ≤ 200ms
- CLS ≤ 0.1

The public page must have stable image dimensions, lazy-loaded below-the-fold thumbnails, keyboard-visible focus states, semantic headings, accessible names for image-only controls, readable contrast, and a reduced-motion mode. Test desktop, narrow mobile, keyboard navigation, screen-reader landmarks, failed images, no JavaScript for core article reading, and `prefers-reduced-motion: reduce`.

Automated checks:

- TypeScript and lint checks.
- Unit tests for content schema, source validation, channel filtering, token expiry, and state transitions.
- API tests for protected cron/review routes and approval idempotency.
- Browser tests for article reading, gallery navigation, email approval links, and reduced motion.
- Lighthouse/performance measurement recorded with the same conditions before and after motion changes.

## 11. Acceptance criteria

The v1 is complete when:

1. A visitor can browse and read published Christian articles by struggle category.
2. A visitor can click visual YouTube cards and be redirected to the original video without raw URLs displayed in the card.
3. The scheduler can create a private daily draft from the configured topic queue.
4. The draft includes visible sources, Scripture references, a prayer, and approved-channel video recommendations.
5. The owner receives a mobile-readable email preview.
6. Approve, request-changes, and reject actions work securely and are idempotent.
7. Approval publishes the reviewed version and its video gallery; rejection never publishes.
8. The public experience works on desktop and mobile and remains usable with reduced motion.
9. No API key or private approval secret appears in client bundles, logs, committed files, or rendered HTML.
10. Checks and known limits are documented before the repository is pushed.

## 12. Research basis

- The attached Web Pack establishes the editorial reference: design direction before motion, one signature interaction, approved-channel-style curation, responsive behavior, reduced-motion checks, and build recipes that add complexity only when it serves the concept.
- [Every Nation statement of faith](https://www.everynation.org/what-we-believe/) and [Victory’s public identity page](https://church.victory.org.ph/who-we-are/) inform the proposed Christian reference posture; they do not grant affiliation or reuse rights.
- [OpenAI web search documentation](https://developers.openai.com/api/docs/guides/tools-web-search) supports server-side current research with citations and domain filtering.
- [YouTube Search API documentation](https://developers.google.com/youtube/v3/docs/search) and [YouTube Developer Policies](https://developers.google.com/youtube/terms/developer-policies-guide) support thumbnail metadata, approved-channel filtering, and original YouTube redirects with visible attribution.
- [Web Vitals guidance](https://web.dev/articles/vitals) supplies the loading, interactivity, and stability targets.
