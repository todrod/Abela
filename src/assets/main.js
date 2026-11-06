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
