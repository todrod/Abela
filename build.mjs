#!/usr/bin/env node
// Zero-dependency static site build.
//   node build.mjs              -> staging build (public-record facts shown with markers)
//   node build.mjs --production -> production build (only practice-confirmed facts)
// Output: dist/   Also regenerates CONTENT-GAPS.md at the repo root.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PRODUCTION = process.argv.includes("--production");
const MODE = PRODUCTION ? "production" : "staging";
const OUT = join(ROOT, "dist");
const SRC = join(ROOT, "src/assets");
const C = JSON.parse(readFileSync(join(ROOT, "content/site.json"), "utf8"));

// ---------- content helpers ----------
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Is this item allowed into the current build? */
const ok = (item) => !!item && (item.status === "confirmed" || (!PRODUCTION && (item.status === "public" || item.status === "draft")));
/** Value of a field if it is renderable, else null. */
const v = (item) => (ok(item) && item.value != null ? item.value : null);
/** Staging-only marker for anything not yet practice-confirmed. */
const flag = (item) => {
  if (PRODUCTION || !item || item.status === "confirmed") return "";
  const tip = [item.source && `Source ${item.source}`, item.note].filter(Boolean).join(". ");
  if (item.status === "draft") return ` <span class="flag flag-draft" title="${esc(tip || "Draft copy for Dr. Abela's approval")}">Draft</span>`;
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
const tagline = v(C.brand.tagline);
const npi = v(C.physician.npi);
const ops = C.operations || {};
const hasCurrentInfo = Object.values(ops).some((x) => v(x)) || !PRODUCTION;
const hasReferrals = !!(v(C.referrals?.howTo) || v(C.referrals?.intro)) || (!PRODUCTION && !!fax);

const telHref = (p) => "tel:+1" + p.replace(/\D/g, "");
const addrLines = (a) => [a.street + (a.suite ? ", " + a.suite : ""), `${a.city}, ${a.region} ${a.postalCode}`];
const mapsHref = (a) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addrLines(a).join(", "));

// ---------- icons: one drawn set, 24px grid, 1.75 stroke ----------
const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  phone:
    '<path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.6 19.6 0 0 1-8.5-3 19.3 19.3 0 0 1-6-6 19.6 19.6 0 0 1-3-8.6A2 2 0 0 1 3.3 1.6h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.3 9.4a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  pin: '<path d="M12 21s-7-6.1-7-11.2a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const icon = (n, cls = "icon") =>
  `<svg class="${cls}" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

// Condition pictograms: same grid and stroke as ICONS, drawn for this site.
const CONDITION_ICONS = {
  coronary: '<path d="M12 20.5s-7.5-4.6-7.5-10.4A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.7c0 5.8-7.5 10.4-7.5 10.4z"/><path d="M8 11.5h2.5l1.2-2.5 1.6 5 1.2-2.5H16"/>',
  "heart-failure": '<path d="M12 20.5s-7.5-4.6-7.5-10.4A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.7c0 5.8-7.5 10.4-7.5 10.4z"/><path d="M12 10.5c-1.3 1.6-2 2.7-2 3.6a2 2 0 0 0 4 0c0-.9-.7-2-2-3.6z"/>',
  structural: '<circle cx="12" cy="12" r="8.5"/><path d="M12 12V3.5M12 12l-7.4 4.3M12 12l7.4 4.3"/>',
  imaging: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M6 11h2.5l1.5-3 2 6 1.5-3H18M9 20h6M12 16.5V20"/>',
  prevention: '<path d="M12 3.5l7 2.6v5.4c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6.1z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
  shock: '<circle cx="12" cy="12" r="8.5"/><path d="M13 6.5l-4 6.3h3.6L11 17.5l4-6.3h-3.6z"/>',
  pe: '<path d="M12 4v7M12 11c-1.5 1-3 1.5-4.5 1.5M12 11c1.5 1 3 1.5 4.5 1.5"/><path d="M8.5 7.5C5.5 8 4 12 4 15.5 4 18 5 19.5 7 19.5S10 18 10 15v-3M15.5 7.5c3 .5 4.5 4.5 4.5 8 0 2.5-1 4-3 4s-3-1.5-3-4.5v-3"/>',
};
const conditionIcon = (id) =>
  CONDITION_ICONS[id]
    ? `<span class="cond-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${CONDITION_ICONS[id]}</svg></span>`
    : "";

/** The site's signature motif: a heart-rhythm trace. `pulse` adds the travelling beat. */
const ECG_PATH = "M0 120 H640 l22 -16 l16 16 H720 l16 -92 l20 156 l18 -104 l12 40 H860 l24 -22 l20 22 H1200";
const ecg = (cls, pulse = false) =>
  `<svg class="${cls}" aria-hidden="true" viewBox="0 0 1200 200" preserveAspectRatio="none"><path class="ecg-base" pathLength="1" d="${ECG_PATH}"/>${pulse ? `<path class="ecg-pulse" pathLength="1" d="${ECG_PATH}"/>` : ""}</svg>`;

// ---------- page registry (pages with no renderable content drop out of nav) ----------
const pages = [];
const page = (file, navLabel, title, description, body) => {
  if (body) pages.push({ file, navLabel, title, description, body });
};

// ---------- shared fragments ----------
// One wording for the main action everywhere: nav, hero, closing panel, mobile bar.
const CALL_LABEL = phone ? `Call ${phone}` : "";
const callButton = (cls = "btn btn-primary") =>
  phone ? `<a class="${cls}" href="${telHref(phone)}" data-event="call">${icon("phone")}<span>${esc(CALL_LABEL)}</span></a>` : "";
const directionsButton = (cls = "btn btn-secondary") =>
  addr
    ? `<a class="${cls}" href="${mapsHref(addr)}" rel="noopener" target="_blank" data-event="directions">${icon("pin")}<span>Get directions</span><span class="visually-hidden"> (opens Google Maps in a new tab)</span></a>`
    : "";
const textLink = (href, label) => `<a class="text-link" href="${href}"><span>${esc(label)}</span>${icon("arrow")}</a>`;

const emergencyNote = () =>
  emergency ? `<aside class="emergency" role="note"><strong>Emergency?</strong> ${esc(emergency)}</aside>` : "";

const settingLabel = {
  office: "Office visit",
  hospital: "Hospital-based",
  both: "Office evaluation, hospital procedures",
  unconfirmed: "Care setting to be confirmed",
};

const portrait = () => {
  const p = v(C.physician.portrait);
  if (p)
    return `<figure class="hero-figure"><img class="portrait" src="${esc(p.src)}" alt="${esc(p.alt || name)}" width="560" height="700" fetchpriority="high" decoding="async"></figure>`;
  // Stand-in until an approved headshot exists. Production omits it and the headline takes the full width.
  if (PRODUCTION) return "";
  return `<figure class="hero-figure" aria-hidden="true"><div class="portrait-placeholder"><small>Approved headshot pending</small></div></figure>`;
};

function trustStrip() {
  const items = list(C.highlights);
  if (!items.length) return "";
  return `
<section class="trust" aria-label="Credentials">
<ul class="wrap trust-list" role="list">
${items.map((h) => `<li><strong>${esc(h.label)}${flag(h)}</strong><span>${esc(h.detail)}</span></li>`).join("\n")}
</ul>
</section>`;
}

function stepsSection() {
  const steps = list(C.visitSteps);
  if (!steps.length) return "";
  return `
<section class="section" aria-labelledby="steps-h">
<div class="wrap">
<h2 id="steps-h">Your first visit, step by step</h2>
<ol class="steps" role="list">
${steps.map((s, i) => `<li><span class="step-n" aria-hidden="true">${i + 1}</span><h3>${esc(s.title)}${flag(s)}</h3><p>${esc(s.text)}</p></li>`).join("\n")}
</ol>
<p class="steps-note">Procedures such as stents and valve replacement happen in a hospital, not in the office. If you need one, the office will explain where it will happen and what to expect.</p>
</div>
</section>`;
}

/** FAQ accordion. `limit` shows the first N answered questions and links to the full list. */
function faqSection({ limit = Infinity, id = "" } = {}) {
  const answered = list(C.faq).filter((f) => f.a);
  const missing = PRODUCTION ? [] : (C.faq || []).filter((f) => f.status === "missing");
  if (!answered.length && !missing.length) return "";
  const shown = answered.slice(0, limit);
  const more = limit !== Infinity && (answered.length > shown.length || missing.length);
  return `
<section class="section"${id ? ` id="${id}"` : ""} aria-labelledby="faq-h${id}">
<div class="wrap faq-wrap">
<div>
<h2 id="faq-h${id}">Common questions</h2>
${more ? textLink("patients.html#faq", "See all questions") : ""}
</div>
<div class="faq">
${shown.map((f) => `<details><summary>${esc(f.q)}${flag(f)}<span class="faq-mark" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`).join("\n")}
${limit === Infinity ? missing.map((f) => pending(`answer to "${f.q}"`)).join("") : ""}
</div>
</div>
</section>`;
}

/** Closing panel. On the homepage it carries the brand line (once per page); elsewhere a plain heading. */
function closing({ brand = false } = {}) {
  if (!phone && !addr) return PRODUCTION ? "" : `<section class="section"><div class="wrap">${pending("contact details")}</div></section>`;
  const heading = brand && tagline ? `${esc(tagline)}${flag(C.brand.tagline)}` : `Appointments with ${esc(shortName)}`;
  return `
<section class="closing" aria-labelledby="close-h">
<div class="wrap closing-inner on-dark">
${ecg("band-ecg")}
<div>
<h2 id="close-h">${heading}</h2>
${addr ? `<address>${addrLines(addr).map(esc).join("<br>")}${flag(C.contact.address)}</address>` : ""}
</div>
<div class="actions">${callButton()}${directionsButton()}</div>
</div>
</section>`;
}

// ---------- Home ----------
{
  const headline = v(C.brand.headline);
  const support = v(C.brand.supportingLine);
  const areas = list(C.areasOfCare).slice(0, 6);
  const areaIds = new Set(list(C.areasOfCare).map((a) => a.id));
  const symptoms = list(C.symptoms).filter((s) => areaIds.has(s.area));
  const bio = v(C.physician.shortBio);
  const why = list(C.whyChoose);
  const audiences = list(C.audiences).filter((r) =>
    r.href.startsWith("referrals") ? hasReferrals : r.href.includes("#current") ? hasCurrentInfo : r.href.startsWith("contact") ? !!(addr || phone) : true
  );

  page(
    "index.html",
    "Home",
    name,
    support || `${name}, cardiologist in Tampa, Florida.`,
    `
<section class="hero on-dark">
${ecg("hero-ecg", true)}
<div class="wrap hero-grid${portrait() ? " has-media" : ""}">
<div class="hero-copy">
<h1>${headline ? esc(headline) + flag(C.brand.headline) : esc(name)}</h1>
${headline ? `<p class="hero-name">${esc(name)}${practiceName ? `<span> · ${esc(practiceName)}${flag(C.practice.name)}</span>` : ""}</p>` : ""}
${support ? `<p class="lede">${esc(support)}${flag(C.brand.supportingLine)}</p>` : ""}
<div class="actions">${callButton()}${directionsButton()}</div>
${!phone && !addr ? pending("office telephone and appointment address") : ""}
<ul class="hero-facts" role="list">
${addr ? `<li>${icon("pin")}<span>${esc(addrLines(addr).join(", "))}${flag(C.contact.address)}</span></li>` : ""}
${v(C.practice.acceptingNewPatients) ? `<li><span class="dot" aria-hidden="true"></span><span>Accepting new patients${flag(C.practice.acceptingNewPatients)}</span></li>` : ""}
</ul>
</div>
${portrait() ? `<div class="hero-media">${portrait()}</div>` : ""}
</div>
</section>
${trustStrip()}
${why.length ? `
<section class="section" aria-labelledby="why-h">
<div class="wrap">
<div class="section-head">
<h2 id="why-h">Why patients and physicians choose ${esc(shortName)}</h2>
</div>
<ol class="why" role="list">
${why.map((w, i) => `<li><span class="why-n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><h3>${esc(w.title)}${flag(w)}</h3><p>${esc(w.text)}</p></li>`).join("\n")}
</ol>
</div>
</section>` : ""}
${areas.length ? `
<section class="section section-sand" aria-labelledby="conditions-h">
<div class="wrap">
<div class="section-head split-head">
<h2 id="conditions-h">Conditions treated</h2>
${textLink("care.html", "See all conditions")}
</div>
${symptoms.length ? `<div class="symptom-chips"><p id="sym-h">Start with a symptom:</p><ul role="list" aria-labelledby="sym-h">${symptoms.map((s) => `<li><a href="care.html#${s.area}">${esc(s.label)}</a>${flag(s)}</li>`).join("")}</ul></div>` : ""}
<ul class="conditions" role="list">
${areas.map((a) => `<li>
${conditionIcon(a.id)}
<h3><a href="care.html#${a.id}">${esc(a.title)}</a>${flag(a)}</h3>
<p>${esc(a.summary)}</p>
<span class="tag tag-${a.setting}">${esc(settingLabel[a.setting])}</span>
</li>`).join("\n")}
</ul>
</div>
</section>` : ""}
${audiences.length ? `
<section class="section" aria-labelledby="help-h">
<div class="wrap">
<div class="section-head"><h2 id="help-h">How can we help?</h2></div>
<ul class="routes" role="list">
${audiences.map((r) => `<li><a href="${r.href}"><strong>${esc(r.title)}</strong><span>${esc(r.text)}</span>${icon("arrow")}</a></li>`).join("\n")}
</ul>
</div>
</section>` : ""}
${stepsSection()}
${bio ? `
<section class="section section-navy on-dark" aria-labelledby="meet-h">
${ecg("band-ecg")}
<div class="wrap meet">
<h2 id="meet-h">About ${esc(shortName)}</h2>
<div>
<p>${esc(bio)}${flag(C.physician.shortBio)}</p>
<a class="btn btn-light" href="about.html"><span>See training and credentials</span>${icon("arrow")}</a>
</div>
</div>
</section>` : ""}
${faqSection({ limit: 3 })}
${closing({ brand: true })}
`
  );
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
<header class="page-head on-dark">${ecg("head-ecg")}<div class="wrap">
<h1>${esc(name)}</h1>
${bio ? `<p class="lede">${esc(bio)}${flag(C.physician.shortBio)}</p>` : ""}
</div></header>
${trustStrip()}
<div class="wrap prose-grid">
<div>
${approach ? `<section class="block"><h2>How ${esc(shortName)} works with patients</h2><p>${esc(approach)}</p></section>` : `<section class="block">${pending(`${shortName}'s own description of his approach to patient care`)}</section>`}
${training.length ? `
<section class="block">
<h2>Training</h2>
<ol class="timeline">
${training.map((t) => `<li><span class="when">${esc(t.years)}</span><div><strong>${esc(t.stage)}</strong>${flag(t)}<br><span class="muted">${esc(t.institution)}</span></div></li>`).join("\n")}
</ol>
</section>` : ""}
</div>
<aside>
${creds.length ? `
<section class="block panel">
<h2>Certifications and credentials</h2>
<ul class="checklist">
${creds.map((c) => `<li>${esc(c.label)}${flag(c)}<br><span class="muted small">${esc(c.issuer)}</span></li>`).join("\n")}
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

  page("about.html", `About ${shortName}`, `About ${shortName}`, `Training, board certifications, and hospital affiliations of ${name}.`, body);
}

// ---------- Areas of Care ----------
{
  const areas = list(C.areasOfCare);
  page(
    "care.html",
    "Conditions",
    "Conditions treated",
    `Heart conditions evaluated and treated by ${name} in Tampa.`,
    areas.length
      ? `
<header class="page-head on-dark">${ecg("head-ecg")}<div class="wrap">
<h1>Conditions ${esc(shortName)} treats</h1>
<p class="lede">Each condition below notes where care happens. Office visits cover evaluation, planning, and follow-up. Procedures take place in a hospital.</p>
<nav class="jump" aria-label="Conditions on this page"><ul role="list">${areas.map((a) => `<li><a href="#${a.id}">${esc(a.title)}</a></li>`).join("")}</ul></nav>
</div></header>
<div class="wrap">
${areas.map((a) => `
<section class="care-item" id="${a.id}" aria-labelledby="${a.id}-h">
<div class="care-head">
${conditionIcon(a.id)}<h2 id="${a.id}-h">${esc(a.title)}${flag(a)}</h2>
<span class="tag tag-${a.setting}">${esc(settingLabel[a.setting])}</span>
</div>
<p class="care-summary">${esc(a.summary)}</p>
<p>${esc(a.detail)}</p>
${a.settingNote ? `<p class="setting-note"><strong>Where care happens:</strong> ${esc(a.settingNote)}</p>` : ""}
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
    "Research and publications",
    `Clinical research and selected publications by ${name}.`,
    trials.length || pubs.length
      ? `
<header class="page-head on-dark">${ecg("head-ecg")}<div class="wrap">
<h1>Research and publications</h1>
<p class="lede">A selection of ${esc(shortName)}'s clinical trial work and published papers. This is not a complete bibliography.</p>
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
<p class="small">Joining a clinical trial is voluntary and depends on eligibility. Trial information here is not an offer of treatment. <a href="${esc(t.url)}" rel="noopener" target="_blank">Read the trial record on ClinicalTrials.gov<span class="visually-hidden"> (opens in a new tab)</span></a></p>
</article>`).join("")}
</section>` : ""}
${pubs.length ? `
<section class="block">
<h2>Selected publications</h2>
<ol class="pubs">
${pubs.map((p) => `<li>
<cite>${esc(p.title)}</cite>${flag(p)}
<span class="muted">${esc(p.journal)}, ${esc(p.citation)}. ${esc(p.authorship)}.</span>
<span class="small"><a href="https://doi.org/${esc(p.doi)}" rel="noopener" target="_blank">DOI ${esc(p.doi)}</a>${p.pmid ? ` · <a href="https://pubmed.ncbi.nlm.nih.gov/${esc(p.pmid)}/" rel="noopener" target="_blank">PubMed ${esc(p.pmid)}</a>` : ""}</span>
</li>`).join("\n")}
</ol>
</section>` : ""}
${achievements.length ? `<section class="block"><h2>Notable work</h2><ul class="plain">${achievements.map((a) => `<li>${esc(a.label)}${flag(a)}</li>`).join("")}</ul></section>` : ""}
</div>`
      : ""
  );
}

// ---------- Patient Information ----------
{
  const bring = v(C.patientInfo.whatToBring);
  const insurance = v(C.practice.insurance);
  const referral = v(C.practice.referralRequired);
  const links = Object.entries({ booking: "Request an appointment", portal: "Patient portal", records: "Medical records", billing: "Billing" })
    .map(([k, label]) => ({ label, href: v(C.links[k]) }))
    .filter((l) => l.href);

  page(
    "patients.html",
    "Patients",
    "Patient information",
    `What to expect and what to bring to your visit with ${name}.`,
    bring || insurance || links.length || list(C.faq).length || !PRODUCTION
      ? `
<header class="page-head on-dark">${ecg("head-ecg")}<div class="wrap">
<h1>Preparing for your visit</h1>
<p class="lede">What happens at a first visit, what to bring, and answers to common questions.</p>
</div></header>
${stepsSection()}
<div class="wrap prose-grid">
<div>
${bring ? `
<section class="block">
<h2>What to bring${flag(C.patientInfo.whatToBring)}</h2>
<ul class="checklist">${bring.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
</section>` : ""}
${insurance || referral != null || phone || !PRODUCTION ? `<section class="block">
<h2>Insurance and referrals</h2>
${insurance ? `<ul class="plain">${insurance.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : pending("accepted insurance plans")}
${referral != null ? `<p>${esc(referral)}</p>` : pending("referral requirements and self-pay policy")}
${phone ? `<p>Coverage varies by plan, so please call the office at <a href="${telHref(phone)}">${esc(phone)}</a> to confirm before your visit.</p>` : ""}
</section>` : ""}
</div>
<aside>
${links.length ? `<section class="block panel"><h2>Online services</h2><ul class="plain">${links.map((l) => `<li><a href="${esc(l.href)}" rel="noopener">${esc(l.label)}</a></li>`).join("")}</ul></section>` : PRODUCTION ? "" : `<section class="block panel">${pending("authorized booking, portal, records, and billing links")}</section>`}
${emergencyNote()}
</aside>
</div>
${faqSection({ id: "faq" })}`
      : ""
  );
}

// ---------- For referring physicians ----------
{
  const R = C.referrals || {};
  const intro = v(R.intro);
  const howTo = v(R.howTo);
  const include = v(R.include);
  const urgent = v(R.urgent);
  const after = v(R.afterVisit);
  const portal = v(R.portal);
  const hospitals = list(C.hospitals);
  const areas = list(C.areasOfCare);
  page(
    "referrals.html",
    "For physicians",
    "For referring physicians",
    `How to refer a patient to ${name}: fax, what to include, hospital affiliations, and NPI.`,
    hasReferrals
      ? `
<header class="page-head on-dark">${ecg("head-ecg")}<div class="wrap">
<h1>Referring a patient to ${esc(shortName)}</h1>
${intro ? `<p class="lede">${esc(intro)}${flag(R.intro)}</p>` : ""}
</div></header>
<div class="wrap prose-grid referral-grid">
<div>
<section class="block">
<h2>How to refer</h2>
${howTo ? `<p>${esc(howTo)}${flag(R.howTo)}</p>` : ""}
<dl class="contact-list">
${fax ? `<div><dt>Referral fax</dt><dd><strong class="fax-number">${esc(fax)}</strong>${flag(C.contact.fax)}</dd></div>` : ""}
${phone ? `<div><dt>Office phone</dt><dd><a href="${telHref(phone)}" data-event="call">${esc(phone)}</a>${flag(C.contact.phone)}</dd></div>` : ""}
${portal ? `<div><dt>Referral portal</dt><dd><a href="${esc(portal)}" rel="noopener">${esc(portal)}</a></dd></div>` : !PRODUCTION ? `<div><dt>Referral portal</dt><dd>${pending(R.portal?.note || "referral portal")}</dd></div>` : ""}
${npi ? `<div><dt>Physician NPI</dt><dd>${esc(npi)}${flag(C.physician.npi)}</dd></div>` : ""}
</dl>
</section>
${include ? `
<section class="block">
<h2>What to include${flag(R.include)}</h2>
<ul class="checklist">${include.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
</section>` : ""}
${urgent || after ? `
<section class="block">
<h2>Urgent requests and follow-up</h2>
${urgent ? `<p>${esc(urgent)}${flag(R.urgent)}</p>` : ""}
${after ? `<p>${esc(after)}${flag(R.afterVisit)}</p>` : ""}
</section>` : ""}
</div>
<aside>
${areas.length ? `
<section class="block panel">
<h2>Conditions seen</h2>
<ul class="plain">${areas.map((a) => `<li><a href="care.html#${a.id}">${esc(a.title)}</a> <span class="muted small">· ${esc(settingLabel[a.setting])}</span>${flag(a)}</li>`).join("")}</ul>
</section>` : ""}
${hospitals.length ? `
<section class="block panel">
<h2>Hospital affiliations</h2>
<ul class="plain">${hospitals.map((h) => `<li>${esc(h.name)}${flag(h)}</li>`).join("")}</ul>
</section>` : ""}
<button class="btn btn-secondary print-btn" type="button" data-print hidden>Print this page for your front desk</button>
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
    "Office location and phone",
    `Office location, telephone, and directions for ${name}.`,
    addr || phone || !PRODUCTION
      ? `
<header class="page-head on-dark">${ecg("head-ecg")}<div class="wrap">
<h1>Office location and phone</h1>
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
${hasCurrentInfo ? `<section class="block panel" id="current">
<h2>Current patients</h2>
<dl class="ops-list">
${[["Prescription refills", "refills"], ["Test results", "results"], ["Medical records", "records"], ["After hours", "afterHours"]]
  .map(([label, k]) => (v(ops[k]) ? `<div><dt>${label}</dt><dd>${esc(v(ops[k]))}</dd></div>` : PRODUCTION ? "" : `<div><dt>${label}</dt><dd>${pending(ops[k]?.note || label)}</dd></div>`))
  .join("\n")}
</dl>
</section>` : ""}
<section class="block panel">
<h2>Before you call</h2>
<p>Please have your insurance information and your referring physician's name ready.</p>
<p class="small muted">To protect your privacy, please do not send medical details through this website.</p>
</section>
</aside>
</div>`
      : ""
  );
}

// ---------- asset pipeline (minify + content hash) ----------
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const hashedName = (file, buf) => `${basename(file, extname(file))}.${hash(buf)}${extname(file)}`;

/** Conservative CSS minifier: strips comments and redundant whitespace only. */
const minifyCss = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,>])\s*/g, "$1")
    .replace(/:\s+/g, ":")
    .replace(/;}/g, "}")
    .trim();
/** Conservative JS minifier: strips whole-line comments and indentation only. */
const minifyJs = (js) =>
  js
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    .join("\n");
/** HTML: drop indentation and blank lines (newlines kept, so inline spacing is unchanged). */
const minifyHtml = (html) =>
  html
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

const assets = {};
function buildAssets() {
  mkdirSync(join(OUT, "assets/fonts"), { recursive: true });
  // Fonts first, so the stylesheet can point at their hashed names.
  let css = readFileSync(join(SRC, "styles.css"), "utf8");
  for (const f of readdirSync(join(SRC, "fonts"))) {
    const buf = readFileSync(join(SRC, "fonts", f));
    const out = f.endsWith(".woff2") ? hashedName(f, buf) : f;
    writeFileSync(join(OUT, "assets/fonts", out), buf);
    if (f.endsWith(".woff2")) {
      css = css.split(`fonts/${f}`).join(`fonts/${out}`);
      assets[f] = `assets/fonts/${out}`;
    }
  }
  const cssMin = minifyCss(css);
  assets.css = `assets/${hashedName("styles.css", cssMin)}`;
  writeFileSync(join(OUT, assets.css), cssMin);
  const jsMin = minifyJs(readFileSync(join(SRC, "main.js"), "utf8"));
  assets.js = `assets/${hashedName("main.js", jsMin)}`;
  writeFileSync(join(OUT, assets.js), jsMin);
  // Everything else (favicon, portrait and office photos) is copied as-is.
  for (const f of readdirSync(SRC)) {
    if (["styles.css", "main.js", "fonts"].includes(f) || statSync(join(SRC, f)).isDirectory()) continue;
    copyFileSync(join(SRC, f), join(OUT, "assets", f));
  }
}

// Tiny inline script: marks JS as available before first paint, so the mobile menu never flashes open.
const INLINE_JS = 'document.documentElement.classList.add("js")';
const INLINE_JS_HASH = createHash("sha256").update(INLINE_JS).digest("base64");

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
  const navItem = (x) => `<li><a href="${x.file}"${x.file === p.file ? ' aria-current="page"' : ""}>${esc(x.navLabel)}</a></li>`;
  const nav = pages.filter((x) => x.file !== "index.html").map(navItem).join("");
  const footerNav = pages.map(navItem).join("");
  const year = new Date().getFullYear();
  const url = v(C.site.url);
  const fullTitle = p.file === "index.html" ? `${name} | Cardiologist in Tampa, FL` : `${p.title} | ${name}`;
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
<link rel="preload" href="${assets["source-serif-4.woff2"]}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${assets["source-sans-3.woff2"]}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(p.description)}">
${url ? `<meta property="og:url" content="${esc(url.replace(/\/$/, "") + "/" + (p.file === "index.html" ? "" : p.file))}">
<meta property="og:image" content="${esc(url.replace(/\/$/, ""))}/assets/og-image.png">` : ""}
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script>${INLINE_JS}</script>
${structuredData()}
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
${PRODUCTION ? "" : `<div class="staging-banner" role="note"><strong>Staging preview.</strong> Items marked <span class="flag">Unverified</span> come from public records and need practice confirmation. They are left out of the production build. <button type="button" class="marker-toggle" data-toggle-markers aria-pressed="false">Hide review markers</button></div>`}
<header class="site-header">
<div class="wrap header-inner">
<a class="brand" href="index.html">
<svg class="brand-mark" aria-hidden="true" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M5 17h6l2.5-6 4 11 3-7H27" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
<span><span class="brand-name">${esc(name)}</span><span class="brand-sub">${practiceName ? esc(practiceName) : "Cardiology · Tampa, FL"}</span></span>
</a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="visually-hidden">Open menu</span><span class="bars" aria-hidden="true"></span></button>
<nav id="site-nav" class="site-nav" aria-label="Main">
<ul>${nav}</ul>
${callButton("btn btn-primary btn-sm nav-call")}
</nav>
</div>
</header>
<main id="main" tabindex="-1">
${p.body}
${p.file === "index.html" || p.file === "contact.html" ? "" : closing()}
</main>
<footer class="site-footer">
<div class="wrap footer-grid">
<div>
<p class="footer-name">${esc(name)}</p>
${practiceName ? `<p>${esc(practiceName)}</p>` : ""}
${addr ? `<address>${addrLines(addr).map(esc).join("<br>")}</address>` : ""}
${phone ? `<p>Tel <a href="${telHref(phone)}" data-event="call">${esc(phone)}</a>${fax ? ` · Fax ${esc(fax)}` : ""}</p>` : ""}
${hasReferrals && pages.some((x) => x.file === "referrals.html") ? `<p class="footer-ref"><a href="referrals.html">Referring physicians</a>${fax ? `: fax ${esc(fax)}` : ""}${npi ? ` · NPI ${esc(npi)}` : ""}</p>` : ""}
</div>
<nav aria-label="Footer"><ul class="plain footer-nav">${footerNav}</ul></nav>
<div class="footer-emergency">
<p><strong>Medical emergency?</strong> Call 911. This website is for general information only. It is not medical advice and it is not a way to reach the office urgently.</p>
</div>
</div>
<div class="wrap footer-legal"><p>© ${year} ${esc(legal || name)}. All rights reserved.</p></div>
</footer>
${phone || addr ? `<div class="mobile-bar">${callButton("mb-call")}${addr ? `<a href="${mapsHref(addr)}" rel="noopener" target="_blank">Get directions<span class="visually-hidden"> (opens Google Maps in a new tab)</span></a>` : ""}</div>` : ""}
<script src="${assets.js}" defer></script>
</body>
</html>
`;
}

// ---------- hosting files ----------
function headersFile() {
  // Netlify / Cloudflare Pages format. Other hosts: mirror these as server config.
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'sha256-${INLINE_JS_HASH}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join("; ");
  return `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
${PRODUCTION ? "" : "  X-Robots-Tag: noindex, nofollow\n"}
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/assets/favicon.svg
  Cache-Control: public, max-age=86400

/*.html
  Cache-Control: public, max-age=0, must-revalidate
`;
}

// ---------- content-gaps report ----------
function gaps() {
  const rows = { draft: [], public: [], lead: [], missing: [] };
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
    if (node && typeof node === "object") {
      if (typeof node.status === "string" && node.status !== "confirmed" && rows[node.status]) {
        const label = node.q || node.label || node.title || node.name || node.stage || (typeof node.value === "string" ? node.value : "");
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

## Draft copy: needs Dr. Abela's approval (${rows.draft.length})
Written for the site from public facts or as standard practice wording. Shown in staging with a "Draft" marker.

${table(rows.draft)}

## Public record: needs practice confirmation (${rows.public.length})
These appear in staging with an "Unverified" marker.

${table(rows.public)}

## Secondary leads: not rendered anywhere (${rows.lead.length})
${table(rows.lead)}
`;
}

// ---------- write ----------
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
buildAssets();
const html = {};
for (const p of pages) {
  html[p.file] = minifyHtml(layout(p));
  writeFileSync(join(OUT, p.file), html[p.file]);
}
writeFileSync(join(OUT, "_headers"), headersFile());
// 404 page: uses the shared layout, never listed in navigation.
html["404.html"] = minifyHtml(layout({
  file: "404.html", title: "Page not found", description: "This page could not be found.",
  body: `<header class="page-head on-dark">${ecg("head-ecg")}<div class="wrap"><h1>Page not found</h1><p class="lede">The page you were looking for has moved or does not exist.</p><div class="actions"><a class="btn btn-primary" href="index.html"><span>Go to the home page</span>${icon("arrow")}</a>${callButton("btn btn-secondary")}</div></div></header>`,
}));
writeFileSync(join(OUT, "404.html"), html["404.html"]);

const siteUrl = v(C.site.url);
if (PRODUCTION) {
  const base = siteUrl ? siteUrl.replace(/\/$/, "") : null;
  writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ""}`);
  if (base) {
    const urls = pages.map((p) => `<url><loc>${esc(base + "/" + (p.file === "index.html" ? "" : p.file))}</loc></url>`).join("");
    writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
  }
  // Guard: nothing from staging may reach a production build.
  const leaks = Object.entries(html).filter(([, h]) => /class="flag"|class="pending"|staging-banner|noindex/.test(h));
  if (leaks.length) {
    console.error(`Production build contains staging markers in: ${leaks.map(([f]) => f).join(", ")}`);
    process.exit(1);
  }
} else {
  writeFileSync(join(OUT, "robots.txt"), "User-agent: *\nDisallow: /\n");
}
writeFileSync(join(ROOT, "CONTENT-GAPS.md"), gaps());

// ---------- size report ----------
const kb = (n) => (n / 1024).toFixed(1) + " KB";
const size = (rel) => statSync(join(OUT, rel)).size;
const gz = (rel) => gzipSync(readFileSync(join(OUT, rel))).length;
const shared = [assets.css, assets.js, assets["source-serif-4.woff2"], assets["source-sans-3.woff2"]];
console.log(`Built ${pages.length} page(s) [${MODE}] -> dist/`);
for (const p of pages) console.log(`  ${p.file.padEnd(14)} ${kb(size(p.file)).padStart(9)}  (${kb(gz(p.file))} gzip)`);
for (const a of shared) console.log(`  ${basename(a).padEnd(32)} ${kb(size(a)).padStart(9)}${a.endsWith(".woff2") ? "" : `  (${kb(gz(a))} gzip)`}`);
const firstLoad = gz("index.html") + gz(assets.css) + gz(assets.js) + size(assets["source-serif-4.woff2"]) + size(assets["source-sans-3.woff2"]);
console.log(`  Home page first load, compressed: ${kb(firstLoad)}`);
