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
