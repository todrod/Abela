#!/usr/bin/env node
// Renders the link-preview image (og-image.png, 1200x630) and the Apple touch icon (180x180)
// into src/assets/. Optional dev tool: needs Playwright with Chromium. Rerun only when the brand changes.
//   node scripts/make-share-images.mjs
// The share image uses only the physician's name and specialty (confirmed facts), never draft copy.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "src/assets");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const C = JSON.parse(readFileSync(join(ROOT, "content/site.json"), "utf8"));
const name = C.physician.name.value;

const ecg = `<svg viewBox="0 0 1200 200" preserveAspectRatio="none" style="position:absolute;left:0;right:0;bottom:70px;width:100%;height:150px">
<path d="M0 120 H640 l22 -16 l16 16 H720 l16 -92 l20 156 l18 -104 l12 40 H860 l24 -22 l20 22 H1200" fill="none" stroke="#f0a58f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity=".7"/></svg>`;

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:S;src:url(/fonts/source-serif-4.woff2) format("woff2");font-weight:200 900}
@font-face{font-family:A;src:url(/fonts/source-sans-3.woff2) format("woff2");font-weight:200 900}
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
body{position:relative;background:radial-gradient(80% 90% at 85% 10%,#234d78 0%,transparent 60%),#14304f;color:#fff;font-family:A}
</style></head><body>${body}</body></html>`;

const og = page(`<div style="position:absolute;left:80px;top:80px;right:80px">
<div style="display:flex;align-items:center;gap:18px;font:600 30px/1 A;color:#d3dee9">
<svg width="56" height="56" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#fff"/><path d="M5 17h6l2.5-6 4 11 3-7H27" fill="none" stroke="#14304f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>Cardiology</div>
<div style="font:600 92px/1.02 S;letter-spacing:-.02em;margin-top:56px;max-width:900px">${name}</div></div>${ecg}`, 1200, 630);

const icon = page(`<div style="position:absolute;inset:0;display:grid;place-items:center">
<svg width="120" height="120" viewBox="0 0 32 32"><path d="M3 17h7l2.5-6 4 11 3-7H29" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`, 180, 180);

const server = createServer((req, res) => {
  if (req.url === "/og") return res.end(og);
  if (req.url === "/icon") return res.end(icon);
  try { res.end(readFileSync(join(ASSETS, req.url))); } catch { res.statusCode = 404; res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch();
for (const [path, w, h, out] of [["/og", 1200, 630, "og-image.png"], ["/icon", 180, 180, "apple-touch-icon.png"]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto(`http://localhost:${port}${path}`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(ASSETS, out) });
  console.log("wrote src/assets/" + out);
}
await browser.close();
server.close();
