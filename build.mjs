#!/usr/bin/env node
// Zero-dependency static site build.
//   node build.mjs              -> staging build (public-record facts shown with markers)
//   node build.mjs --production -> production build (only practice-confirmed facts)
// Output: dist/   Also regenerates CONTENT-GAPS.md at the repo root.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PRODUCTION = process.argv.includes("--production");
const MODE = PRODUCTION ? "production" : "staging";
const OUT = join(ROOT, "dist");
const C = JSON.parse(readFileSync(join(ROOT, "content/site.json"), "utf8"));

// ---------- content helpers ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Is this item allowed into the current build? */
const ok = (item) =>
  !!item && (item.status === "confirmed" || (!PRODUCTION && item.status === "public"));
/** Value of a field if it is renderable, else null. */
const v = (item) => (ok(item) && item.value != null ? item.value : null);
/** Staging-only marker for anything not yet practice-confirmed. */
const flag = (item) => {
  if (PRODUCTION || !item || item.status === "confirmed") return "";
  const tip = [item.source && `Source ${item.source}`, item.note].filter(Boolean).join(". ");
  return ` <span class="flag" title="${esc(tip)}">Unverified</span>`;
};
/** Staging-only placeholder for missing content. */
const pending = (label) => (PRODUCTION ? "" : `<p class="pending">Pending from practice: ${esc(label)}</p>`);
const list = (arr) => (arr || []).filter(ok);

const name = v(C.physician.name);
const shortName = v(C.physician.shortName) || name;
const practiceName = v(C.practice.name);
const addr = v(C.contact.address);
const phone = v(C.contact.phone);
const fax = v(C.contact.fax);
const hours = v(C.contact.hours);
const emergency = v(C.patientInfo.emergency);

const telHref = (p) => "tel:+1" + p.replace(/\D/g, "");
const addrLines = (a) => [a.street + (a.suite ? ", " + a.suite : ""), `${a.city}, ${a.region} ${a.postalCode}`];
const mapsHref = (a) =>
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addrLines(a).join(", "));

// ---------- page registry (pages with no renderable content drop out of nav) ----------
const pages = [];
const page = (file, navLabel, title, description, body) => {
  if (body) pages.push({ file, navLabel, title, description, body });
};

// ---------- shared fragments ----------
const callButton = (cls = "btn btn-primary") =>
  phone ? `<a class="${cls}" href="${telHref(phone)}"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>Call ${esc(phone)}</a>` : "";

const directionsButton = (cls = "btn btn-secondary") =>
  addr ? `<a class="${cls}" href="${mapsHref(addr)}" rel="noopener" target="_blank">Get directions<span class="visually-hidden"> (opens Google Maps in a new tab)</span></a>` : "";

const emergencyNote = () =>
  emergency
    ? `<aside class="emergency" role="note"><strong>Emergency?</strong> ${esc(emergency)}</aside>`
    : "";

const settingLabel = {
  office: "Office visit",
  hospital: "Hospital-based",
  both: "Office evaluation, hospital procedures",
  unconfirmed: "Care setting to be confirmed",
};

const portrait = () => {
  const p = v(C.physician.portrait);
  if (p) return `<img class="portrait" src="${esc(p.src)}" alt="${esc(p.alt || name)}" width="560" height="700" loading="eager" decoding="async">`;
  return `<div class="portrait portrait-placeholder" role="img" aria-label="Portrait coming soon"><span aria-hidden="true">OA</span>${PRODUCTION ? "" : '<small>Approved headshot pending</small>'}</div>`;
};

// ---------- Home ----------
{
  const tagline = v(C.brand.tagline);
  const support = v(C.brand.supportingLine);
  const areas = list(C.areasOfCare).slice(0, 6);
  const bio = v(C.physician.shortBio);

  page(
    "index.html",
    "Home",
    name,
    support || `${name}, cardiologist in Tampa, Florida.`,
    `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">${esc(name)}${practiceName ? ` · ${esc(practiceName)}${flag(C.practice.name)}` : ""}</p>
      <h1>${tagline ? esc(tagline) + flag(C.brand.tagline) : esc(name)}</h1>
      ${support ? `<p class="lede">${esc(support)}${flag(C.brand.supportingLine)}</p>` : ""}
      <div class="actions">${callButton()}${directionsButton()}</div>
      ${!phone && !addr ? pending("office telephone and appointment address") : ""}
      ${v(C.practice.acceptingNewPatients) ? `<p class="note-inline"><span class="dot" aria-hidden="true"></span>Accepting new patients${flag(C.practice.acceptingNewPatients)}</p>` : ""}
    </div>
    <div class="hero-media">${portrait()}</div>
  </div>
</section>

${areas.length ? `
<section class="section">
  <div class="wrap">
    <div class="section-head">
      <h2>Areas of care</h2>
      <a class="text-link" href="care.html">All areas of care <span aria-hidden="true">→</span></a>
    </div>
    <ul class="cards" role="list">
      ${areas.map((a) => `
      <li class="card">
        <span class="tag tag-${a.setting}">${esc(settingLabel[a.setting])}</span>
        <h3><a href="care.html#${a.id}">${esc(a.title)}</a>${flag(a)}</h3>
        <p>${esc(a.summary)}</p>
      </li>`).join("")}
    </ul>
  </div>
</section>` : ""}

<section class="section section-tint">
  <div class="wrap split">
    <div>
      <h2>Office care and hospital care</h2>
      <p>Most patients start with an office visit. That visit covers your symptoms, history, medications, and test results, and ends with a plan. Catheter-based and structural heart procedures are done in a hospital, not in the office. If you need one, the office will explain where it will happen and what to expect.</p>
    </div>
    ${bio ? `
    <div>
      <h2>Meet ${esc(shortName)}</h2>
      <p>${esc(bio)}${flag(C.physician.shortBio)}</p>
      <a class="text-link" href="about.html">Training and credentials <span aria-hidden="true">→</span></a>
    </div>` : ""}
  </div>
</section>

${contactStrip()}
`
  );
}

function contactStrip() {
  if (!addr && !phone) return PRODUCTION ? "" : `<section class="section"><div class="wrap">${pending("contact details")}</div></section>`;
  return `
<section class="section">
  <div class="wrap contact-strip">
    <div>
      <h2>Visit the office</h2>
      ${addr ? `<address>${addrLines(addr).map(esc).join("<br>")}${flag(C.contact.address)}</address>` : ""}
    </div>
    <div class="actions">${callButton()}${directionsButton()}</div>
  </div>
</section>`;
}

// ---------- Meet Dr. Abela ----------
{
  const bio = v(C.physician.shortBio);
  const training = list(C.training);
  const creds = list(C.credentials);
  const hospitals = list(C.hospitals);
  const roles = list(C.roles);
  const approach = v(C.physician.approach);
  const langs = v(C.physician.languages);

  const body =
    bio || training.length || creds.length
      ? `
<header class="page-head"><div class="wrap">
  <p class="eyebrow">Meet ${esc(shortName)}</p>
  <h1>${esc(name)}</h1>
  ${bio ? `<p class="lede">${esc(bio)}${flag(C.physician.shortBio)}</p>` : ""}
</div></header>

<div class="wrap prose-grid">
  <div>
    ${approach ? `<section class="block"><h2>How ${esc(shortName)} works with patients</h2><p>${esc(approach)}</p></section>` : `<section class="block">${pending(`${shortName}'s own description of his approach to patient care`)}</section>`}

    ${training.length ? `
    <section class="block">
      <h2>Training</h2>
      <ol class="timeline">
        ${training.map((t) => `
        <li>
          <span class="when">${esc(t.years)}</span>
          <div><strong>${esc(t.stage)}</strong>${flag(t)}<br><span class="muted">${esc(t.institution)}</span></div>
        </li>`).join("")}
      </ol>
    </section>` : ""}
  </div>

  <aside>
    ${creds.length ? `
    <section class="block panel">
      <h2>Certifications and credentials</h2>
      <ul class="checklist">
        ${creds.map((c) => `<li>${esc(c.label)}${flag(c)}<br><span class="muted small">${esc(c.issuer)}</span></li>`).join("")}
      </ul>
    </section>` : ""}

    ${hospitals.length ? `
    <section class="block panel">
      <h2>Hospital affiliations</h2>
      <ul class="plain">${hospitals.map((h) => `<li>${esc(h.name)}${flag(h)}</li>`).join("")}</ul>
    </section>` : ""}

    ${roles.length ? `
    <section class="block panel">
      <h2>Professional roles</h2>
      <ul class="plain">${roles.map((r) => `<li>${esc(r.label)}${flag(r)}</li>`).join("")}</ul>
    </section>` : ""}

    ${langs ? `<p class="muted small">Languages: ${langs.map(esc).join(", ")}${flag(C.physician.languages)}</p>` : ""}
  </aside>
</div>`
      : "";

  page("about.html", `Meet ${shortName}`, `Meet ${shortName}`, `Training, board certifications, and hospital affiliations of ${name}.`, body);
}

// ---------- Areas of Care ----------
{
  const areas = list(C.areasOfCare);
  page(
    "care.html",
    "Areas of Care",
    "Areas of Care",
    `Heart conditions evaluated and treated by ${name} in Tampa.`,
    areas.length
      ? `
<header class="page-head"><div class="wrap">
  <p class="eyebrow">Areas of care</p>
  <h1>Conditions ${esc(shortName)} treats</h1>
  <p class="lede">Each section below notes where care happens. Office visits cover evaluation, planning, and follow-up. Procedures are performed at a hospital.</p>
</div></header>
<div class="wrap">
  ${areas.map((a) => `
  <section class="care-item" id="${a.id}" aria-labelledby="${a.id}-h">
    <div class="care-head">
      <h2 id="${a.id}-h">${esc(a.title)}${flag(a)}</h2>
      <span class="tag tag-${a.setting}">${esc(settingLabel[a.setting])}</span>
    </div>
    <p class="care-summary">${esc(a.summary)}</p>
    <p>${esc(a.detail)}</p>
    ${a.settingNote ? `<p class="setting-note">${esc(a.settingNote)}</p>` : ""}
  </section>`).join("")}
  ${emergencyNote()}
</div>`
      : ""
  );
}

// ---------- Research & Publications ----------
{
  const trials = list(C.research.trials);
  const pubs = list(C.research.publications);
  const achievements = list(C.research.achievements);
  page(
    "research.html",
    "Research",
    "Research & Publications",
    `Clinical research and selected publications by ${name}.`,
    trials.length || pubs.length
      ? `
<header class="page-head"><div class="wrap">
  <p class="eyebrow">Research &amp; publications</p>
  <h1>Clinical research</h1>
  <p class="lede">A selection of ${esc(shortName)}'s research work. This is not a complete bibliography.</p>
</div></header>
<div class="wrap narrow">
  ${trials.length ? `
  <section class="block">
    <h2>Clinical trials</h2>
    ${trials.map((t) => `
    <article class="panel trial">
      <h3>${esc(t.name)} <span class="muted small">${esc(t.id)}</span>${flag(t)}</h3>
      <p class="muted">${esc(t.role)} · Sponsor: ${esc(t.sponsor)}</p>
      <p>${esc(t.summary)}</p>
      <p class="small">Joining a clinical trial is voluntary and depends on eligibility. Trial information here is not an offer of treatment. <a href="${esc(t.url)}" rel="noopener" target="_blank">View on ClinicalTrials.gov<span class="visually-hidden"> (opens in a new tab)</span></a></p>
    </article>`).join("")}
  </section>` : ""}

  ${pubs.length ? `
  <section class="block">
    <h2>Selected publications</h2>
    <ol class="pubs">
      ${pubs.map((p) => `
      <li>
        <cite>${esc(p.title)}</cite>${flag(p)}
        <span class="muted">${esc(p.journal)}, ${esc(p.citation)}. ${esc(p.authorship)}.</span>
        <span class="small">
          <a href="https://doi.org/${esc(p.doi)}" rel="noopener" target="_blank">DOI ${esc(p.doi)}</a>${p.pmid ? ` · <a href="https://pubmed.ncbi.nlm.nih.gov/${esc(p.pmid)}/" rel="noopener" target="_blank">PubMed ${esc(p.pmid)}</a>` : ""}
        </span>
      </li>`).join("")}
    </ol>
  </section>` : ""}

  ${achievements.length ? `
  <section class="block"><h2>Notable work</h2><ul class="plain">${achievements.map((a) => `<li>${esc(a.label)}${flag(a)}</li>`).join("")}</ul></section>` : ""}
</div>`
      : ""
  );
}

// ---------- Patient Information ----------
{
  const bring = v(C.patientInfo.whatToBring);
  const insurance = v(C.practice.insurance);
  const referral = v(C.practice.referralRequired);
  const links = Object.entries({
    booking: "Request an appointment",
    portal: "Patient portal",
    records: "Medical records",
    billing: "Billing",
  })
    .map(([k, label]) => ({ label, href: v(C.links[k]) }))
    .filter((l) => l.href);

  page(
    "patients.html",
    "Patient Information",
    "Patient Information",
    `What to expect and what to bring to your visit with ${name}.`,
    bring || insurance || links.length || !PRODUCTION
      ? `
<header class="page-head"><div class="wrap">
  <p class="eyebrow">Patient information</p>
  <h1>Preparing for your visit</h1>
</div></header>
<div class="wrap prose-grid">
  <div>
    ${bring ? `
    <section class="block">
      <h2>What to bring${flag(C.patientInfo.whatToBring)}</h2>
      <ul class="checklist">${bring.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    </section>` : ""}
    <section class="block">
      <h2>Insurance and referrals</h2>
      ${insurance ? `<ul class="plain">${insurance.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : pending("accepted insurance plans")}
      ${referral != null ? `<p>${esc(referral)}</p>` : pending("referral requirements and self-pay policy")}
      ${phone ? `<p>Coverage varies by plan, so please call the office at <a href="${telHref(phone)}">${esc(phone)}</a> to confirm before your visit.</p>` : ""}
    </section>
  </div>
  <aside>
    ${links.length ? `<section class="block panel"><h2>Online services</h2><ul class="plain">${links.map((l) => `<li><a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a></li>`).join("")}</ul></section>` : `<section class="block panel">${pending("authorized booking, portal, records, and billing links")}</section>`}
    ${emergencyNote()}
  </aside>
</div>`
      : ""
  );
}

// ---------- Contact & Directions ----------
{
  page(
    "contact.html",
    "Contact",
    "Contact & Directions",
    `Office location, telephone, and directions for ${name}.`,
    addr || phone || !PRODUCTION
      ? `
<header class="page-head"><div class="wrap">
  <p class="eyebrow">Contact &amp; directions</p>
  <h1>Contact the office</h1>
</div></header>
<div class="wrap prose-grid">
  <div>
    ${emergencyNote()}
    <dl class="contact-list">
      ${practiceName ? `<div><dt>Practice</dt><dd>${esc(practiceName)}${flag(C.practice.name)}</dd></div>` : ""}
      ${addr ? `<div><dt>Address</dt><dd><address>${addrLines(addr).map(esc).join("<br>")}</address>${flag(C.contact.address)}</dd></div>` : ""}
      ${phone ? `<div><dt>Telephone</dt><dd><a href="${telHref(phone)}">${esc(phone)}</a>${flag(C.contact.phone)}</dd></div>` : ""}
      ${fax ? `<div><dt>Fax</dt><dd>${esc(fax)}${flag(C.contact.fax)}</dd></div>` : ""}
      ${hours ? `<div><dt>Office hours</dt><dd>${esc(hours)}</dd></div>` : !PRODUCTION ? `<div><dt>Office hours</dt><dd>${pending("office hours")}</dd></div>` : ""}
      ${v(C.contact.parking) ? `<div><dt>Parking</dt><dd>${esc(v(C.contact.parking))}</dd></div>` : !PRODUCTION ? `<div><dt>Parking</dt><dd>${pending("parking instructions")}</dd></div>` : ""}
    </dl>
    <div class="actions">${callButton()}${directionsButton()}</div>
  </div>
  <aside>
    <section class="block panel">
      <h2>Before you call</h2>
      <p>Please have your insurance information and your referring physician's name ready. For medication refills or test results, call the office directly.</p>
      <p class="small muted">To protect your privacy, please do not send medical details through this website.</p>
    </section>
  </aside>
</div>`
      : ""
  );
}

// ---------- layout ----------
function structuredData() {
  // Only emitted when canonical contact info is practice-confirmed (never in staging).
  if (!PRODUCTION || !addr || !phone) return "";
  const data = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name,
    medicalSpecialty: "Cardiovascular",
    telephone: "+1-" + phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: addrLines(addr)[0],
      addressLocality: addr.city,
      addressRegion: addr.region,
      postalCode: addr.postalCode,
      addressCountry: "US",
    },
  };
  if (practiceName) data.parentOrganization = { "@type": "MedicalClinic", name: practiceName };
  const url = v(C.site.url);
  if (url) data.url = url;
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function layout(p) {
  const nav = pages
    .map((x) => `<li><a href="${x.file}"${x.file === p.file ? ' aria-current="page"' : ""}>${esc(x.navLabel)}</a></li>`)
    .join("");
  const year = new Date().getFullYear();
  const url = v(C.site.url);
  const fullTitle = p.file === "index.html" ? `${name} | Cardiology in Tampa, FL` : `${p.title} | ${name}`;
  const legal = v(C.practice.legalEntity);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(p.description)}">
${PRODUCTION ? "" : '<meta name="robots" content="noindex, nofollow">'}
${url ? `<link rel="canonical" href="${esc(url.replace(/\/$/, "") + "/" + (p.file === "index.html" ? "" : p.file))}">` : ""}
<meta name="theme-color" content="#14304f">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/styles.css">
<script>document.documentElement.classList.add("js")</script>
${structuredData()}
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
${PRODUCTION ? "" : `<div class="staging-banner" role="note"><strong>Staging preview.</strong> Items marked <span class="flag">Unverified</span> come from public records and need practice confirmation. They are left out of the production build.</div>`}
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="index.html">
      <svg class="brand-mark" aria-hidden="true" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M5 17h6l2.5-6 4 11 3-7H27" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span><span class="brand-name">${esc(name)}</span>${practiceName ? `<span class="brand-sub">${esc(practiceName)}</span>` : `<span class="brand-sub">Cardiology · Tampa, FL</span>`}</span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="visually-hidden">Open menu</span><span class="bars" aria-hidden="true"></span></button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <ul>${nav}</ul>
      ${phone ? `<a class="btn btn-primary btn-sm nav-call" href="${telHref(phone)}">Call ${esc(phone)}</a>` : ""}
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
${p.body}
</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="footer-name">${esc(name)}</p>
      ${practiceName ? `<p>${esc(practiceName)}</p>` : ""}
      ${addr ? `<address>${addrLines(addr).map(esc).join("<br>")}</address>` : ""}
      ${phone ? `<p>Tel <a href="${telHref(phone)}">${esc(phone)}</a>${fax ? ` · Fax ${esc(fax)}` : ""}</p>` : ""}
    </div>
    <div>
      <ul class="plain footer-nav">${nav}</ul>
    </div>
    <div class="footer-emergency">
      <p><strong>Medical emergency?</strong> Call 911. This website is for general information only. It is not medical advice and it is not a way to reach the office urgently.</p>
    </div>
  </div>
  <div class="wrap footer-legal"><p>© ${year} ${esc(legal || name)}. All rights reserved.</p></div>
</footer>
<script src="assets/main.js" defer></script>
</body>
</html>
`;
}

// ---------- content-gaps report ----------
function gaps() {
  const rows = { public: [], lead: [], missing: [] };
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
    if (node && typeof node === "object") {
      if (typeof node.status === "string" && node.status !== "confirmed" && rows[node.status]) {
        const label = node.label || node.title || node.name || node.stage || (typeof node.value === "string" ? node.value : "");
        rows[node.status].push({ path, label, source: node.source || "", note: node.note || "" });
      }
      for (const [k, val] of Object.entries(node)) if (k !== "value") walk(val, path ? `${path}.${k}` : k);
    }
  };
  walk(C, "");
  const table = (r) =>
    r.length
      ? "| Field | Content | Source | Note |\n|---|---|---|---|\n" +
        r.map((x) => `| \`${x.path}\` | ${String(x.label).slice(0, 80).replace(/\|/g, "/")} | ${x.source} | ${x.note.replace(/\|/g, "/")} |`).join("\n")
      : "_None._";
  return `# Content gaps

Generated by \`node build.mjs\` from \`content/site.json\`. Do not edit by hand.

A production build includes **only** fields with \`"status": "confirmed"\`. To publish a field, confirm it with Dr. Abela or office staff, then set its status to \`confirmed\`.

## Missing: practice must supply (${rows.missing.length})
${table(rows.missing)}

## Public record: needs practice confirmation (${rows.public.length})
These appear in staging with an "Unverified" marker.

${table(rows.public)}

## Secondary leads: not rendered anywhere (${rows.lead.length})
${table(rows.lead)}
`;
}

// ---------- write ----------
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(join(OUT, "assets"), { recursive: true });
cpSync(join(ROOT, "src/assets"), join(OUT, "assets"), { recursive: true });
for (const p of pages) writeFileSync(join(OUT, p.file), layout(p));
if (!PRODUCTION) writeFileSync(join(OUT, "robots.txt"), "User-agent: *\nDisallow: /\n");
const report = gaps();
writeFileSync(join(ROOT, "CONTENT-GAPS.md"), report);
console.log(`Built ${pages.length} page(s) [${MODE}] -> dist/  (${pages.map((p) => p.file).join(", ")})`);
