// Trevo Home: the desk's home page (set as the "desktop:home_page" default on install).
//
// A Page of its own rather than changes to Frappe's apps screen, so Frappe can change that
// screen without breaking this one. Built from public desk APIs only:
//   - top bar: logo, search (the desk's awesomebar), notifications (frappe.ui.Notifications),
//     user menu (frappe.ui.Dropdown)
//   - greeting with today's date
//   - Create: new-document buttons, only for DocTypes the user may create
//   - At a glance: the Number Cards of the modules the user can open, one module at a time,
//     with the module workspace's first chart and a link to the workspace, drawn by Frappe's
//     own NumberCardWidget and ChartWidget (permission filtering: desk/home.py)
//   - Modules: each app's dock entries, the same list, icons and routes as the left rail
//   - Recent: what the user submitted, edited, opened and viewed (desk/home.py)
// Frappe's apps screen stays at /desk/desktop and is linked from the user menu.

// Wrapped: Frappe evaluates page scripts in the global scope.
(() => {
	frappe.pages["trevo-home"].on_page_load = function (wrapper) {
		const page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Home"),
			single_column: true,
			hide_sidebar: true,
			hide_dock: true,
		});
		page.page_head.hide();
		frappe.pages["trevo-home"].home = new TrevoHome(page);
	};

	frappe.pages["trevo-home"].on_page_show = function () {
		frappe.pages["trevo-home"].home?.refresh();
	};

	const esc = (s) => frappe.utils.escape_html(String(s == null ? "" : s));
	const icon = (name, size) => frappe.utils.icon(name, size || "sm");
	const store = {
		get(key) {
			try {
				return localStorage.getItem(key);
			} catch (e) {
				return null;
			}
		},
		set(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch (e) {
				// storage blocked: the choice just isn't remembered
			}
		},
	};

	// Common first actions in a business desk. Shown only when the user may create the
	// DocType, so a role without Selling never sees "New Sales Order". Ordered by how central
	// the document is; each role sees the first six it may create (Selling: orders and quotes;
	// Stock: entries and receipts; Projects: tasks and timesheets; no business role: to-dos,
	// events and notes).
	const QUICK_CREATE = [
		"Sales Invoice",
		"Sales Order",
		"Quotation",
		"Customer",
		"Item",
		"Purchase Order",
		"Payment Entry",
		"Lead",
		"Purchase Invoice",
		"Supplier",
		"Journal Entry",
		"Stock Entry",
		"Delivery Note",
		"Purchase Receipt",
		"Material Request",
		"Work Order",
		"BOM",
		"Project",
		"Task",
		"Timesheet",
		"Issue",
		"Opportunity",
		"Asset",
		"Quality Inspection",
		"ToDo",
		"Event",
		"Note",
	];
	const QUICK_CREATE_MAX = 6;
	const CUSTOM_CREATE_MAX = 3;
	// Role name prefix → module, for ERPNext's standard "<Area> User / Manager" roles.
	const ROLE_MODULES = {
		Accounts: "Accounts",
		Sales: "Selling",
		Purchase: "Buying",
		Stock: "Stock",
		Manufacturing: "Manufacturing",
		Projects: "Projects",
		Quality: "Quality Management",
		Support: "Support",
	};
	const KPI_MODULE_KEY = () => `trevo:home-kpi-module:${frappe.session.user}`;
	// Read-only: the home shows cards, it does not edit workspaces.
	const KPI_WIDGET_OPTIONS = {
		allow_sorting: false,
		allow_create: false,
		allow_delete: false,
		allow_hiding: false,
		allow_edit: false,
		allow_resize: false,
		for_workspace: true,
	};
	const ACTION_CLASS = {
		Submitted: "is-submitted",
		Cancelled: "is-cancelled",
	};

	class TrevoHome {
		constructor(page) {
			this.page = page;
			this.$root = $(`<div class="trevo-home-page">
				<header class="trevo-topbar"></header>
				<main class="trevo-home"></main>
			</div>`).appendTo(page.body);
			this.$topbar = this.$root.find(".trevo-topbar");
			this.$home = this.$root.find(".trevo-home");
			this.make_topbar();
		}

		refresh() {
			const token = (this.token = (this.token || 0) + 1);
			this.$home.empty();
			this.render_greeting();
			// One request decides what this user can use; a skeleton holds the space meanwhile.
			const $loading = $(`<div class="trevo-home__skeleton" aria-busy="true" aria-label="${esc(__("Loading"))}">
				<span></span><span></span><span></span><span></span>
			</div>`).appendTo(this.$home);

			const opened = (window.trevo && trevo.get_opened && trevo.get_opened()) || [];
			frappe
				.xcall("trevo_whitelabel.desk.home.get_home_data", { opened: JSON.stringify(opened) })
				.catch(() => ({}))
				.then((data) => {
					if (token !== this.token) return; // a newer refresh is drawing
					$loading.remove();
					this.render_body(data || {});
				});
		}

		// Sections appear only when the user has something in them. A user with no business
		// role gets an explanation instead of an empty page.
		render_body(data) {
			const custom = data.custom || [];
			const has_create = this.render_create(custom);
			const $kpis = $(`<section class="trevo-home__kpis"></section>`).appendTo(this.$home);
			const has_kpis = this.render_kpis($kpis, data.kpis || []);

			const $columns = $(`<div class="trevo-home__columns">
				<div class="trevo-home__main"></div>
				<aside class="trevo-home__aside"></aside>
			</div>`).appendTo(this.$home);
			const $main = $columns.find(".trevo-home__main");
			const has_modules = this.render_modules($main, this.module_filter(data));
			const has_custom = this.render_custom($main, custom);
			// The framework's System group stays last, after the site's own modules.
			$main.find(".trevo-home__group--secondary").appendTo($main);
			if (!has_modules && !has_custom) {
				$main.remove();
				$columns.addClass("trevo-home__columns--single");
			}
			this.render_recent(this.make_recent_section($columns.find(".trevo-home__aside")), data.recent || []);

			if (!has_create && !has_kpis && !has_modules && !has_custom) {
				this.render_no_access().insertAfter(this.$home.find(".trevo-greeting"));
			}
		}

		render_no_access() {
			const $notice = $(`<section class="trevo-home__notice">
				<span class="trevo-home__notice-icon">${icon("lock-keyhole", "md")}</span>
				<div class="trevo-home__notice-text">
					<h2>${esc(__("Your account is ready"))}</h2>
					<p>${esc(
						__(
							"You don't have access to any modules yet. Ask your administrator to give you a role, then reload this page."
						)
					)}</p>
				</div>
				<a class="trevo-chip" href="/desk/user/${esc(encodeURIComponent(frappe.session.user))}">
					${icon("user", "xs")}<span>${esc(__("My Profile"))}</span>
				</a>
			</section>`);
			return $notice;
		}

		// ── Top bar ──
		make_topbar() {
			const logo = frappe.boot.app_logo_url || "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg";
			const shortcut = frappe.utils.is_mac() ? "⌘K" : "Ctrl+K";
			this.$topbar.html(`
				<a class="trevo-topbar__brand" href="/desk" aria-label="${esc(__("Home"))}">
					<img src="${esc(logo)}" alt="">
					<span>Trevo</span>
				</a>
				<button type="button" class="trevo-topbar__search">
					${icon("search", "sm")}
					<span class="trevo-topbar__search-label">${esc(__("Search or type a command"))}</span>
					<kbd>${esc(shortcut)}</kbd>
				</button>
				<div class="trevo-topbar__actions">
					<div class="trevo-topbar__notifications">
						<button type="button" class="btn-reset desktop-notification-icon" aria-label="${esc(__("Notifications"))}">
							${icon("bell", "md")}
							<span class="notification-count hidden" aria-live="polite"></span>
						</button>
					</div>
					<button type="button" class="btn-reset trevo-topbar__avatar" aria-label="${esc(__("User menu"))}">
						${frappe.avatar(frappe.session.user, "avatar-medium")}
					</button>
				</div>
			`);

			// The desk's awesomebar (made by make_app_page); Ctrl/⌘+K already opens it globally.
			const $search = this.$topbar.find(".trevo-topbar__search");
			if (frappe.boot.desk_settings?.search_bar) {
				$search.on("click", () => frappe.search.open_awesomebar_from_global_search_shortcut?.());
			} else {
				$search.addClass("hidden");
			}

			if (frappe.boot.desk_settings?.notifications !== 0) {
				this.notifications = new frappe.ui.Notifications({
					wrapper: this.$topbar.find(".trevo-topbar__notifications"),
					popover: true,
				});
			} else {
				this.$topbar.find(".trevo-topbar__notifications").addClass("hidden");
			}

			this.make_user_menu();
		}

		make_user_menu() {
			const is_dark = document.documentElement.getAttribute("data-theme") === "dark";
			new frappe.ui.Dropdown({
				trigger: this.$topbar.find(".trevo-topbar__avatar"),
				align: "end",
				options: [
					{
						label: __("My Profile"),
						icon: "user",
						href: `/desk/user/${encodeURIComponent(frappe.session.user)}`,
					},
					{ label: __("All Apps"), icon: "layout-grid", href: "/desk/desktop" },
					{
						label: __("Toggle Theme"),
						icon: is_dark ? "sun" : "moon",
						onclick: () => new frappe.ui.ThemeSwitcher().show(),
					},
					{ label: __("About"), icon: "info", onclick: () => frappe.ui.toolbar.show_about() },
					{ label: __("Log out"), icon: "log-out", onclick: () => frappe.app.logout() },
				],
			});
		}

		// ── Greeting and Create ──
		render_greeting() {
			const hour = new Date().getHours();
			const hello =
				hour < 12 ? __("Good morning") : hour < 17 ? __("Good afternoon") : __("Good evening");
			const name = frappe.boot.user?.first_name || frappe.session.user_fullname;
			let date = "";
			try {
				date = new Date().toLocaleDateString(frappe.boot.lang || undefined, {
					weekday: "long",
					day: "numeric",
					month: "long",
				});
			} catch (e) {
				// unknown locale: leave the date out
			}
			$(`<header class="trevo-greeting">
				<p class="trevo-greeting__date">${esc(date)}</p>
				<h1 class="trevo-display">${esc(name ? `${hello}, ${name}` : hello)}</h1>
				<p class="trevo-greeting__lead">${esc(__("Everything in Trevo, one click away."))}</p>
			</header>`).appendTo(this.$home);
		}

		render_create(custom) {
			const can = new Set(frappe.boot.user.can_create || []);
			// The site's own DocTypes first (that is what a role made for them is for), then the
			// first standard ones this user may create.
			const doctypes = [
				...custom.filter((c) => c.can_create).slice(0, CUSTOM_CREATE_MAX).map((c) => c.doctype),
				...QUICK_CREATE.filter((dt) => can.has(dt)),
			]
				.filter((dt, i, all) => all.indexOf(dt) === i)
				.slice(0, QUICK_CREATE_MAX);
			if (!doctypes.length) return false;
			const $section = $(`<section class="trevo-home__create" aria-label="${esc(__("Create"))}">
				<h2 class="trevo-home__label">${esc(__("Create"))}</h2>
				<div class="trevo-home__create-list"></div>
			</section>`).appendTo(this.$home);
			doctypes.forEach((dt) => {
				$(`<button type="button" class="trevo-chip">${icon("plus", "xs")}<span>${esc(__(dt))}</span></button>`)
					.on("click", () => frappe.new_doc(dt))
					.appendTo($section.find(".trevo-home__create-list"));
			});
			return true;
		}

		// ── At a glance ──
		// Business modules in the order of the user's own dock, so the first tab is the module
		// they put first. Each tab's cards are drawn once, on first open.
		dock_modules() {
			const sidebar = frappe.app?.sidebar;
			if (!sidebar?.collect_dock_entries) return [];
			return (frappe.boot.app_data || [])
				.filter((app) => app.on_apps_screen)
				.sort((a, b) => (a.sequence_id ?? 100) - (b.sequence_id ?? 100))
				.flatMap((app) => sidebar.collect_dock_entries(app).map((entry) => entry.module))
				.filter(Boolean);
		}

		// Modules named by the user's ERPNext roles ("Stock User", "Sales Manager", ...).
		role_modules() {
			const roles = frappe.user_roles || [];
			return new Set(
				Object.entries(ROLE_MODULES)
					.filter(([prefix]) => roles.some((r) => r.startsWith(`${prefix} `)))
					.map(([, module]) => module)
			);
		}

		module_label(module) {
			const sidebars = frappe.boot.module_sidebars || {};
			const sidebar = sidebars[module] || Object.values(sidebars).find((s) => s.module === module);
			return __(sidebar?.label || module);
		}

		render_kpis($section, groups) {
			if (!groups.length || !frappe.widget?.make_widget) {
				$section.remove();
				return false;
			}
			// The user's own modules first (a Stock User opens on Stock), then dock order.
			const order = this.dock_modules();
			const own = this.role_modules();
			const rank = (m) =>
				(own.has(m) ? 0 : 1000) + (order.includes(m) ? order.indexOf(m) : order.length);
			groups = groups.slice().sort((a, b) => rank(a.module) - rank(b.module));

			// One module: a tab bar with a single tab is noise, so name the module in the heading.
			const single = groups.length === 1;
			const heading = single
				? __("{0} at a glance", [this.module_label(groups[0].module)])
				: __("At a glance");
			$section.removeClass("hidden").html(`
				<div class="trevo-home__kpi-head">
					<h2 class="trevo-home__label">${esc(heading)}</h2>
					<div class="trevo-tabs${single ? " hidden" : ""}" role="tablist" aria-label="${esc(__("Module"))}"></div>
				</div>
				<div class="trevo-home__kpi-panels"></div>
			`);
			const $tabs = $section.find(".trevo-tabs");
			const $panels = $section.find(".trevo-home__kpi-panels");
			const panels = {};

			const select = (module) => {
				$tabs.find(".trevo-tab").each(function () {
					const on = this.dataset.module === module;
					this.classList.toggle("active", on);
					this.setAttribute("aria-selected", String(on));
					this.tabIndex = on ? 0 : -1;
				});
				Object.values(panels).forEach(($p) => $p.addClass("hidden"));
				if (!panels[module]) {
					panels[module] = this.make_kpi_panel(groups.find((g) => g.module === module)).appendTo(
						$panels
					);
				}
				panels[module].removeClass("hidden");
				store.set(KPI_MODULE_KEY(), module);
			};

			groups.forEach((group) => {
				$(`<button type="button" class="trevo-tab" role="tab" data-module="${esc(group.module)}">
					${esc(this.module_label(group.module))}
				</button>`)
					.on("click", () => select(group.module))
					.appendTo($tabs);
			});
			// Arrow keys move between tabs, as in any tab list.
			$tabs.on("keydown", ".trevo-tab", (e) => {
				if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
				const $all = $tabs.find(".trevo-tab");
				const i = $all.index(e.currentTarget) + (e.key === "ArrowRight" ? 1 : -1);
				const next = $all.get((i + $all.length) % $all.length);
				next.focus();
				next.click();
				e.preventDefault();
			});

			const saved = store.get(KPI_MODULE_KEY());
			select(groups.some((g) => g.module === saved) ? saved : groups[0].module);
			return true;
		}

		// One module: its Number Cards, then the first chart of its workspace, then a link to
		// the workspace for everything else. Frappe's widgets fetch and draw the values.
		make_kpi_panel(group) {
			const label = this.module_label(group.module);
			const $panel = $(`<div class="trevo-home__kpi-panel" role="tabpanel" aria-label="${esc(label)}">
				<div class="trevo-home__kpi-grid"></div>
			</div>`);
			const $grid = $panel.find(".trevo-home__kpi-grid");
			group.cards.forEach((card) => {
				frappe.widget.make_widget({
					widget_type: "number_card",
					container: $(`<div class="trevo-kpi"></div>`).appendTo($grid),
					name: card.name,
					number_card_name: card.name,
					label: card.label,
					options: KPI_WIDGET_OPTIONS,
				});
			});

			if (group.chart) {
				frappe.widget.make_widget({
					widget_type: "chart",
					container: $(`<div class="trevo-kpi-chart"></div>`).appendTo($panel),
					name: group.chart.name,
					chart_name: group.chart.name,
					label: group.chart.label,
					width: "Full",
					height: 220,
					options: KPI_WIDGET_OPTIONS,
				});
			}

			if (group.workspace) {
				$(`<a class="trevo-home__kpi-more" href="/desk/${esc(frappe.router.slug(group.workspace))}">
					<span>${esc(__("Open {0}", [__(group.workspace)]))}</span>${icon("arrow-right", "xs")}
				</a>`).appendTo($panel);
			}
			return $panel;
		}

		// ── Modules ──
		// One group per app on the apps screen, in Frappe's order (business apps first; the
		// framework's "System" declares sequence 1000 so it trails, and is styled as secondary).
		// Whether a dock entry leads somewhere this user can work. The entry's sidebar names its
		// real module (the "Quality" tile is the "Quality Management" module).
		//  - a module that owns DocTypes: the user may read one of them (desk/home.py)
		//  - a grouping module (Build, Users, Data, System): the user may read a DocType it links to
		// Without server data (request failed) every entry is kept, as the rail keeps them.
		module_filter(data) {
			if (!Array.isArray(data.modules)) return () => true;
			const usable = new Set(data.modules);
			const owners = new Set(data.doctype_modules || []);
			const can_read = new Set(frappe.boot.user.can_read || []);
			const sidebars = frappe.boot.module_sidebars || {};
			return (entry) => {
				const bar = sidebars[entry.link_to] || sidebars[entry.label];
				const module = bar?.module || entry.module;
				if (!module) return true;
				if (owners.has(module)) return usable.has(module);
				return (bar?.items || []).some((i) => i.link_type === "DocType" && can_read.has(i.link_to));
			};
		}

		render_modules($main, is_usable) {
			const sidebar = frappe.app?.sidebar;
			if (!sidebar?.collect_dock_entries || !sidebar.dock_entry_route) return false;
			const apps = (frappe.boot.app_data || [])
				.filter((app) => app.on_apps_screen)
				.sort((a, b) => (a.sequence_id ?? 100) - (b.sequence_id ?? 100));
			let shown = false;

			apps.forEach((app) => {
				const entries = sidebar
					.collect_dock_entries(app)
					.filter(is_usable)
					.map((entry) => ({ entry, route: sidebar.dock_entry_route(entry) }))
					.filter((x) => x.route);
				if (!entries.length) return;
				shown = true;

				const secondary = app.app_name === "frappe";
				const $group = $(`<section class="trevo-home__group${secondary ? " trevo-home__group--secondary" : ""}">
					<h2 class="trevo-home__label">
						${app.app_logo_url ? `<img src="${esc(app.app_logo_url)}" alt="">` : ""}
						<span>${esc(__(app.app_title))}</span>
					</h2>
					<div class="trevo-home__modules"></div>
				</section>`).appendTo($main);

				entries.forEach(({ entry, route }) => {
					const external = route.startsWith("http");
					$(`<a class="trevo-module" href="${esc(route)}"${external ? ' target="_blank" rel="noopener"' : ""}>
						<span class="trevo-module__icon">${entry.icon ? icon(entry.icon, "md") : ""}</span>
						<span class="trevo-module__label">${esc(__(entry.label))}</span>
					</a>`)
						.on("click", (e) => {
							// Same as the rail: select the module's sidebar first, then route.
							if (external || e.metaKey || e.ctrlKey || e.shiftKey) return;
							e.preventDefault();
							sidebar.open_dock_entry(entry);
						})
						.appendTo($group.find(".trevo-home__modules"));
				});
			});
			return shown;
		}

		// DocTypes made on this site have no module tile of their own (Frappe adds no sidebar or
		// dock entry for them). Group the ones the user may read by the module they were filed
		// under, headed like an app group: the app's logo, the module name, a "Custom" tag.
		render_custom($main, custom) {
			if (!custom.length) return false;
			const apps = Object.fromEntries((frappe.boot.app_data || []).map((a) => [a.app_name, a]));
			const by_module = {};
			custom.forEach((c) => (by_module[c.module || ""] ||= []).push(c));

			Object.entries(by_module)
				.sort(([a], [b]) => this.module_label(a).localeCompare(this.module_label(b)))
				.forEach(([module, doctypes]) => {
					const logo = apps[doctypes[0].app]?.app_logo_url;
					const title = module ? this.module_label(module) : __("Other");
					const $group = $(`<section class="trevo-home__group">
						<h2 class="trevo-home__label">
							${logo ? `<img src="${esc(logo)}" alt="">` : ""}
							<span>${esc(title)}</span>
							<span class="trevo-home__tag">${esc(__("Custom"))}</span>
						</h2>
						<div class="trevo-home__modules"></div>
					</section>`).appendTo($main);
					doctypes.forEach((c) => {
						$(`<a class="trevo-module" href="/desk/${esc(frappe.router.slug(c.doctype))}">
							<span class="trevo-module__icon">${icon("file-text", "md")}</span>
							<span class="trevo-module__label">${esc(c.label)}</span>
						</a>`).appendTo($group.find(".trevo-home__modules"));
					});
				});
			return true;
		}

		// ── Recent ──
		make_recent_section($aside) {
			return $(`<section class="trevo-home__recent" aria-label="${esc(__("Recent"))}">
				<h2 class="trevo-home__label">${esc(__("Recent"))}</h2>
				<div class="trevo-home__recent-list" aria-busy="true"></div>
			</section>`).appendTo($aside);
		}

		recent_link(item) {
			if (item.type === "Form") return frappe.utils.get_form_link(item.doctype, item.name);
			if (item.type === "List") return `/desk/${frappe.router.slug(item.doctype)}`;
			return `/desk/query-report/${encodeURIComponent(item.name)}`;
		}

		render_recent($section, items) {
			const $list = $section.find(".trevo-home__recent-list").attr("aria-busy", "false");
			if (!items.length) {
				// First days on the desk: say what will appear here and offer the way in.
				const shortcut = frappe.utils.is_mac() ? "⌘K" : "Ctrl+K";
				const $empty = $(`<div class="trevo-home__empty">
					<span class="trevo-home__empty-icon">${icon("history", "md")}</span>
					<p class="trevo-home__empty-title">${esc(__("Nothing here yet"))}</p>
					<p>${esc(__("Documents you open or change will show up here."))}</p>
				</div>`).appendTo($list);
				if (frappe.boot.desk_settings?.search_bar) {
					$(`<button type="button" class="trevo-chip">${icon("search", "xs")}<span>${esc(
						__("Find a document")
					)}</span><kbd>${esc(shortcut)}</kbd></button>`)
						.on("click", () => frappe.search.open_awesomebar_from_global_search_shortcut?.())
						.appendTo($empty);
				}
				return;
			}
			const icons = { Form: "file-text", List: "list", Report: "chart-bar" };
			items.forEach((item) => {
				$(`<a class="trevo-recent" href="${esc(this.recent_link(item))}">
					<span class="trevo-recent__icon">${icon(icons[item.type] || "file", "sm")}</span>
					<span class="trevo-recent__text">
						<span class="trevo-recent__title">${esc(item.title)}</span>
						<span class="trevo-recent__meta">
							<span class="trevo-recent__action ${ACTION_CLASS[item.action_key] || ""}">${esc(item.action)}</span>
							· ${esc(item.subtitle)} · ${esc(frappe.datetime.prettyDate(item.when, true))}
						</span>
					</span>
				</a>`).appendTo($list);
			});
		}
	}
})();
