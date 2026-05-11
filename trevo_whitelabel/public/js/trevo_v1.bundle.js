/**
 * TREVO CLOUD — Whitelabel Engine v3.0
 * Optimized for Premium Emerald Design & Unified Rebranding
 */
(function () {
  "use strict";

  const LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";
  
  // UNIFIED REBRANDING MAP
  const REBRAND_MAP = {
    // Apps & Modules
    "Accounting":       "Trevo Books",
    "HR":               "Trevo People",
    "Stock":            "Trevo Inventory",
    "CRM":              "Trevo CRM",
    "Selling":          "Trevo Sales",
    "Buying":           "Trevo Purchase",
    "Assets":           "Trevo Assets",
    "Projects":         "Trevo Projects",
    "Support":          "Trevo Support",
    "Payroll":          "Trevo Payroll",
    "Loan":             "Trevo Finance",
    "Retail":           "Trevo Retail",
    "Quality":          "Trevo Quality",
    "Manufacturing":    "Trevo Factory",
    "Education":        "Trevo Learn",
    "Healthcare":       "Trevo Health",
    "Agriculture":      "Trevo Agro",
    "Non Profit":       "Trevo Impact",
    "Hospitality":      "Trevo Stay",
    
    // Core Brand Names
    "Frappe Framework": "Trevo Engine",
    "Frappe":           "Trevo Engine",
    "ERPNext":          "Trevo Commerce",
    "Frappe HR":        "Trevo People",
    "HRMS":             "Trevo People",
    "Payments":         "Trevo Pay",
    "Lending":          "Trevo Finance",
    "Integrations":     "Trevo Connect",
    "Desk":             "Workspace"
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  function setFavicon(url) {
    let el = document.querySelector("link[rel~='icon']");
    if (!el) { el = document.createElement("link"); el.rel = "icon"; document.head.appendChild(el); }
    el.href = url;
  }

  function injectFonts() {
    if (document.getElementById("trevo-fonts")) return;
    const l = document.createElement("link");
    l.id = "trevo-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap";
    document.head.appendChild(l);
  }

  /* ── Rebranding Logic ────────────────────────────────────── */
  function replaceLogos() {
    document.querySelectorAll(
      ".navbar-home img, .app-logo img, img[src*='frappe-logo'], img[alt='Frappe'], #brand-logo"
    ).forEach(img => {
      if (!img.src || img.src.includes("frappe") || img.src.includes("erpnext") || img.src === "") {
        img.src = LOGO;
        img.style.maxHeight = "32px";
        img.style.width = "auto";
      }
    });

    // Sidebar header logo
    document.querySelectorAll(".header-logo-container img").forEach(img => {
      img.src = LOGO;
      img.style.cssText = "width:100%;height:100%;object-fit:contain;";
    });
  }

  function rebrandUI() {
    // 1. Rename sidebar items & headers
    document.querySelectorAll(".sidebar-item-label, .header-title, .title-text, .app-title").forEach(el => {
      const text = el.textContent.trim();
      if (REBRAND_MAP[text]) {
        el.textContent = REBRAND_MAP[text];
      }
    });

    // 2. Rename Workspace titles
    document.querySelectorAll(".workspace-sidebar-item-label").forEach(el => {
        const text = el.textContent.trim();
        if (REBRAND_MAP[text]) {
          el.textContent = REBRAND_MAP[text];
        }
    });

    // 3. Update Title tag
    if (document.title.includes("Frappe") || document.title.includes("ERPNext")) {
        document.title = document.title
            .replace("Frappe", "Trevo")
            .replace("ERPNext", "Trevo Commerce");
    }

    // 4. Update Sidebar Subtitles
    document.querySelectorAll(".header-subtitle").forEach(el => {
      if (el.textContent.includes("v16") || el.textContent.includes("ERPNext") || el.textContent.includes("Frappe")) {
        el.textContent = "Unified Business Platform";
      }
    });
  }

  /* ── About Dialog Override ───────────────────────────────── */
  function overrideAboutDialog() {
    if (!window.frappe?.ui?.misc) return;
    const originalAbout = frappe.ui.misc.about;
    
    frappe.ui.misc.about = function () {
      if (!frappe.ui.misc._trevo_about) {
        frappe.ui.misc._trevo_about = new frappe.ui.Dialog({
          title: `<div style="display:flex;align-items:center;gap:10px;">
            <img src="${LOGO}" style="height:24px;"> <span>About Trevo Cloud</span>
          </div>`,
        });

        $(frappe.ui.misc._trevo_about.body).html(`
          <div id="trevo-versions" style="padding: 10px 0;">
            <p class="text-muted">Fetching version information...</p>
          </div>
          <div style="margin-top:20px; padding-top:15px; border-top:1px solid var(--border-color); font-size:11px; color:var(--text-muted);">
            &copy; ${new Date().getFullYear()} Trevo Cloud. All rights reserved.
          </div>
        `);
      }

      frappe.ui.misc._trevo_about.show();

      frappe.call({
        method: "frappe.utils.change_log.get_versions",
        callback(r) {
          const $w = $("#trevo-versions").empty();
          const versions = r?.message || {};
          Object.entries(versions).forEach(([key, app]) => {
            const name = REBRAND_MAP[app.title || key] || app.title || key;
            const ver  = app.branch_version || app.version || "—";
            $w.append(`
              <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--subtle-accent);">
                <span style="font-weight:600;">${name}</span>
                <span class="badge" style="background:var(--primary-soft); color:var(--primary); font-weight:700;">v${ver}</span>
              </div>
            `);
          });
        }
      });
    };
  }

  /* ── Main Execution ──────────────────────────────────────── */
  function apply() {
    replaceLogos();
    rebrandUI();
    
    // UI Cleanup
    document.querySelectorAll(".form-section.card-section, .form-dashboard-section").forEach(el => {
        el.style.boxShadow = "none";
        el.style.border = "1.5px solid var(--border-color)";
    });
  }

  /* ── Boot ────────────────────────────────────────────────── */
  setFavicon(LOGO);
  injectFonts();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  $(document).on("app_ready", function () {
    apply();
    overrideAboutDialog();
  });

  $(document).on("page-change", function () {
    setTimeout(apply, 200);
  });

  // Watch for dynamic sidebar loading
  let _debounce;
  const observer = new MutationObserver(() => {
    clearTimeout(_debounce);
    _debounce = setTimeout(apply, 500);
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
