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

// Fade sections in as they scroll into view. Anything already on screen at load is shown
// immediately, so content never "pops in" above the fold. CSS skips this under reduced motion.
(() => {
  const els = [...document.querySelectorAll(".reveal")];
  if (!("IntersectionObserver" in window)) return;
  els.forEach((el) => { if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in"); });
  document.documentElement.classList.add("reveal-on");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px" });
  els.filter((el) => !el.classList.contains("in")).forEach((el) => io.observe(el));
})();
