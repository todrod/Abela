// Mobile navigation toggle. Without JS, the nav renders fully expanded.
(() => {
  const btn = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!btn || !nav) return;
  const label = btn.querySelector(".visually-hidden");
  const set = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("open", open);
    if (label) label.textContent = open ? "Close menu" : "Open menu";
  };
  btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { set(false); btn.focus(); }
  });
})();


// Mobile call bar: on pages with hero buttons, show it only once those buttons scroll out of view,
// so the same action never appears twice on one screen.
(() => {
  const bar = document.querySelector(".mobile-bar");
  const heroActions = document.querySelector(".hero .actions");
  if (!bar || !heroActions || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => bar.classList.toggle("is-hidden", e.isIntersecting)).observe(heroActions);
})();

// Motion hooks: pause the hero heartbeat when it is off screen; draw the visit steps when they arrive.
(() => {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".steps").forEach((s) => s.classList.add("in-view"));
    return;
  }
  const hero = document.querySelector(".hero.on-dark");
  if (hero) new IntersectionObserver(([e]) => hero.classList.toggle("is-offscreen", !e.isIntersecting)).observe(hero);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); } });
  }, { threshold: 0.35 });
  document.querySelectorAll(".steps").forEach((s) => io.observe(s));
})();

// Referral page: print button (hidden until this script runs).
(() => {
  const b = document.querySelector("[data-print]");
  if (!b) return;
  b.hidden = false;
  b.addEventListener("click", () => window.print());
})();

// Staging only: hide or show review markers for a clean preview. Remembered per browser.
(() => {
  const t = document.querySelector("[data-toggle-markers]");
  if (!t) return;
  const root = document.documentElement;
  const apply = (on) => {
    root.classList.toggle("hide-markers", on);
    t.setAttribute("aria-pressed", String(on));
    t.textContent = on ? "Show review markers" : "Hide review markers";
  };
  let saved = false;
  try { saved = localStorage.getItem("hide-markers") === "1"; } catch {}
  apply(saved);
  t.addEventListener("click", () => {
    const on = !root.classList.contains("hide-markers");
    apply(on);
    try { localStorage.setItem("hide-markers", on ? "1" : "0"); } catch {}
  });
})();
