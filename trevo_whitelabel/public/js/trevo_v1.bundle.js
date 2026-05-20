/**
 * Trevo Whitelabel Engine
 * Implements: logo swap, ⌘K search, density toggle,
 * sidebar group labels, app name relabelling.
 * ~120 lines. No framework. Hooks into frappe.ui.form events.
 */
(function () {
  "use strict";

  const LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";
  const SIDEBAR_WIDTH = 272;
  let sidebarObserver;

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

    // Replace raw .header-logo div that Frappe renders with build.svg
    document.querySelectorAll(".header-logo").forEach(el => {
      const img = el.querySelector("img");
      if (img && (img.src.includes("build.svg") || img.src.includes("/frappe/icons/"))) {
        img.src = LOGO;
        img.alt = "Trevo";
        img.style.cssText = "max-height:28px;width:auto;object-fit:contain;";
      }
    });

    // Sidebar header logo container
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

  function ensureSidebarBranding() {
    // Frappe renders .sidebar-header with .header-logo > img (build.svg) and
    // .header-title / .header-subtitle text. We only fix text here.
    // The img swap is handled by replaceLogos() targeting .header-logo img.
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

  function syncSidebarWidth() {
    const sidebar = document.querySelector(".body-sidebar");
    if (!sidebar) return;

    const applySidebarWidth = () => {
      let width = Math.round(sidebar.getBoundingClientRect().width);
      if (!width || width <= 0) {
        width = SIDEBAR_WIDTH;
      }
      document.documentElement.style.setProperty("--tv-sidebar-w", `${width}px`);
      document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
      window.dispatchEvent(new Event("resize"));
    };

    applySidebarWidth();

    if (sidebarObserver) {
      sidebarObserver.disconnect();
    }

    if (typeof ResizeObserver !== "undefined") {
      sidebarObserver = new ResizeObserver(() => applySidebarWidth());
      sidebarObserver.observe(sidebar);
    }
  }

  // ── Avatar Menu Customization ────────────────────────────────
  function customizeAvatarMenu() {
    // Remove "About" and update "Support" link in user menu
    const userMenu = document.querySelector('.dropdown-navbar-user, .navbar-user');
    if (!userMenu) return;

    userMenu.querySelectorAll('li, a, .dropdown-item').forEach(el => {
      const text = el.textContent.trim().toLowerCase();
      
      // Remove About section
      if (text.includes("about")) {
        el.style.setProperty('display', 'none', 'important');
        el.classList.add('hidden');
      }

      // Update Support link
      if (text.includes("support")) {
        const link = el.tagName === 'A' ? el : el.querySelector('a');
        if (link) {
          link.href = 'https://trevocloud.com';
          link.target = '_blank';
          link.removeAttribute('data-toggle');
          link.removeAttribute('onclick');
          // Force click event to prevent Frappe's internal handler
          link.addEventListener('click', (e) => {
             e.stopPropagation();
          }, { capture: true });
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

  // ── Title Rebranding ─────────────────────────────────────────
  function rebrandTitle() {
    const t = document.title;
    if (t.includes("Frappe") || t.includes("ERPNext")) {
      const nt = t.replace(/Frappe Framework/g, "Trevo Engine")
                  .replace(/Frappe Cloud/g, "Trevo Cloud")
                  .replace(/Frappe/g, "Trevo")
                  .replace(/ERPNext/g, "Trevo Next");
      if (t !== nt) {
        document.title = nt;
      }
    }
  }

  // ── Override About Dialog ────────────────────────────────────
  function overrideAboutDialog() {
    if (typeof frappe !== "undefined" && !frappe._trevo_about_overridden) {
      frappe._trevo_about_overridden = true;
      frappe.show_about = function() {
        const d = new frappe.ui.Dialog({
          title: __("About Trevo"),
          fields: [
            {
              fieldtype: "HTML",
              options: `
                <div class="text-center" style="padding: 10px 0; font-family: var(--tv-font-sans);">
                  <img src="${LOGO}" style="max-height: 48px; display: block; margin: 0 auto 12px; filter: drop-shadow(0 2px 4px rgba(20,32,26,0.06));">
                  <h4 style="font-weight: 700; color: var(--tv-deep-900); margin-bottom: 4px; font-size: 16px;">Trevo Cloud</h4>
                  <p style="color: var(--tv-text-3); font-size: 13px; margin-bottom: 16px;">Unified Digital Lending & Commerce Ecosystem</p>
                  <div style="border-top: 1px solid var(--tv-line); padding-top: 16px; text-align: left; font-size: 13px;">
                    <p style="margin-bottom: 8px; color: var(--tv-text-2);"><strong>Version:</strong> Trevo Next v1.0.0</p>
                    <p style="margin-bottom: 8px; color: var(--tv-text-2);"><strong>Engine:</strong> Trevo Engine v16</p>
                    <p style="margin-bottom: 16px; color: var(--tv-text-2);"><strong>Publisher:</strong> Dots and Dashes Technology Limited</p>
                    <p style="color: var(--tv-text-3); font-size: 12px; line-height: 1.4; margin-bottom: 0;">
                      Trevo is a premium enterprise resource management platform designed for modern financial institutions, dynamic supply chains, and ecommerce operators.
                    </p>
                  </div>
                </div>
              `
            }
          ]
        });
        d.show();
        if (d.$wrapper) {
          d.$wrapper.find('.modal-content').css({
            'border-radius': 'var(--tv-r-5)',
            'box-shadow': 'var(--tv-sh-3)'
          });
        }
      };
    }
  }


  // ── Sidebar collapse toggle ──────────────────────────────────
  // Frappe toggles sidebar via a button that adds/removes classes.
  // We watch for that and apply our icon-only collapsed state.
  function watchSidebarCollapse() {
    const sidebar = document.querySelector(".body-sidebar, .desk-sidebar");
    if (!sidebar) return;

    // Observe class changes on sidebar and its parent
    const observer = new MutationObserver(() => {
      const isCollapsed =
        sidebar.classList.contains("sidebar-collapsed") ||
        sidebar.classList.contains("closed") ||
        sidebar.style.width === "0px" ||
        parseInt(sidebar.style.width || "999") < 100;

      if (isCollapsed) {
        sidebar.classList.add("sidebar-collapsed");
      } else {
        sidebar.classList.remove("sidebar-collapsed");
      }
    });

    observer.observe(sidebar, { attributes: true, attributeFilter: ["class", "style"] });

    // Also watch the toggle button
    document.querySelectorAll(".sidebar-toggle-btn, [data-toggle='sidebar'], .toggle-sidebar").forEach(btn => {
      btn.addEventListener("click", () => {
        setTimeout(() => {
          const w = parseInt(getComputedStyle(sidebar).width);
          if (w < 100) {
            sidebar.classList.add("sidebar-collapsed");
          } else {
            sidebar.classList.remove("sidebar-collapsed");
          }
        }, 250);
      });
    });
  }

  // ── Main apply ───────────────────────────────────────────────
  function apply() {
    ensureSidebarBranding();
    watchSidebarCollapse();
    syncSidebarWidth();
    replaceLogos();
    relabelText();
    fixLoginPage();
    customizeAvatarMenu();
    rebrandTitle();
    overrideAboutDialog();
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
