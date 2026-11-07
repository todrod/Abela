# Oliver G. Abela, MD, FACC: physician website

A static, mobile-first site with no dependencies. All practice facts live in **one file**, `content/site.json`, and each fact carries a verification status.

## Build

```sh
node build.mjs               # staging build -> dist/ (for review)
node build.mjs --production  # production build -> dist/ (launch)
npm test                     # isolated build and regression checks
npm run serve                # preview dist/ at http://localhost:8080
```

Requires Node 18+. There is nothing to install.

## What the build produces

- **Minified, fingerprinted assets.** CSS and JS are minified and named by content hash (`styles.<hash>.css`), so hosts can cache them for a year without serving stale files.
- **Self-hosted fonts.** Source Serif 4 and Source Sans 3 (SIL OFL 1.1), Latin subset, variable weight, about 78 KB together. They are preloaded and use metric-matched fallbacks so text does not jump while loading. No third-party requests are made.
- **Compact HTML.** Indentation and blank lines are stripped.
- **`_headers`.** This is for Netlify or Cloudflare Pages; on another host, copy the same values into its server config. It sets a strict Content-Security-Policy (the one inline script is allowed by hash), long-lived caching only for fingerprinted assets; other assets revalidate, and `nosniff`, `Referrer-Policy` and `Permissions-Policy`.
- **`robots.txt` and sitemap.** Production gets an allow-all `robots.txt`, plus `sitemap.xml` once `site.url` is confirmed. Staging gets disallow-all.
- **Production guard.** The build fails if any staging marker (badge, placeholder, banner, `noindex`) would reach production output.
- **Size report.** Each build prints page, asset and font sizes, plus the compressed first-load weight of the home page (about 85 KB).

## Switches waiting on the practice

- **Headshot.** Put the approved file in `src/assets/` and set `physician.portrait` (`src`, `alt`, `width`, `height`, status `confirmed`). At 500 px wide or more it fills the hero's right column. A smaller image is shown as a byline photo. Files with "placeholder" in the name never ship to production.
- **Analytics.** Set `growth.analytics.value` to `{ "provider": "plausible", "domain": "example.com" }` or `{ "provider": "fathom", "site": "ID" }` and mark it confirmed. The script, security policy and click events (`call`, `directions`, `save-contact`) turn on together.
- **Domain.** Set `site.url` to enable canonical links, `og:url`/`og:image`, `sitemap.xml` and the sitemap line in `robots.txt`.

CI (`.github/workflows/build.yml`) runs six isolated regression tests, the guarded production build and the staging build on every push and uploads both as artifacts.

## How verification works

Each fact in `content/site.json` has a `status`:

| Status | Staging build | Production build |
|---|---|---|
| `confirmed` | shown | shown |
| `draft` (copy written for the site, awaiting Dr. Abela's approval) | shown with a blue **Draft** badge | omitted |
| `public` (public record, not yet confirmed by the practice) | shown with an **Unverified** badge (hover for source) | omitted |
| `lead` (secondary source only) | omitted | omitted |
| `missing` (practice must supply) | "Pending from practice" placeholder | omitted |

Additional safeguards:

- Staging builds carry `noindex` and a `robots.txt` disallow.
- Pages with no publishable content drop out of the navigation.
- Physician/practice structured data (JSON-LD) is emitted only in production, and only once the address and phone are confirmed.
- Every build regenerates **`CONTENT-GAPS.md`**, the checklist of what still needs confirmation from Dr. Abela or the office.

To publish a fact: confirm it with the practice, set `"status": "confirmed"`, then rebuild.

## Structure

```
content/site.json     single editable content record (with sources and notes)
build.mjs             page templates and build logic
src/assets/           styles.css, main.js (mobile menu + call bar), favicon.svg, fonts/
CONTENT-GAPS.md       generated checklist of unconfirmed or missing content
```

Pages: Home, About Dr. Abela, Conditions (plus one page per condition, from `content/conditions.json`), Research, Patients, For physicians (referrals), Contact, plus a 404 page.

In staging, the banner's **Hide review markers** switch shows the page without badges or placeholders, for a clean preview.

Share image and touch icon: `node scripts/make-share-images.mjs` (needs Playwright; rerun only if the brand changes).

The latest three-perspective review (cardiologist, office manager, web designer) and its plan are in `docs/AUDIT-2026-11.md`.

## Deliberately not included

- No contact form, booking, or portal. Add these only after the practice names an authorized workflow.
- No ratings, reviews, outcome statistics, or superlatives.
- No portrait or logo. A neutral placeholder stands in until approved assets are supplied. To add a portrait, set `physician.portrait.value` to `{ "src": "assets/portrait.jpg", "alt": "…" }` and place the file in `src/assets/`.

Source research: *Oliver G. Abela, MD, FACC: Website research and Codex handoff* (Nov 2, 2026). Bracketed numbers in `site.json` refer to its source list.

## Local preview notes

The site is intended to be served at the domain root. The custom 404 uses `/` as its base so assets and navigation work for nested missing URLs. Subdirectory hosting needs a configured base path. The Python preview server does not apply `_headers` or custom 404 routing; verify those on the chosen host before launch.

If the default Homebrew Node fails with a missing `libsimdjson` error on this machine, use the existing working installation: `PATH="/Users/todrod/.local/node/bin:$PATH" npm test` (or `npm run build`).
