# Oliver G. Abela, MD, FACC: physician website

A static, mobile-first site with no dependencies. All practice facts live in **one file**, `content/site.json`, and each fact carries a verification status.

## Build

```sh
node build.mjs               # staging build -> dist/ (for review)
node build.mjs --production  # production build -> dist/ (launch)
npm run serve                # preview dist/ at http://localhost:8080
```

Requires Node 18+. There is nothing to install.

## How verification works

Each fact in `content/site.json` has a `status`:

| Status | Staging build | Production build |
|---|---|---|
| `confirmed` | shown | shown |
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
src/assets/           styles.css, main.js (mobile menu), favicon.svg
CONTENT-GAPS.md       generated checklist of unconfirmed or missing content
```

Pages: Home, Meet Dr. Abela, Areas of Care, Research & Publications, Patient Information, Contact & Directions.

## Deliberately not included

- No contact form, booking, or portal. Add these only after the practice names an authorized workflow.
- No ratings, reviews, outcome statistics, or superlatives.
- No portrait or logo. A neutral placeholder stands in until approved assets are supplied. To add a portrait, set `physician.portrait.value` to `{ "src": "assets/portrait.jpg", "alt": "…" }` and place the file in `src/assets/`.

Source research: *Oliver G. Abela, MD, FACC: Website research and Codex handoff* (Nov 2, 2026). Bracketed numbers in `site.json` refer to its source list.
