/**
 * Trevo Whitelabel Engine v2
 * Fixes: mobile sidebar overlay, desktop sidebar toggle,
 * nested child items, navbar search, edit-mode button hiding.
 */
(function () {
  "use strict";

  const LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";
  const SIDEBAR_WIDTH = 272;
  let sidebarObserver;
  let _applyTimer;

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
      ".navbar-home img, .app-logo img, img[src*='frappe-logo'], img[src*='frappe-framework-logo'], img[alt='Frappe'], #brand-logo"
    ).forEach(img => {
      if (!img.src || img.src.includes("frappe") || img.src.includes("erpnext")) {
        img.src = LOGO;
        img.style.cssText = "max-height:28px;width:auto;";
      }
    });

    document.querySelectorAll(".header-logo").forEach(el => {
      const img = el.querySelector("img");
      if (img && (img.src.includes("build.svg") || img.src.includes("/frappe/icons/"))) {
        img.src = LOGO;
        img.alt = "Trevo";
        img.style.cssText = "max-height:28px;width:auto;object-fit:contain;";
      }
    });

    document.querySelectorAll(".header-logo-container img").forEach(img => {
      img.src = LOGO;
      img.style.cssText = "width:100%;height:100%;object-fit:contain;padding:2px;";
    });

    document.querySelectorAll(".header-title").forEach(el => {
      if (["ERPNext", "Frappe"].includes(el.textContent.trim())) el.textContent = "Trevo";
    });
    document.querySelectorAll(".header-subtitle").forEach(el => {
      if (el.textContent.includes("ERPNext") || el.textContent.includes("Frappe") || el.textContent.match(/^v\d/)) {
        el.textContent = "Trevo Cloud";
      }
    });
  }

  function ensureSidebarBranding() {
    document.querySelectorAll(".header-title").forEach(el => {
      const t = el.textContent.trim();
      if (!t || t === "Trevo") return;
      el.textContent = "Trevo";
    });
    document.querySelectorAll(".header-subtitle").forEach(el => {
      const t = el.textContent.trim();
      if (t === "Trevo Cloud") return;
      el.textContent = "Trevo Cloud";
    });
  }

  // ── Sidebar width sync ───────────────────────────────────────
  function syncSidebarWidth() {
    const sidebar = document.querySelector(".body-sidebar");
    if (!sidebar) return;

    const applySidebarWidth = () => {
      let width = Math.round(sidebar.getBoundingClientRect().width);
      if (!width || width <= 0) width = SIDEBAR_WIDTH;
      document.documentElement.style.setProperty("--tv-sidebar-w", `${width}px`);
      document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
    };

    applySidebarWidth();

    if (sidebarObserver) sidebarObserver.disconnect();
    if (typeof ResizeObserver !== "undefined") {
      sidebarObserver = new ResizeObserver(applySidebarWidth);
      sidebarObserver.observe(sidebar);
    }
  }

  // ── Mobile sidebar overlay ───────────────────────────────────
  // Frappe's sidebar toggle adds/removes .hidden on .body-sidebar.
  // On mobile we intercept this to show/hide an overlay instead.
  let _overlay = null;

  function getOverlay() {
    if (_overlay) return _overlay;
    _overlay = document.createElement("div");
    _overlay.id = "tv-sidebar-overlay";
    _overlay.style.cssText = [
      "position:fixed", "inset:0", "background:rgba(0,0,0,0.35)",
      "z-index:499", "display:none", "backdrop-filter:blur(2px)",
      "-webkit-backdrop-filter:blur(2px)"
    ].join(";");
    _overlay.addEventListener("click", closeMobileSidebar);
    document.body.appendChild(_overlay);
    return _overlay;
  }

  function isMobile() {
    return window.innerWidth <= 767;
  }

  function openMobileSidebar() {
    const sidebar = document.querySelector(".body-sidebar");
    if (!sidebar) return;
    sidebar.classList.remove("hidden");
    sidebar.style.transform = "translateX(0)";
    sidebar.style.visibility = "visible";
    getOverlay().style.display = "block";
    document.body.style.overflow = "hidden";
  }

  function closeMobileSidebar() {
    const sidebar = document.querySelector(".body-sidebar");
    if (!sidebar) return;
    sidebar.style.transform = "translateX(-100%)";
    getOverlay().style.display = "none";
    document.body.style.overflow = "";
    // After transition, let Frappe add .hidden back
    setTimeout(() => {
      if (isMobile()) sidebar.classList.add("hidden");
    }, 260);
  }

  function setupMobileSidebar() {
    if (!isMobile()) return;

    const sidebar = document.querySelector(".body-sidebar");
    if (!sidebar || sidebar._tvMobileSetup) return;
    sidebar._tvMobileSetup = true;

    // Ensure sidebar starts closed on mobile
    sidebar.classList.add("hidden");
    sidebar.style.transform = "translateX(-100%)";

    // Intercept Frappe's collapse-sidebar-link (the "Collapse" button)
    sidebar.addEventListener("click", e => {
      const collapseLink = e.target.closest(".collapse-sidebar-link");
      if (collapseLink && isMobile()) {
        e.preventDefault();
        e.stopPropagation();
        closeMobileSidebar();
      }
    });

    // Watch for Frappe removing .hidden (sidebar open event)
    const obs = new MutationObserver(() => {
      if (isMobile() && !sidebar.classList.contains("hidden")) {
        openMobileSidebar();
      }
    });
    obs.observe(sidebar, { attributes: true, attributeFilter: ["class"] });
  }

  // ── Navbar hamburger → open mobile sidebar ───────────────────
  function setupNavbarToggle() {
    // Frappe's navbar toggle button has data-toggle="collapse" targeting .body-sidebar
    // On mobile we intercept it
    document.addEventListener("click", e => {
      if (!isMobile()) return;

      // Frappe sidebar toggle buttons
      const toggle = e.target.closest(
        "[data-toggle='collapse'][data-target*='sidebar'], " +
        ".navbar-toggler, " +
        ".sidebar-toggle-btn, " +
        "[data-action='toggle_sidebar']"
      );
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        const sidebar = document.querySelector(".body-sidebar");
        if (!sidebar) return;
        if (sidebar.classList.contains("hidden") || sidebar.style.transform === "translateX(-100%)") {
          openMobileSidebar();
        } else {
          closeMobileSidebar();
        }
      }
    }, true);
  }

  // ── Nested sidebar children — fix toggle ─────────────────────
  // Frappe uses .drop-icon button inside .sidebar-item-control to toggle
  // .sidebar-child-item.nested-container visibility.
  // The issue: our CSS sets overflow:hidden on .body-sidebar which clips
  // the nested containers. We need to ensure they render correctly.
  function fixNestedSidebarItems() {
    // Ensure nested containers that are NOT .hidden are visible
    document.querySelectorAll(".sidebar-child-item.nested-container").forEach(el => {
      if (!el.classList.contains("hidden")) {
        el.style.display = "";
        el.style.overflow = "visible";
      }
    });

    // Fix the drop-icon chevron buttons — Frappe handles the toggle,
    // but we need to ensure the parent .body-sidebar doesn't clip children
    const sidebar = document.querySelector(".body-sidebar");
    if (sidebar) {
      sidebar.style.overflow = "hidden auto";
      sidebar.style.overflowX = "hidden";
    }
  }

  // ── Hide edit-mode controls (only visible in workspace edit mode) ─
  function hideEditModeControls() {
    // .sidebar-item-edit-controls.edit-mode should only show when
    // Frappe adds .edit-mode to .body-sidebar. Ensure they stay hidden otherwise.
    const sidebar = document.querySelector(".body-sidebar");
    if (!sidebar || sidebar.classList.contains("edit-mode")) return;

    document.querySelectorAll(".sidebar-item-edit-controls").forEach(el => {
      if (!el.classList.contains("hidden")) {
        el.classList.add("hidden");
      }
    });
  }

  // ── Navbar search visibility fix ─────────────────────────────
  function fixNavbarSearch() {
    const navbar = document.querySelector(".navbar");
    if (!navbar) return;

    // Ensure search bar is visible and properly sized
    const searchBar = navbar.querySelector(".search-bar, #navbar-search-container, .form-control.search-bar");
    if (searchBar) {
      searchBar.style.removeProperty("display");
      searchBar.style.removeProperty("visibility");
    }

    // Fix navbar flex layout — ensure items don't overflow
    const navbarInner = navbar.querySelector(".container-fluid, .navbar-inner, .navbar-collapse");
    if (navbarInner) {
      navbarInner.style.cssText = "display:flex;align-items:center;width:100%;gap:8px;flex-wrap:nowrap;";
    }
  }

  // ── Avatar Menu Customization ────────────────────────────────
  function customizeAvatarMenu() {
    const userMenu = document.querySelector(".dropdown-navbar-user, .navbar-user");
    if (!userMenu) return;

    userMenu.querySelectorAll("li, a, .dropdown-item").forEach(el => {
      const text = el.textContent.trim().toLowerCase();

      if (text === "about" || (text.includes("about") && text.length < 20)) {
        el.style.setProperty("display", "none", "important");
        el.classList.add("hidden");
      }

      if (text.includes("support")) {
        const link = el.tagName === "A" ? el : el.querySelector("a");
        if (link) {
          link.href = "https://trevocloud.com";
          link.target = "_blank";
          link.removeAttribute("data-toggle");
          link.removeAttribute("onclick");
        }
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
  function setupDensityToggle() {
    const saved = localStorage.getItem("trevo-density") || "comfortable";
    document.body.setAttribute("data-density", saved);
  }

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

  // ── Title Rebranding ─────────────────────────────────────────
  function rebrandTitle() {
    const t = document.title;
    if (t.includes("Frappe") || t.includes("ERPNext")) {
      const nt = t.replace(/Frappe Framework/g, "Trevo Engine")
                  .replace(/Frappe Cloud/g, "Trevo Cloud")
                  .replace(/Frappe/g, "Trevo")
                  .replace(/ERPNext/g, "Trevo Next");
      if (t !== nt) document.title = nt;
    }
  }

  // ── Override About Dialog ────────────────────────────────────
  function overrideAboutDialog() {
    if (typeof frappe !== "undefined" && !frappe._trevo_about_overridden) {
      frappe._trevo_about_overridden = true;
      frappe.show_about = function() {
        const d = new frappe.ui.Dialog({
          title: __("About Trevo"),
          fields: [{
            fieldtype: "HTML",
            options: `
              <div class="text-center" style="padding:10px 0;font-family:var(--tv-font-sans);">
                <img src="${LOGO}" style="max-height:48px;display:block;margin:0 auto 12px;">
                <h4 style="font-weight:700;color:var(--tv-deep-900);margin-bottom:4px;font-size:16px;">Trevo Cloud</h4>
                <p style="color:var(--tv-text-3);font-size:13px;margin-bottom:16px;">Unified Digital Lending & Commerce Ecosystem</p>
                <div style="border-top:1px solid var(--tv-line);padding-top:16px;text-align:left;font-size:13px;">
                  <p style="margin-bottom:8px;color:var(--tv-text-2);"><strong>Version:</strong> Trevo Next v1.0.0</p>
                  <p style="margin-bottom:8px;color:var(--tv-text-2);"><strong>Engine:</strong> Trevo Engine v16</p>
                  <p style="margin-bottom:16px;color:var(--tv-text-2);"><strong>Publisher:</strong> Dots and Dashes Technology Limited</p>
                </div>
              </div>`
          }]
        });
        d.show();
      };
    }
  }

  // ── Main apply ───────────────────────────────────────────────
  function apply() {
    ensureSidebarBranding();
    syncSidebarWidth();
    replaceLogos();
    relabelText();
    fixLoginPage();
    customizeAvatarMenu();
    rebrandTitle();
    overrideAboutDialog();
    fixNavbarSearch();
    fixNestedSidebarItems();
    hideEditModeControls();
    setupMobileSidebar();
  }

  // ── Boot ─────────────────────────────────────────────────────
  setupDensityToggle();
  setupCmdK();
  setupNavbarToggle();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  if (typeof $ !== "undefined") {
    $(document).on("app_ready", apply);
    $(document).on("page-change", () => setTimeout(apply, 200));
  }

  // Handle window resize — re-evaluate mobile state
  window.addEventListener("resize", () => {
    if (!isMobile()) {
      // Desktop: ensure sidebar is visible, remove mobile transforms
      const sidebar = document.querySelector(".body-sidebar");
      if (sidebar) {
        sidebar.style.transform = "";
        sidebar.style.visibility = "";
        if (_overlay) _overlay.style.display = "none";
        document.body.style.overflow = "";
      }
    }
  });

  // MutationObserver — catch DOM changes
  new MutationObserver(() => {
    clearTimeout(_applyTimer);
    _applyTimer = setTimeout(apply, 350);
  }).observe(document.body, { childList: true, subtree: true });

})();
