/**
 * Trevo Whitelabel Engine v2
 * Fixes: mobile sidebar overlay, desktop sidebar toggle,
 * nested child items, navbar search, edit-mode button hiding.
 */
(function () {
  "use strict";

  const LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";
  let _applyTimer;
  let _mobileSidebarOpener;
  let _lastSidebarWidth = null;
  let _sidebarCollapseTarget = null;
  let _sidebarCollapseObserver = null;
  let _rootMutationObserver = null;
  let _gridEnhancementBound = false;
  let _gridScanFrame = null;

  const APP_NAMES = {
    "Frappe Framework": "Trevo Engine",
    "Frappe":           "Trevo Engine",
    "ERPNext":          "Trevo Commerce",
    "Frappe HR":        "Trevo People",
    "HRMS":             "Trevo People",
  };

  const ITEM_GRID_DOCTYPES = new Set([
    "Sales Order Item",
    "Sales Invoice Item",
    "Purchase Order Item",
    "Purchase Invoice Item",
    "Quotation Item",
    "Delivery Note Item",
    "Material Request Item"
  ]);

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
    document.querySelectorAll(".sidebar-header").forEach(header => {
      header.classList.add("tv-sidebar-brand");
    });
    document.querySelectorAll(".header-title").forEach(el => {
      if (el.textContent.trim() !== "Trevo ERP") {
        el.textContent = "Trevo ERP";
      }
    });
    document.querySelectorAll(".header-subtitle").forEach(el => {
      el.textContent = "Command Center";
    });
    ensureSidebarHeaderToggle();
  }

  function ensureSidebarHeaderToggle() {
    const header = document.querySelector(".sidebar-header");
    if (!header || header.querySelector(".tv-sidebar-collapse-btn")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tv-sidebar-collapse-btn";
    button.setAttribute("aria-label", "Toggle sidebar");
    button.innerHTML = `
      <svg class="icon icon-sm" aria-hidden="true">
        <use href="#es-line-sidebar-collapse"></use>
      </svg>
    `;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof frappe !== "undefined" && frappe.app && frappe.app.sidebar && frappe.app.sidebar.toggle_width) {
        frappe.app.sidebar.toggle_width();
        return;
      }
      document.querySelector(".collapse-sidebar-link")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });
    header.appendChild(button);
  }

  function getSidebar() {
    return document.querySelector(".body-sidebar, .desk-sidebar, .layout-side-section");
  }

  function ensureMobileSidebarOpener() {
    if (typeof frappe === "undefined" || !frappe.app || !frappe.app.sidebar) return;

    if (!_mobileSidebarOpener) {
      _mobileSidebarOpener = document.createElement("button");
      _mobileSidebarOpener.type = "button";
      _mobileSidebarOpener.className = "tv-mobile-sidebar-opener";
      _mobileSidebarOpener.setAttribute("aria-label", "Open sidebar");
      _mobileSidebarOpener.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
      `;
      _mobileSidebarOpener.addEventListener("click", () => {
        if (!frappe.app || !frappe.app.sidebar) return;
        frappe.app.sidebar.open();
        setTimeout(syncMobileSidebarOpener, 80);
      });
      document.body.appendChild(_mobileSidebarOpener);
    }

    syncMobileSidebarOpener();
  }

  function syncMobileSidebarOpener() {
    if (!_mobileSidebarOpener) return;

    const isMobileViewport = window.innerWidth <= 991;
    if (!isMobileViewport) {
      _mobileSidebarOpener.style.display = "none";
      return;
    }

    const container = document.querySelector(".body-sidebar-container");
    const expanded = container && container.classList.contains("expanded");
    _mobileSidebarOpener.style.display = expanded ? "none" : "inline-flex";
  }

  // ── Nested sidebar children — fix toggle ─────────────────────
  function fixNestedSidebarItems() {
    document.querySelectorAll(".sidebar-child-item.nested-container").forEach(el => {
      if (!el.classList.contains("hidden")) {
        el.style.display = "";
        el.style.overflow = "visible";
      }
    });
  }

  function hideEditModeControls() {
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
    ensureNativeAwesomeSearchAPI();
    styleNativeSearchTriggers();
    if (!navbar) return;

    const searchBar = navbar.querySelector(".search-bar, #navbar-search-container, .form-control.search-bar");
    if (searchBar) {
      searchBar.style.removeProperty("display");
      searchBar.style.removeProperty("visibility");
      searchBar.classList.add("tv-native-search");
    }

    const navbarInner = navbar.querySelector(".container-fluid, .navbar-inner, .navbar-collapse") || navbar;
    let launcher = navbar.querySelector(".tv-search-launcher[data-trevo-injected='1']");

    if (!launcher) {
      launcher = document.createElement("button");
      launcher.type = "button";
      launcher.className = "tv-search-launcher";
      launcher.dataset.trevoInjected = "1";
      launcher.setAttribute("aria-label", "Open search");
      launcher.innerHTML = `
        <span class="tv-search-launcher__icon" aria-hidden="true">⌕</span>
        <span class="tv-search-launcher__label">Search</span>
        <span class="tv-search-launcher__hint">Ctrl+K</span>
      `;
      launcher.addEventListener("click", () => {
        if (typeof frappe !== "undefined" && frappe.search && typeof frappe.search.show === "function") {
          frappe.search.show();
        }
      });
      navbarInner.appendChild(launcher);
    }

    // Fix navbar flex layout — ensure items don't overflow
    if (navbarInner) {
      navbarInner.style.cssText = "display:flex;align-items:center;width:100%;gap:8px;flex-wrap:nowrap;";
    }
  }

  function ensureNativeAwesomeSearchAPI() {
    if (typeof frappe === "undefined") return;
    if (typeof frappe.provide === "function") {
      frappe.provide("frappe.search");
    } else {
      frappe.search = frappe.search || {};
    }

    if (typeof frappe.search.show === "function") return;

    frappe.search.show = function () {
      const target = getNativeSearchTrigger();
      if (!target) return;

      if (
        (window.jQuery || window.$) &&
        frappe.search.AwesomeBar &&
        target.classList.contains("trevo-awesomebar-proxy") &&
        !target.dataset.trevoAwesomebarBound
      ) {
        const awesomeBar = new frappe.search.AwesomeBar();
        awesomeBar.setup(target);
        target.dataset.trevoAwesomebarBound = "1";
      }

      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    };
  }

  function getNativeSearchTrigger() {
    const selector = [
      "#navbar-modal-search",
      ".navbar-search-bar",
      ".navbar-modal-search-mobile",
      ".search-bar",
      ".trevo-awesomebar-proxy"
    ].join(", ");
    let trigger = Array.from(document.querySelectorAll(selector)).find((el) => {
      return !el.classList.contains("tv-search-launcher") && !el.classList.contains("search-launcher");
    });

    if (!trigger) {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "trevo-awesomebar-proxy hidden";
      trigger.setAttribute("aria-hidden", "true");
      document.body.appendChild(trigger);
    }

    return trigger;
  }

  function styleNativeSearchTriggers() {
    document
      .querySelectorAll("#navbar-modal-search, .navbar-search-bar, .navbar-modal-search-mobile, .search-bar")
      .forEach((el) => {
        el.classList.add("tv-native-search");
      });
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
        ensureNativeAwesomeSearchAPI();
        if (typeof frappe !== "undefined" && frappe.search && typeof frappe.search.show === "function") {
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

  const SIDEBAR_WIDTH = 280;
  let sidebarObserver;
  function syncSidebarWidth() {
    const sidebar = document.querySelector(".body-sidebar, .desk-sidebar, .layout-side-section");
    if (!sidebar) return;

    const applySidebarWidth = () => {
      let width = Math.round(sidebar.getBoundingClientRect().width);
      if (getComputedStyle(sidebar).display === 'none') {
        width = 0;
      }
      document.documentElement.style.setProperty("--tv-sidebar-w", `${width}px`);
      document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
      if (_lastSidebarWidth !== width) {
        _lastSidebarWidth = width;
      }
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

  function watchSidebarCollapse() {
    const sidebar = document.querySelector(".body-sidebar, .desk-sidebar, .layout-side-section");
    if (!sidebar) return;
    if (_sidebarCollapseTarget === sidebar) return;

    _sidebarCollapseTarget = sidebar;
    if (_sidebarCollapseObserver) {
      _sidebarCollapseObserver.disconnect();
    }

    // Observe only width/style changes; avoid class‑based loop
    _sidebarCollapseObserver = new MutationObserver(() => {
      const isCollapsed =
        sidebar.classList.contains("closed") ||
        sidebar.classList.contains("collapsed") ||
        sidebar.style.width === "0px" ||
        parseInt(sidebar.style.width || "999") < 100;

      if (isCollapsed) {
        sidebar.classList.add("sidebar-collapsed");
      } else {
        sidebar.classList.remove("sidebar-collapsed");
      }
    });

    _sidebarCollapseObserver.observe(sidebar, { attributes: true, attributeFilter: ["style"] });

    document.querySelectorAll(".sidebar-toggle-btn, [data-toggle='sidebar'], .toggle-sidebar, .collapse-sidebar-link").forEach(btn => {
      if (btn.dataset.toggleObserved) return;
      btn.dataset.toggleObserved = "1";
      btn.addEventListener("click", () => {
        setTimeout(() => {
          const w = parseInt(getComputedStyle(sidebar).width);
          if (w < 100) {
            sidebar.classList.add("sidebar-collapsed");
          } else {
            sidebar.classList.remove("sidebar-collapsed");
          }
        }, 150);
      });
    });
  }

  function sanitizeImageUrl(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("/files/") || trimmed.startsWith("/private/files/")) return trimmed;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:image/")) return trimmed;
    return "";
  }

  function getGridRowElement(gridRow) {
    return (
      gridRow?.row?.[0] ||
      gridRow?.row?.get?.(0) ||
      gridRow?.wrapper?.[0] ||
      gridRow?.wrapper?.get?.(0) ||
      gridRow?.$row?.[0] ||
      null
    );
  }

  function getGridRowDoc(gridRow) {
    return gridRow?.doc || gridRow?.grid_form?.doc || null;
  }

  function getGridRowDoctype(gridRow) {
    return (
      gridRow?.doc?.doctype ||
      gridRow?.grid?.doctype ||
      gridRow?.grid?.df?.options ||
      gridRow?.grid_form?.doctype ||
      ""
    );
  }

  function shouldEnhanceItemGridRow(gridRow) {
    const doctype = getGridRowDoctype(gridRow);
    if (ITEM_GRID_DOCTYPES.has(doctype)) return true;
    const doc = getGridRowDoc(gridRow);
    return !!(doc && (doc.item_code || doc.item_name) && (doc.image_view || doc.item_image || doc.image));
  }

  function getItemImage(doc) {
    return sanitizeImageUrl(
      doc?.image_view ||
      doc?.item_image ||
      doc?.image ||
      doc?.thumbnail ||
      ""
    );
  }

  function findGridItemCell(rowEl) {
    if (!rowEl) return null;
    const explicit = rowEl.querySelector(
      [
        "[data-fieldname='item_code']",
        "[data-fieldname='item_name']",
        "[data-fieldname='item']",
        "[data-fieldname='description']",
        ".grid-static-col[data-fieldname='item_code']",
        ".grid-static-col[data-fieldname='item_name']"
      ].join(", ")
    );
    if (explicit) return explicit;

    const candidates = Array.from(
      rowEl.querySelectorAll(".grid-static-col, .col, .ellipsis, .static-area, [data-fieldname]")
    ).filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.classList.contains("row-check")) return false;
      if (node.closest(".row-check")) return false;
      return !!node.textContent.trim();
    });

    return candidates[0] || null;
  }

  function createFallbackThumb(doc) {
    const source = doc?.item_name || doc?.item_code || doc?.description || "";
    const initials = source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() || "")
      .join("") || "IT";

    const badge = document.createElement("span");
    badge.className = "tv-grid-item-thumb tv-grid-item-thumb--fallback";
    badge.textContent = initials;
    return badge;
  }

  function enhanceItemGridRow(gridRow) {
    if (!shouldEnhanceItemGridRow(gridRow)) return;

    const rowEl = getGridRowElement(gridRow);
    const doc = getGridRowDoc(gridRow);
    if (!rowEl || !doc) return;

    const targetCell = findGridItemCell(rowEl);
    if (!targetCell) return;

    const imageUrl = getItemImage(doc);
    const cacheKey = [doc.name || "", imageUrl, doc.item_name || "", doc.item_code || ""].join("|");
    if (targetCell.dataset.tvGridItemEnhanced === cacheKey) return;

    let shell = targetCell.querySelector(":scope > .tv-grid-item-shell");
    let thumb = shell?.querySelector(".tv-grid-item-thumb");
    let meta = shell?.querySelector(".tv-grid-item-meta");

    if (!shell) {
      shell = document.createElement("div");
      shell.className = "tv-grid-item-shell";

      thumb = document.createElement("span");
      thumb.className = "tv-grid-item-thumb";

      meta = document.createElement("span");
      meta.className = "tv-grid-item-meta";

      const textSlot = document.createElement("span");
      textSlot.className = "tv-grid-item-text";

      const nodes = Array.from(targetCell.childNodes);
      nodes.forEach((node) => {
        if (node === shell) return;
        textSlot.appendChild(node);
      });

      meta.appendChild(textSlot);
      shell.appendChild(thumb);
      shell.appendChild(meta);
      targetCell.appendChild(shell);
    }

    thumb.replaceChildren();
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = doc.item_name || doc.item_code || "Item";
      img.loading = "lazy";
      thumb.appendChild(img);
    } else {
      thumb.appendChild(createFallbackThumb(doc));
    }

    let subtitle = meta.querySelector(".tv-grid-item-subtitle");
    if (!subtitle) {
      subtitle = document.createElement("span");
      subtitle.className = "tv-grid-item-subtitle";
      meta.appendChild(subtitle);
    }

    const subtitleText = [doc.item_code, doc.uom].filter(Boolean).join("  ·  ");
    subtitle.textContent = subtitleText;
    subtitle.style.display = subtitleText ? "" : "none";

    targetCell.dataset.tvGridItemEnhanced = cacheKey;
  }

  function scanVisibleGridRows() {
    if (typeof frappe === "undefined" || typeof cur_frm === "undefined") {
      return;
    }

    const route = typeof frappe.get_route === "function" ? frappe.get_route() : [];
    const curFrm = route && route[0] === "Form" ? cur_frm : null;
    if (!curFrm || !curFrm.grids) return;

    curFrm.grids.forEach((grid) => {
      (grid.grid_rows || []).forEach((gridRow) => enhanceItemGridRow(gridRow));
    });
  }

  function scheduleGridEnhancementScan() {
    if (_gridScanFrame) {
      cancelAnimationFrame(_gridScanFrame);
    }
    _gridScanFrame = requestAnimationFrame(() => {
      _gridScanFrame = null;
      scanVisibleGridRows();
    });
  }

  function setupGridRowEnhancements() {
    if (_gridEnhancementBound || typeof $ === "undefined") return;
    _gridEnhancementBound = true;

    $(document).on("grid-row-render", (_event, gridRow) => {
      enhanceItemGridRow(gridRow);
    });
  }

  // ── Main apply ───────────────────────────────────────────────
  function apply() {
    ensureSidebarBranding();
    watchSidebarCollapse();
    syncSidebarWidth();
    fixNestedSidebarItems();
    hideEditModeControls();
    replaceLogos();
    relabelText();
    fixLoginPage();
    customizeAvatarMenu();
    rebrandTitle();
    overrideAboutDialog();
    fixNavbarSearch();
    ensureMobileSidebarOpener();
    scheduleGridEnhancementScan();
  }

  function mutationNeedsApply(mutations) {
    const interestingSelectors = [
      ".page-container",
      ".layout-side-section",
      ".body-sidebar",
      ".desk-sidebar",
      ".navbar",
      ".page-head",
      ".main-section"
    ];

    return mutations.some(mutation => {
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      return nodes.some(node => {
        if (!node || node.nodeType !== 1) return false;
        return interestingSelectors.some(selector =>
          node.matches?.(selector) || node.querySelector?.(selector)
        );
      });
    });
  }

  function setupStructuralObserver() {
    if (_rootMutationObserver) return;

    const root = document.querySelector(".main-section") || document.body;
    _rootMutationObserver = new MutationObserver((mutations) => {
      if (!mutationNeedsApply(mutations)) return;
      clearTimeout(_applyTimer);
      _applyTimer = setTimeout(apply, 180);
    });
    _rootMutationObserver.observe(root, { childList: true, subtree: true });
  }

  // ── Boot ─────────────────────────────────────────────────────
  setupDensityToggle();
  setupCmdK();
  setupGridRowEnhancements();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }

  if (typeof $ !== "undefined") {
    $(document).on("app_ready", apply);
    $(document).on("page-change", () => setTimeout(apply, 200));
    $(document).on("sidebar-expand", () => setTimeout(syncMobileSidebarOpener, 50));
  }

  window.addEventListener("resize", () => setTimeout(syncMobileSidebarOpener, 50));
  setupStructuralObserver();

})();
