/* ═══════════════════════════════════════════════════════════
   TREVO CLOUD — Dashboard Bootstrap JS
   Sidebar toggle · Theme · Search · Logout
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── DOM refs ───────────────────────────────────────────── */
  var sidebar       = document.getElementById("trevoSidebar");
  var overlay       = document.getElementById("trevoOverlay");
  var collapseBtn   = document.getElementById("sidebarCollapseBtn");
  var mobileMenuBtn = document.getElementById("mobileMenuBtn");
  var themeBtn      = document.getElementById("themeToggleBtn");
  var searchInput   = document.getElementById("dashSearch");
  var logoutBtn     = document.getElementById("logoutBtn");
  var html          = document.documentElement;

  /* ── Run on DOM ready ───────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", function () {
    _initSidebarCollapse();
    _initMobileSidebar();
    _initThemeToggle();
    _initSearch();
    _initLogout();
    _initNavActiveState();
    _applyEntryAnimations();
  });

  /* ════════════════════════════════════════════════════════
     1. DESKTOP SIDEBAR COLLAPSE
     Toggle css class `sidebar-collapsed` on <html>
     Persisted to localStorage
  ════════════════════════════════════════════════════════ */
  function _initSidebarCollapse() {
    if (!collapseBtn) return;

    // Restore persisted state (FOUC already handled inline in HTML)
    // Just ensure the class is applied if needed (double safety)
    if (localStorage.getItem("sidebar-collapsed") === "true") {
      html.classList.add("sidebar-collapsed");
    }

    collapseBtn.addEventListener("click", function () {
      var isCollapsed = html.classList.toggle("sidebar-collapsed");
      localStorage.setItem("sidebar-collapsed", isCollapsed ? "true" : "false");
      collapseBtn.setAttribute("aria-pressed", isCollapsed ? "true" : "false");
    });
  }

  /* ════════════════════════════════════════════════════════
     2. MOBILE SIDEBAR (hamburger → overlay → close)
  ════════════════════════════════════════════════════════ */
  function _initMobileSidebar() {
    if (!mobileMenuBtn || !sidebar || !overlay) return;

    // Open sidebar
    mobileMenuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      _openMobileSidebar();
    });

    // Close via overlay click
    overlay.addEventListener("click", function () {
      _closeMobileSidebar();
    });

    // Close via Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") _closeMobileSidebar();
    });

    // Close when a nav link is tapped (mobile UX)
    if (sidebar) {
      sidebar.querySelectorAll(".nav-item").forEach(function (link) {
        link.addEventListener("click", function () {
          // Small delay so navigation begins before sidebar closes
          setTimeout(_closeMobileSidebar, 80);
        });
      });
    }
  }

  function _openMobileSidebar() {
    if (!sidebar || !overlay) return;
    sidebar.classList.add("is-open");
    overlay.classList.add("is-visible");
    overlay.removeAttribute("aria-hidden");
    if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function _closeMobileSidebar() {
    if (!sidebar || !overlay) return;
    sidebar.classList.remove("is-open");
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  /* ════════════════════════════════════════════════════════
     3. THEME TOGGLE  (light ↔ dark)
     Saves preference to localStorage and syncs with
     Frappe's user desk_theme via API (best-effort)
  ════════════════════════════════════════════════════════ */
  function _initThemeToggle() {
    if (!themeBtn) return;

    themeBtn.addEventListener("click", function () {
      var current = html.getAttribute("data-theme") || "light";
      var next    = current === "dark" ? "light" : "dark";
      _applyTheme(next, true);
    });
  }

  function _applyTheme(theme, save) {
    html.setAttribute("data-theme", theme);
    html.setAttribute("data-theme-mode", theme);

    if (save) {
      localStorage.setItem("color-scheme", theme);
      localStorage.setItem("theme", theme);

      // Best-effort sync with Frappe user preference
      _syncFrappeTheme(theme);
    }
  }

  function _syncFrappeTheme(theme) {
    var session = window._trevoSession || {};
    var token   = session.csrfToken || "";
    var user    = session.user || "";

    if (!user || user === "Guest" || !token) return;

    var themeVal = theme === "dark" ? "Dark" : "Light";

    fetch("/api/method/frappe.client.set_value", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": token,
      },
      body: JSON.stringify({
        doctype: "User",
        name: user,
        fieldname: "desk_theme",
        value: themeVal,
      }),
    }).catch(function () {
      // Silently ignore — network errors or permission issues
    });
  }

  /* ════════════════════════════════════════════════════════
     4. LIVE SEARCH FILTER
     Filters: shortcut tiles, activity rows, task items,
              and sidebar nav labels
  ════════════════════════════════════════════════════════ */
  function _initSearch() {
    if (!searchInput) return;

    searchInput.addEventListener("input", _handleSearch);
    searchInput.addEventListener("search", _handleSearch); // Clear button on type=search
  }

  function _handleSearch(e) {
    var q = (e.target.value || "").toLowerCase().trim();

    _filterElements(".shortcut-tile", q, function (el) {
      return el.textContent.toLowerCase();
    });

    _filterElements(".activity-row", q, function (el) {
      return el.textContent.toLowerCase();
    });

    _filterElements(".task-item", q, function (el) {
      return el.textContent.toLowerCase();
    });

    // Sidebar nav (skip active dashboard item)
    document.querySelectorAll(".nav-item:not(.is-active)").forEach(function (item) {
      if (!item.closest(".trevo-sidebar")) return;
      var text = item.textContent.toLowerCase();
      item.style.display = (!q || text.includes(q)) ? "" : "none";
    });

    // Show/hide nav-group if all children are hidden
    document.querySelectorAll(".nav-group").forEach(function (group) {
      var visibleItems = group.querySelectorAll(".nav-item");
      var anyVisible = false;
      visibleItems.forEach(function (item) {
        if (item.style.display !== "none") anyVisible = true;
      });
      var label = group.querySelector(".nav-group-label");
      if (label) label.style.display = anyVisible ? "" : "none";
    });
  }

  function _filterElements(selector, q, getText) {
    document.querySelectorAll(selector).forEach(function (el) {
      var text = getText(el);
      el.style.display = (!q || text.includes(q)) ? "" : "none";
    });
  }

  /* ════════════════════════════════════════════════════════
     5. LOGOUT
  ════════════════════════════════════════════════════════ */
  function _initLogout() {
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", function () {
      var session = window._trevoSession || {};
      var token   = session.csrfToken || "";

      if (!token) {
        window.location.href = "/login";
        return;
      }

      fetch("/api/method/logout", {
        method: "POST",
        headers: { "X-Frappe-CSRF-Token": token },
      })
        .then(function () {
          window.location.href = "/login";
        })
        .catch(function () {
          window.location.href = "/login";
        });
    });
  }

  /* ════════════════════════════════════════════════════════
     6. NAV ACTIVE STATE
     Marks sidebar links that match the current URL
  ════════════════════════════════════════════════════════ */
  function _initNavActiveState() {
    var path = window.location.pathname;

    document.querySelectorAll(".nav-item").forEach(function (item) {
      // The dashboard item is always handled via Jinja is-active class
      if (item.classList.contains("is-active")) return;

      var href = item.getAttribute("href") || "";
      if (href && path.startsWith(href) && href !== "/") {
        item.classList.add("is-active");
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     7. ENTRY ANIMATIONS
     Stagger fade-in for KPI cards and dash-cards
  ════════════════════════════════════════════════════════ */
  function _applyEntryAnimations() {
    var animatables = document.querySelectorAll(
      ".kpi-card, .dash-card, .hero-section"
    );

    animatables.forEach(function (el, i) {
      el.style.opacity = "0";
      el.style.transform = "translateY(14px)";
      el.style.transition = "opacity 0.4s ease, transform 0.4s ease";

      setTimeout(function () {
        el.style.opacity = "";
        el.style.transform = "";
        // Let CSS handle transition from here
        el.style.transition = "";
      }, 60 + i * 50);
    });
  }

})();
