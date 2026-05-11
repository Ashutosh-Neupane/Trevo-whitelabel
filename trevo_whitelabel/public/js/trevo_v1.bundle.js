/**
 * Trevo Whitelabel Engine
 * Implements: logo swap, ⌘K search, density toggle,
 * sidebar group labels, app name relabelling.
 * ~120 lines. No framework. Hooks into frappe.ui.form events.
 */
(function () {
  "use strict";

  const LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";

  const APP_NAMES = {
    "Frappe Framework": "Trevo Engine",
    "Frappe":           "Trevo Engine",
    "ERPNext":          "Trevo Commerce",
    "Frappe HR":        "Trevo People",
    "HRMS":             "Trevo People",
  };

  // ── Favicon ──────────────────────────────────────────────────
  (function setFavicon() {
    let el = document.querySelector("link[rel~='icon']");
    if (!el) { el = document.createElement("link"); el.rel = "icon"; document.head.appendChild(el); }
    el.href = LOGO;
  })();

  // ── Logo replacement ─────────────────────────────────────────
  function replaceLogos() {
    document.querySelectorAll(
      ".navbar-home img, .app-logo img, img[src*='frappe-logo'], img[alt='Frappe'], #brand-logo"
    ).forEach(img => {
      if (!img.src || img.src.includes("frappe") || img.src.includes("erpnext")) {
        img.src = LOGO;
        img.style.cssText = "max-height:28px;width:auto;";
      }
    });

    // Sidebar header logo
    document.querySelectorAll(".header-logo-container img").forEach(img => {
      img.src = LOGO;
      img.style.cssText = "width:100%;height:100%;object-fit:contain;padding:2px;";
    });

    // Sidebar header title
    document.querySelectorAll(".header-title").forEach(el => {
      if (["ERPNext", "Frappe"].includes(el.textContent.trim())) el.textContent = "Trevo";
    });
    document.querySelectorAll(".header-subtitle").forEach(el => {
      if (el.textContent.includes("ERPNext") || el.textContent.includes("Frappe") || el.textContent.match(/^v\d/)) {
        el.textContent = "Trevo Cloud";
      }
    });
  }

  // ── App name relabelling ─────────────────────────────────────
  function relabelText() {
    document.querySelectorAll(".header-title, .app-version b").forEach(el => {
      const t = el.textContent.trim();
      if (APP_NAMES[t]) el.textContent = APP_NAMES[t];
    });
  }

  // ── ⌘K / Ctrl+K → frappe search ─────────────────────────────
  function setupCmdK() {
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (typeof frappe !== "undefined" && frappe.search) {
          frappe.search.show();
        }
      }
    }, { capture: true });
  }

  // ── Density toggle ───────────────────────────────────────────
  // Reads from localStorage; JS sets body[data-density]; CSS responds.
  function setupDensityToggle() {
    const saved = localStorage.getItem("trevo-density") || "comfortable";
    document.body.setAttribute("data-density", saved);
  }

  // Expose globally so a toolbar button can call it
  window.trevo = window.trevo || {};
  window.trevo.setDensity = function (mode) {
    document.body.setAttribute("data-density", mode);
    localStorage.setItem("trevo-density", mode);
  };

  // ── Login page ───────────────────────────────────────────────
  function fixLoginPage() {
    const $head = document.querySelector(".page-card-head");
    if (!$head || $head.dataset.trevo) return;
    $head.dataset.trevo = "1";

    const img = $head.querySelector("img");
    if (img) { img.src = LOGO; img.style.cssText = "max-height:48px;display:block;margin:0 auto 16px;"; }

    const h4 = $head.querySelector("h4");
    if (h4) { h4.textContent = "Welcome to Trevo"; }

    if (!$head.querySelector(".trevo-sub")) {
      const sub = document.createElement("p");
      sub.className = "trevo-sub";
      sub.style.cssText = "color:var(--tv-text-3);font-size:13px;text-align:center;margin:4px 0 0;";
      sub.textContent = "Unified Digital Ecosystem";
      $head.appendChild(sub);
    }
  }

  // ── Main apply ───────────────────────────────────────────────
  function apply() {
    replaceLogos();
    relabelText();
    fixLoginPage();
  }

  // ── Boot ─────────────────────────────────────────────────────
  setupDensityToggle();
  setupCmdK();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  if (typeof $ !== "undefined") {
    $(document).on("app_ready", apply);
    $(document).on("page-change", () => setTimeout(apply, 150));
  }

  // MutationObserver — catch logo re-renders after navigation
  let _t;
  new MutationObserver(() => { clearTimeout(_t); _t = setTimeout(apply, 400); })
    .observe(document.body, { childList: true, subtree: true });

})();
