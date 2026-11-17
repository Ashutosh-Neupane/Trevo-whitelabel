(function () {
  "use strict";

  var DEFAULT_LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";
  var state = {
    dashboardData: window.trevo_dashboard_data || window.trevoDashboardData || {},
    workspaces: window.trevo_dashboard_workspaces || window.trevoDashboardWorkspaces || [],
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function initials(value) {
    var tokens = normalizeText(value).split(/\s+/).filter(Boolean);
    if (!tokens.length) return "TV";
    return tokens.slice(0, 2).map(function (token) {
      return token.charAt(0).toUpperCase();
    }).join("");
  }

  function formatCount(value) {
    var number = Number(value || 0);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(number);
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return normalizeText(value);
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function routeToUrl(route) {
    if (!route) return "#";
    if (Array.isArray(route)) {
      var parts = route.map(function (segment) {
        return normalizeText(segment).toLowerCase().replace(/\s+/g, "-");
      });
      if (!parts.length) return "#";
      if (parts[0] === "list" && parts[1]) {
        return "/desk/list/" + parts[1];
      }
      if (parts[0] === "form" && parts[1] && route[2]) {
        return "/desk/form/" + parts[1] + "/" + encodeURIComponent(route[2]);
      }
      return "/desk/" + parts.join("/");
    }
    if (typeof route === "string" && route.charAt(0) === "/") return route;
    return "/desk/" + String(route).replace(/^\/+/, "");
  }

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") ||
      document.documentElement.getAttribute("data-theme-mode") ||
      localStorage.getItem("color-scheme") ||
      "light";
  }

  function setTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-theme-mode", theme);
    if (persist) {
      localStorage.setItem("color-scheme", theme);
      localStorage.setItem("theme", theme);
    }
  }

  function syncFrappeTheme(theme) {
    var session = window._trevoSession || {};
    var token = session.csrfToken || "";
    var user = session.user || "";

    if (!user || user === "Guest" || !token || typeof fetch !== "function") return;

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
        value: theme === "dark" ? "Dark" : "Light",
      }),
    }).catch(function () {});
  }

  function openNativeSearch() {
    if (typeof frappe !== "undefined" && frappe.search && typeof frappe.search.show === "function") {
      frappe.search.show();
    }
  }

  function hideSplash() {
    var splash = document.getElementById("trevo-splash-screen");
    if (!splash) return;
    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";
    window.setTimeout(function () {
      if (splash.parentNode) {
        splash.parentNode.removeChild(splash);
      }
    }, 220);
  }

  function setBodyState(active) {
    document.body.classList.toggle("trevo-command-center-boot", !active);
    document.body.classList.toggle("trevo-command-center-active", !!active);
    document.documentElement.classList.toggle("trevo-command-center-active", !!active);
  }

  function getUser() {
    return state.dashboardData.user || {};
  }

  function getStats() {
    return state.dashboardData.stats || {};
  }

  function getWorkspaces() {
    if (Array.isArray(state.dashboardData.workspaces) && state.dashboardData.workspaces.length) {
      return state.dashboardData.workspaces;
    }
    return Array.isArray(state.workspaces) ? state.workspaces : [];
  }

  function buildIconButton(svg, label, extraClass, attrs) {
    var attributes = [];
    var key;
    attrs = attrs || {};
    for (key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) {
        attributes.push(key + '="' + escapeHtml(attrs[key]) + '"');
      }
    }
    return (
      '<button type="button" class="icon-btn ' + (extraClass || "") + '" aria-label="' + escapeHtml(label) + '" ' + attributes.join(" ") + ">" +
      svg +
      "</button>"
    );
  }

  function renderNavItems(workspaces) {
    var items = [
      '<div class="nav-group">',
      '<span class="nav-group-label">Primary</span>',
      '<a class="nav-item is-active" href="/desk" data-route="/desk">',
      '<span class="nav-icon nav-icon--char">⌂</span>',
      '<span class="nav-label">Dashboard</span>',
      "</a>",
      "</div>",
    ].join("");

    if (workspaces.length) {
      items += '<div class="nav-group"><span class="nav-group-label">Workspaces</span>';
      workspaces.forEach(function (workspace) {
        var title = workspace.title || workspace.label || workspace.name || "Workspace";
        var icon = workspace.icon || "Grid";
        var route = routeToUrl(workspace.route || ("/desk/" + String(workspace.name || title).toLowerCase().replace(/\s+/g, "-")));
        var active = window.location.pathname === route ? " is-active" : "";
        var iconMarkup = icon.length <= 2
          ? '<span class="letter-icon">' + escapeHtml(icon.slice(0, 2).toUpperCase()) + "</span>"
          : '<span class="nav-icon">' + escapeHtml(icon) + "</span>";
        items += (
          '<a class="nav-item' + active + '" href="' + escapeHtml(route) + '" data-route="' + escapeHtml(route) + '">' +
          iconMarkup +
          '<span class="nav-label">' + escapeHtml(title) + "</span>" +
          "</a>"
        );
      });
      items += "</div>";
    }

    items += [
      '<div class="nav-group">',
      '<span class="nav-group-label">System</span>',
      '<a class="nav-item" href="/desk/desktop" data-route="/desk/desktop">',
      '<span class="nav-icon nav-icon--char">⟡</span>',
      '<span class="nav-label">Open App</span>',
      "</a>",
      '<a class="nav-item" href="/desk/List/Notification Log" data-route="/desk/List/Notification Log">',
      '<span class="nav-icon nav-icon--char">✦</span>',
      '<span class="nav-label">Notifications</span>',
      "</a>",
      "</div>",
    ].join("");

    return items;
  }

  function renderKpiCards(stats) {
    var cards = [
      {
        accent: "accent-green",
        label: "Open Tasks",
        value: stats.open_tasks || 0,
        hint: "Assigned to you",
        icon: "✓",
      },
      {
        accent: "accent-red",
        label: "Overdue Tasks",
        value: stats.overdue_tasks || 0,
        hint: "Needs attention",
        icon: "!",
      },
      {
        accent: "accent-blue",
        label: "Unread Alerts",
        value: stats.unread_notifications || 0,
        hint: "Notification Log",
        icon: "⌁",
      },
      {
        accent: "accent-amber",
        label: "Draft Docs",
        value: stats.draft_documents || 0,
        hint: "Unsubmitted records",
        icon: "◌",
      },
      {
        accent: "accent-green",
        label: "Approved Docs",
        value: stats.approved_documents || 0,
        hint: "Completed workflow",
        icon: "▣",
      },
      {
        accent: "accent-blue",
        label: "Pending Docs",
        value: stats.pending_documents || 0,
        hint: "Awaiting review",
        icon: "…",
      },
    ];

    return cards.map(function (card) {
      return (
        '<article class="kpi-card ' + card.accent + '">' +
        '<div class="kpi-icon-wrap" aria-hidden="true">' + escapeHtml(card.icon) + "</div>" +
        '<div class="kpi-body">' +
        '<span class="kpi-label">' + escapeHtml(card.label) + "</span>" +
        '<span class="kpi-value">' + escapeHtml(formatCount(card.value)) + "</span>" +
        '<div class="kpi-hint">' + escapeHtml(card.hint) + "</div>" +
        "</div>" +
        "</article>"
      );
    }).join("");
  }

  function renderShortcuts(actions) {
    if (!actions.length) {
      return '<div class="empty-state"><p>No quick actions available yet.</p></div>';
    }

    return actions.map(function (action) {
      var route = routeToUrl(action.route || action.url || "/desk/desktop");
      var label = action.label || action.title || "Open";
      var iconText = initials(label);
      return (
        '<a class="shortcut-tile" href="' + escapeHtml(route) + '" data-route="' + escapeHtml(route) + '">' +
        '<div class="shortcut-icon-wrap"><span class="tile-letter">' + escapeHtml(iconText) + "</span></div>" +
        '<span class="shortcut-label">' + escapeHtml(label) + "</span>" +
        "</a>"
      );
    }).join("");
  }

  function renderActivity(activity) {
    if (!activity.length) {
      return '<div class="empty-state-inline">No recent activity yet.</div>';
    }

    return activity.map(function (item) {
      var title = item.subject || item.operation || "Activity";
      var meta = [item.reference_doctype, item.reference_name].filter(Boolean).join(" • ");
      return (
        '<a class="activity-row" href="' + escapeHtml(routeToUrl(item.route || "/desk/desktop")) + '" data-route="' + escapeHtml(routeToUrl(item.route || "/desk/desktop")) + '">' +
        '<div class="activity-icon-wrap">' + escapeHtml(initials(title)) + "</div>" +
        '<div class="activity-text">' +
        '<div class="activity-subject">' + escapeHtml(title) + "</div>" +
        '<div class="activity-meta">' + escapeHtml(meta || (item.operation || "")) + "</div>" +
        "</div>" +
        '<div class="activity-time">' + escapeHtml(formatDate(item.creation)) + "</div>" +
        "</a>"
      );
    }).join("");
  }

  function renderTasks(tasks) {
    if (!tasks.length) {
      return '<div class="empty-state-inline">No active tasks assigned.</div>';
    }

    return tasks.map(function (task) {
      var title = task.description || task.reference_name || task.name || "Task";
      var overdue = task.is_overdue || task.overdue;
      var priority = normalizeText(task.priority).toLowerCase() || "medium";
      var dueDate = task.date ? formatDate(task.date) : "No due date";
      return (
        '<a class="task-item' + (overdue ? " is-overdue" : "") + '" href="' + escapeHtml(routeToUrl(task.route || (task.reference_type && task.reference_name ? [task.reference_type, task.reference_name] : "/desk/List/ToDo"))) + '">' +
        '<div class="task-checkbox">✓</div>' +
        '<div class="task-content">' +
        '<div class="task-title">' + escapeHtml(title) + "</div>" +
        '<div class="task-due' + (overdue ? " overdue" : "") + '">' + escapeHtml(dueDate) + "</div>" +
        "</div>" +
        '<div class="priority-badge priority-' + escapeHtml(priority.indexOf("high") === 0 ? "high" : priority.indexOf("low") === 0 ? "low" : "medium") + '">' +
        escapeHtml(task.priority || "Medium") +
        "</div>" +
        "</a>"
      );
    }).join("");
  }

  function renderDocuments(documents) {
    if (!documents.length) {
      return '<div class="empty-state-inline">No recent documents found.</div>';
    }

    return documents.map(function (doc) {
      var statusTone = doc.status_tone || "neutral";
      return (
        '<a class="doc-row" href="' + escapeHtml(routeToUrl(doc.route || "/desk/desktop")) + '" data-route="' + escapeHtml(routeToUrl(doc.route || "/desk/desktop")) + '">' +
        '<div class="doc-letter-icon">' + escapeHtml(initials(doc.doctype || "Doc")) + "</div>" +
        '<div class="doc-info">' +
        '<div class="doc-name">' + escapeHtml(doc.name || "Document") + "</div>" +
        '<div class="doc-type">' + escapeHtml(doc.doctype || "Document") + "</div>" +
        "</div>" +
        '<div class="doc-status status-' + escapeHtml(statusTone) + '">' + escapeHtml(doc.status_label || "Draft") + "</div>" +
        "</a>"
      );
    }).join("");
  }

  function buildDashboardMarkup() {
    var user = getUser();
    var stats = getStats();
    var workspaces = getWorkspaces();
    var quickActions = Array.isArray(state.dashboardData.quick_actions) && state.dashboardData.quick_actions.length
      ? state.dashboardData.quick_actions
      : [
          { label: "New Task", route: "/desk/List/ToDo" },
          { label: "My Tasks", route: "/desk/List/ToDo" },
          { label: "Notifications", route: "/desk/List/Notification Log" },
          { label: "Activity Log", route: "/desk/List/Activity Log" },
        ];
    var notifications = stats.unread_notifications || 0;
    var firstName = user.first_name || normalizeText(user.full_name).split(/\s+/)[0] || "Team";

    // Inside desk (v16) Frappe's own navbar already provides search, theme and notifications.
    var header = state.embedded ? "" : [
      '<header class="trevo-navbar">',
      '<button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>',
      '<button class="search-wrap search-launcher" id="searchLauncherBtn" type="button" aria-label="Open search">',
      '<span class="search-icon-svg search-launcher__icon" aria-hidden="true">⌕</span>',
      '<span class="search-launcher__text">Search commands, tasks, and documents…</span>',
      "</button>",
      '<div class="navbar-right">',
      buildIconButton(
        '<span class="icon-sun" aria-hidden="true">☀</span><span class="icon-moon" aria-hidden="true">☾</span>',
        "Toggle theme",
        "",
        { id: "themeToggleBtn", title: "Toggle theme" }
      ),
      '<a class="icon-btn" href="/desk/List/Notification Log" title="Notifications" aria-label="Notifications">',
      '<span aria-hidden="true">🔔</span>',
      notifications ? '<span class="notif-dot"></span>' : "",
      "</a>",
      '<a class="btn-open-app" href="/desk/desktop" aria-label="Open app">',
      '<span>Open App</span><span aria-hidden="true">↗</span>',
      "</a>",
      "</div>",
      "</header>",
    ].join("");

    return [
      '<div class="trevo-cc' + (state.embedded ? " trevo-cc--embedded" : "") + '">',
      '<div class="trevo-layout trevo-layout--native-sidebar">',
      '<main class="trevo-main">',
      header,
      '<div class="dashboard-body">',
      '<section class="hero-section">',
      '<div class="hero-content">',
      '<div class="hero-eyebrow"><span class="eyebrow-pulse"></span>Command Center</div>',
      '<h1 class="hero-title">Welcome back, <span class="hero-name">' + escapeHtml(firstName) + "</span></h1>",
      '<p class="hero-subtitle">Track tasks, review activity, and jump straight into the workspaces that matter most today.</p>',
      "</div>",
      '<div class="hero-cta-group">',
      '<a class="btn-primary" href="/desk/desktop">Open App</a>',
      '<a class="btn-ghost" href="/desk/List/ToDo">My Tasks</a>',
      "</div>",
      "</section>",
      '<section class="kpi-grid">' + renderKpiCards(stats) + "</section>",
      '<div class="dash-grid">',
      '<div class="dash-col-left">',
      '<section class="dash-card">',
      '<div class="card-header"><h2 class="card-title">Quick Actions</h2><a class="card-link" href="/desk/desktop">Open App</a></div>',
      '<div class="shortcuts-grid">' + renderShortcuts(quickActions) + "</div>",
      "</section>",
      '<section class="dash-card">',
      '<div class="card-header"><h2 class="card-title">Recent Activity</h2><a class="card-link" href="/desk/List/Activity Log">View All</a></div>',
      '<div class="activity-list">' + renderActivity(state.dashboardData.recent_activity || []) + "</div>",
      "</section>",
      "</div>",
      '<div class="dash-col-right">',
      '<section class="dash-card">',
      '<div class="card-header"><h2 class="card-title">Tasks</h2><a class="card-link" href="/desk/List/ToDo">Open ToDos</a></div>',
      '<div class="task-list">' + renderTasks(state.dashboardData.tasks || []) + "</div>",
      "</section>",
      '<section class="dash-card">',
      '<div class="card-header"><h2 class="card-title">Recent Documents</h2><a class="card-link" href="/desk/desktop">Open Workspace</a></div>',
      '<div class="doc-list">' + renderDocuments(state.dashboardData.recent_documents || []) + "</div>",
      "</section>",
      "</div>",
      "</div>",
      "</div>",
      "</main>",
      "</div>",
      "</div>",
    ].join("");
  }

  function bindInteractions() {
    var sidebarContainer = document.querySelector(".body-sidebar-container");
    var mobileMenuBtn = document.getElementById("mobileMenuBtn");
    var themeBtn = document.getElementById("themeToggleBtn");
    var searchLauncher = document.getElementById("searchLauncherBtn");
    var logoutBtn = document.getElementById("logoutBtn");
    var html = document.documentElement;

    if (localStorage.getItem("sidebar-collapsed") === "true") {
      html.classList.add("sidebar-collapsed");
    }

    function openMobileSidebar() {
      if (typeof frappe !== "undefined" && frappe.app && frappe.app.sidebar) {
        frappe.app.sidebar.open();
      } else if (sidebarContainer) {
        sidebarContainer.classList.add("expanded");
      }
      if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "true");
    }

    function closeMobileSidebar() {
      if (typeof frappe !== "undefined" && frappe.app && frappe.app.sidebar) {
        frappe.app.sidebar.close();
      } else if (sidebarContainer) {
        sidebarContainer.classList.remove("expanded");
      }
      if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "false");
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        openMobileSidebar();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMobileSidebar();
      }
    });

    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var nextTheme = getTheme() === "dark" ? "light" : "dark";
        setTheme(nextTheme, true);
        syncFrappeTheme(nextTheme);
      });
    }

    if (searchLauncher) {
      searchLauncher.addEventListener("click", function () {
        openNativeSearch();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        var session = window._trevoSession || {};
        var token = session.csrfToken || "";

        if (!token || typeof fetch !== "function") {
          window.location.href = "/login";
          return;
        }

        fetch("/api/method/logout", {
          method: "POST",
          headers: { "X-Frappe-CSRF-Token": token },
        }).finally(function () {
          window.location.href = "/login";
        });
      });
    }

    document.querySelectorAll(".shortcut-tile, .activity-row, .task-item, .doc-row, .btn-open-app, .btn-primary, .btn-ghost, .card-link").forEach(function (node) {
      node.addEventListener("click", function () {
        closeMobileSidebar();
      });
    });
  }

  function render() {
    var root = document.getElementById("trevo-desk-root");
    if (!root) return;

    try {
      setTheme(getTheme(), false);
      root.innerHTML = buildDashboardMarkup();
      setBodyState(true);
      bindInteractions();
      hideSplash();
    } catch (error) {
      console.error("Trevo command center render failed:", error);
      root.innerHTML = '<div class="trevo-command-center"><div class="dash-card"><div class="empty-state"><p>Trevo command center could not load.</p><p>' + escapeHtml(error && error.message ? error.message : "Unknown error") + '</p></div></div></div>';
      setBodyState(true);
      hideSplash();
    }
  }

  // Used by the "trevo-dashboard" desk Page: render into a container inside Frappe desk.
  window.trevo_dashboard = {
    mount: function (root, data) {
      state.embedded = true;
      state.dashboardData = data || {};
      state.workspaces = (data && data.workspaces) || [];
      try {
        // No bindInteractions(): its header buttons don't exist here, and its
        // click handlers would collapse Frappe's own sidebar.
        root.innerHTML = buildDashboardMarkup();
      } catch (error) {
        console.error("Trevo command center render failed:", error);
        root.innerHTML = '<div class="trevo-cc"><div class="dash-card"><div class="empty-state"><p>Trevo command center could not load.</p></div></div></div>';
      }
    },
  };

  // Legacy standalone page (www/desk.html) — only when its root element exists.
  if (document.getElementById("trevo-desk-root")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", render);
    } else {
      render();
    }
  }
})();
