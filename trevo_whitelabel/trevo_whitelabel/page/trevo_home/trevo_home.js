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
	const QUICK_CREATE_MAX = 8;
	const CREATE_INLINE = 2; // shown as buttons; all of them are in the "New" menu
	const CUSTOM_CREATE_MAX = 3;
	// A DocType outside QUICK_CREATE joins Create once the user has worked with it this much
	// (desk/home.py get_usage: an edit is 3, an open 2, a list visit 1).
	const FREQUENT_MIN = 6;
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
		// Layout: a main column (Create, KPIs, modules) and a sidebar that stays in view (work
		// waiting on the user, then Recent). On phones the waiting work comes first.
		render_body(data) {
			const custom = data.custom || [];
			this.custom = custom;
			this.create_config = data.create_config || [];
			this.usage = data.usage || { doctypes: {}, modules: {} };
			const $layout = $(`<div class="trevo-home__layout">
				<div class="trevo-home__main"></div>
				<aside class="trevo-home__aside"></aside>
			</div>`).appendTo(this.$home);
			const $main = $layout.find(".trevo-home__main");
			const $aside = $layout.find(".trevo-home__aside");

			this.set_headline(data);
			this.render_attention($aside, data.approvals, data.assigned, data.cues);
			this.render_events($aside, data.events || []);
			// The numbers lead; Create follows them.
			// Create sits beside the greeting and follows the selected KPI tab (Stock → Stock
			// documents); without KPIs it shows the general list.
			const has_create = this.render_create(null);
			const $kpis = $(`<section class="trevo-home__kpis"></section>`).appendTo($main);
			const has_kpis = this.render_kpis($kpis, data.kpis || []);
			const has_modules = this.render_modules($main, this.module_filter(data));
			const has_custom = this.render_custom($main, custom);
			// The framework's System group stays last, after the site's own modules.
			$main.find(".trevo-home__group--secondary").appendTo($main);
			this.render_recent(this.make_recent_section($aside), data.recent || []);

			if (!has_create && !has_kpis && !has_modules && !has_custom) {
				this.render_no_access().prependTo($main);
			}
			this.watch_aside($aside);
		}

		// The sidebar stays in view while scrolling only when all of it fits the window.
		watch_aside($aside) {
			const fit = () => {
				const el = $aside[0];
				if (el?.isConnected) el.classList.toggle("is-sticky", el.offsetHeight < window.innerHeight - 96);
			};
			fit();
			setTimeout(fit, 1500); // after the Recent and widget content settles
			$(window).off("resize.trevo_aside").on("resize.trevo_aside", frappe.utils.debounce(fit, 150));
		}

		// ── Needs your attention ──
		// Work waiting on this user, above everything else: documents in a workflow state where
		// they can act (a finance head sees purchase orders waiting for approval) and open
		// assignments. Hidden when there is nothing waiting.
		// Always drawn, so every user has the same anchor: workflow approvals (when a workflow
		// involves them), work ERPNext's statuses say is waiting in their modules (cues: for
		// the many users no workflow involves), and assignments. With none, a short "all clear".
		render_attention($aside, approvals, assigned, cues) {
			approvals = approvals || { items: [], total: 0, mine: [], mine_total: 0 };
			assigned = assigned || { items: [], total: 0 };
			cues = cues || { items: [] };
			const has_work = approvals.total || approvals.mine_total || assigned.total || cues.items.length;

			const $section = $(`<section class="trevo-attention" aria-label="${esc(__("Needs your attention"))}">
				<h2 class="trevo-home__label">${esc(__("Needs your attention"))}</h2>
				<div class="trevo-attention__grid"></div>
			</section>`).appendTo($aside);
			const $grid = $section.find(".trevo-attention__grid");

			if (!has_work) {
				$(`<div class="trevo-attention__card trevo-attention__clear">
					<span class="trevo-attention__clear-icon">${icon("circle-check", "md")}</span>
					<div>
						<p class="trevo-attention__clear-title">${esc(__("Nothing needs you right now"))}</p>
						<p class="trevo-attention__clear-text">${esc(
							__("Approvals, overdue documents and tasks assigned to you will appear here.")
						)}</p>
					</div>
				</div>`).appendTo($grid);
				return;
			}

			if (approvals.total) {
				const $card = this.attention_card($grid, "check-check", __("Waiting for your approval"), approvals.total);
				approvals.items.forEach((item) => this.approval_row(item).appendTo($card.find(".trevo-attention__list")));
				this.more_note($card, approvals.total - approvals.items.length);
			}
			// The user's own documents with a next step (e.g. a draft to submit for approval).
			if (approvals.mine_total) {
				const $card = this.attention_card($grid, "send", __("Your documents to move on"), approvals.mine_total);
				approvals.mine.forEach((item) => this.approval_row(item, true).appendTo($card.find(".trevo-attention__list")));
				this.more_note($card, approvals.mine_total - approvals.mine.length);
			}
			if (cues.items.length) {
				const $card = $(`<div class="trevo-attention__card">
					<div class="trevo-attention__head">
						<span class="trevo-attention__icon">${icon("list-checks", "sm")}</span>
						<span class="trevo-attention__title">${esc(__("In your modules"))}</span>
					</div>
					<div class="trevo-cues"></div>
				</div>`).appendTo($grid);
				cues.items.forEach((cue) => this.cue_row(cue, cues.currency).appendTo($card.find(".trevo-cues")));
			}
			if (assigned.total) {
				const $card = this.attention_card($grid, "user-check", __("Assigned to you"), assigned.total);
				assigned.items.forEach((item) => this.assigned_row(item).appendTo($card.find(".trevo-attention__list")));
				this.more_note($card, assigned.total - assigned.items.length, "/desk/todo?status=Open");
			}
		}

		// One cue: "Overdue customer invoices · ₨ 31.51 L ……… 44". Opens the list with the
		// same filters the count used (applied by the list view from route_options).
		cue_row(cue, currency) {
			const count = cue.more ? `${cue.count}+` : String(cue.count);
			const amount = cue.amount ? this.short_amount(cue.amount, currency) : "";
			return $(`<button type="button" class="trevo-cue is-${esc(cue.tone)}">
				<span class="trevo-cue__icon">${icon(cue.icon || "circle-dot", "sm")}</span>
				<span class="trevo-cue__text">
					<span class="trevo-cue__label">${esc(cue.label)}</span>
					${amount ? `<span class="trevo-cue__amount">${esc(amount)}</span>` : ""}
				</span>
				<span class="trevo-cue__count">${esc(count)}</span>
			</button>`).on("click", () => {
				const options = {};
				cue.filters.forEach(([field, op, value]) => {
					options[field] = op === "=" ? value : [op === "between" ? "Between" : op, value];
				});
				frappe.route_options = options;
				frappe.set_route("List", cue.doctype);
			});
		}

		// As Number Cards show money: "₨ 31.51 L".
		short_amount(value, currency) {
			const country = frappe.sys_defaults?.country;
			const [number, suffix] = frappe.utils.shorten_number(value, country, 5).split(" ");
			return format_currency(parseFloat(number), currency) + (suffix ? ` ${suffix}` : "");
		}

		// ── Coming up ──
		// The user's calendar for the next week, so a quiet day still shows what is next.
		render_events($aside, events) {
			if (!events.length) return;
			const $section = $(`<section class="trevo-events">
				<h2 class="trevo-home__label">${esc(__("Coming up"))}</h2>
				<div class="trevo-attention__card"><div class="trevo-events__list"></div></div>
			</section>`).appendTo($aside);
			const today = frappe.datetime.get_today();
			events.forEach((ev) => {
				const start = frappe.datetime.str_to_obj(ev.starts_on);
				const day = frappe.datetime.obj_to_str(start);
				const diff = frappe.datetime.get_day_diff(day, today);
				const when = diff === 0 ? __("Today") : diff === 1 ? __("Tomorrow") : start.toLocaleDateString(undefined, { weekday: "long" });
				const time = ev.all_day ? __("All day") : start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
				$(`<a class="trevo-event" href="/desk/event/${esc(encodeURIComponent(ev.name))}">
					<span class="trevo-event__date">
						<span class="trevo-event__day">${esc(start.getDate())}</span>
						<span class="trevo-event__month">${esc(start.toLocaleDateString(undefined, { month: "short" }))}</span>
					</span>
					<span class="trevo-event__text">
						<span class="trevo-event__subject">${esc(ev.subject)}</span>
						<span class="trevo-event__when">${esc(`${when} · ${time}`)}</span>
					</span>
				</a>`).appendTo($section.find(".trevo-events__list"));
			});
		}

		attention_card($grid, icon_name, title, total) {
			return $(`<div class="trevo-attention__card">
				<div class="trevo-attention__head">
					<span class="trevo-attention__icon">${icon(icon_name, "sm")}</span>
					<span class="trevo-attention__title">${esc(title)}</span>
					<span class="trevo-attention__count">${esc(total)}</span>
				</div>
				<div class="trevo-attention__list"></div>
			</div>`).appendTo($grid);
		}

		more_note($card, more, href) {
			if (more <= 0) return;
			const text = esc(__("{0} more", [more]));
			$card.append(
				href
					? `<a class="trevo-attention__more" href="${esc(href)}">${text}${icon("arrow-right", "xs")}</a>`
					: `<p class="trevo-attention__more">${text}</p>`
			);
		}

		approval_row(item, own) {
			const link = frappe.utils.get_form_link(item.doctype, item.name);
			// Line 1: who/what and the amount. Line 2: document number, who sent it, how long it
			// has waited. The pill names the DocType (approvals) or the state (own documents).
			const meta = [item.title !== item.name ? item.name : null, own ? null : item.owner, frappe.datetime.prettyDate(item.waiting_since, true)]
				.filter(Boolean)
				.map(esc)
				.join(" · ");
			const $row = $(`<div class="trevo-attention__row">
				<a class="trevo-attention__main" href="${esc(link)}">
					<span class="trevo-attention__name">${esc(item.title)}</span>
					<span class="trevo-attention__meta">${meta}</span>
				</a>
				<div class="trevo-attention__side">
					${item.amount ? `<span class="trevo-attention__amount">${esc(item.amount)}</span>` : ""}
					<span class="trevo-attention__state">${esc(own ? __(item.state) : __(item.doctype))}</span>
				</div>
				<div class="trevo-attention__actions"></div>
			</div>`);
			// The first two actions (usually Approve / Reject) inline; the form has the rest.
			item.actions.slice(0, 2).forEach((action, i) => {
				$(`<button type="button" class="trevo-action ${i === 0 ? "trevo-action--primary" : ""}">${esc(__(action))}</button>`)
					.on("click", () => this.apply_action(item, action))
					.appendTo($row.find(".trevo-attention__actions"));
			});
			return $row;
		}

		// Frappe's own workflow API, the same call the list view's bulk action makes: it checks
		// the transition, roles and conditions and saves/submits as the form would.
		apply_action(item, action) {
			// Name the document exactly (number, party, amount) so the decision is unambiguous.
			const what = [item.name, item.title !== item.name ? item.title : null, item.amount].filter(Boolean).join(" · ");
			frappe.confirm(__("{0} {1}: {2}?", [__(action), __(item.doctype), what]), () => {
				frappe
					.xcall("frappe.model.workflow.bulk_workflow_approval", {
						docnames: JSON.stringify([item.name]),
						doctype: item.doctype,
						action,
					})
					.then(() => {
						frappe.show_alert({ message: __("{0}: {1}", [__(action), item.title]), indicator: "green" });
						this.refresh();
					});
			});
		}

		assigned_row(item) {
			const link = item.doctype ? frappe.utils.get_form_link(item.doctype, item.name) : `/desk/todo/${encodeURIComponent(item.todo)}`;
			const overdue = item.date && frappe.datetime.get_diff(item.date, frappe.datetime.get_today()) < 0;
			// One pill: overdue, else the due date, else high priority.
			const pill = overdue
				? `<span class="trevo-attention__due is-overdue">${esc(__("Overdue"))}</span>`
				: item.date
				? `<span class="trevo-attention__due">${esc(__("Due {0}", [frappe.datetime.str_to_user(item.date)]))}</span>`
				: item.priority === "High"
				? `<span class="trevo-attention__state is-high">${esc(__("High"))}</span>`
				: "";
			// A task on a document: the task is the headline, the document underneath.
			const name = item.description || item.title || __("To Do");
			const meta = item.doctype ? `${__(item.doctype)} · ${item.title}` : __("To Do");
			return $(`<div class="trevo-attention__row">
				<a class="trevo-attention__main" href="${esc(link)}">
					<span class="trevo-attention__name">${esc(name)}</span>
					<span class="trevo-attention__meta">${esc(meta)}</span>
				</a>
				<div class="trevo-attention__side">${pill}</div>
			</div>`);
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
				<div class="trevo-greeting__text">
					<p class="trevo-greeting__date">${esc(date)}</p>
					<h1 class="trevo-display">${esc(name ? `${hello}, ${name}` : hello)}</h1>
					<p class="trevo-greeting__lead">&nbsp;</p>
				</div>
				<div class="trevo-greeting__actions"></div>
			</header>`).appendTo(this.$home);
		}

		// Headline under the greeting: what is waiting today, in one sentence.
		set_headline(data) {
			const approvals = data.approvals?.total || 0;
			const mine = data.approvals?.mine_total || 0;
			const tasks = data.assigned?.items || [];
			const today = frappe.datetime.get_today();
			const overdue = tasks.filter((t) => t.date && t.date < today).length;
			const parts = [];
			if (approvals) parts.push(__("{0} waiting for your approval", [approvals]));
			if (overdue) parts.push(overdue === 1 ? __("1 overdue task") : __("{0} overdue tasks", [overdue]));
			else if (data.assigned?.total) parts.push(__("{0} assigned to you", [data.assigned.total]));
			if (mine) parts.push(__("{0} of your documents to move on", [mine]));
			// Then the most urgent work in the user's modules ("Overdue customer invoices: 44").
			const cues = (data.cues?.items || []).filter((c) => c.tone === "danger" || c.tone === "warning");
			cues.slice(0, Math.max(0, 2 - parts.length)).forEach((c) => parts.push(__("{0}: {1}", [c.label, c.more ? `${c.count}+` : c.count])));
			this.$home
				.find(".trevo-greeting__lead")
				.text(parts.length ? parts.join(" · ") : __("You're all caught up."))
				.toggleClass("has-work", parts.length > 0);
		}

		// Documents this user may create, most used first (desk/home.py: get_usage), so an
		// accountant who mostly posts Payment Entries sees that first.
		creatable(doctypes) {
			const can = new Set(frappe.boot.user.can_create || []);
			const singles = new Set(frappe.boot.single_types || []);
			const used = this.usage?.doctypes || {};
			return doctypes
				.filter((dt, i, all) => dt && all.indexOf(dt) === i && can.has(dt) && !singles.has(dt))
				.map((dt, i) => ({ dt, i, use: used[dt] || 0 }))
				.sort((a, b) => b.use - a.use || a.i - b.i)
				.map((x) => x.dt);
		}

		// The general list. Trevo Settings > Home > Create buttons replaces the default when set.
		// Default: the site's own DocTypes, the common ERPNext documents, and anything the user
		// creates often.
		general_create() {
			if (this.create_config.length) return this.creatable(this.create_config.map((r) => r.doctype));
			const used = this.usage?.doctypes || {};
			return this.creatable([
				...this.custom.filter((c) => c.can_create).slice(0, CUSTOM_CREATE_MAX).map((c) => c.doctype),
				...QUICK_CREATE,
				...Object.keys(used).filter((dt) => used[dt] >= FREQUENT_MIN),
			]);
		}

		// Documents of one module: the rows configured for it in Trevo Settings, else the
		// DocTypes its sidebar lists (common documents first, then sidebar order).
		module_create(module) {
			if (!module) return [];
			const configured = this.create_config.filter((r) => r.module === module).map((r) => r.doctype);
			if (configured.length) return this.creatable(configured);
			const listed = Object.values(frappe.boot.module_sidebars || {})
				.filter((bar) => bar.module === module)
				.flatMap((bar) => bar.items || [])
				.filter((item) => item.link_type === "DocType")
				.map((item) => item.link_to);
			return this.creatable([...QUICK_CREATE.filter((dt) => listed.includes(dt)), ...listed]);
		}

		// Beside the greeting: the two most likely documents as buttons and a "New" menu with
		// the selected module's documents first, then the rest. Redrawn when the tab changes.
		render_create(module) {
			const $actions = this.$home.find(".trevo-greeting__actions").empty();
			const own = this.module_create(module).slice(0, QUICK_CREATE_MAX);
			const other = this.general_create()
				.filter((dt) => !own.includes(dt))
				.slice(0, own.length ? QUICK_CREATE_MAX - Math.min(own.length, 4) : QUICK_CREATE_MAX);
			const first = own.length ? own : other;
			if (!first.length) return false;

			first.slice(0, CREATE_INLINE).forEach((dt) => {
				$(`<button type="button" class="btn btn-default btn-sm trevo-create-btn">${icon("plus", "xs")}<span>${esc(__(dt))}</span></button>`)
					.on("click", () => frappe.new_doc(dt))
					.appendTo($actions);
			});
			const $menu = $(`<div class="dropdown trevo-create-menu">
				<button type="button" class="btn btn-primary btn-sm" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
					${icon("plus", "xs")}<span>${esc(__("New"))}</span>${icon("chevron-down", "xs")}
				</button>
				<div class="dropdown-menu dropdown-menu-right" role="menu"></div>
			</div>`).appendTo($actions);
			const $list = $menu.find(".dropdown-menu");
			const section = (title, doctypes) => {
				if (!doctypes.length) return;
				if (title) $(`<h6 class="dropdown-header">${esc(title)}</h6>`).appendTo($list);
				doctypes.forEach((dt) => {
					$(`<a class="dropdown-item" href="#" role="menuitem">${esc(__(dt))}</a>`)
						.on("click", (e) => {
							e.preventDefault();
							frappe.new_doc(dt);
						})
						.appendTo($list);
				});
			};
			if (own.length) {
				section(this.module_label(module), own);
				if (other.length) $(`<div class="dropdown-divider"></div>`).appendTo($list);
				section(__("Other"), other);
			} else {
				section(null, other);
			}
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
			// Most-used module first (from the user's own edits and visits), then their role's
			// modules, then dock order.
			const use = this.usage?.modules || {};
			const rank = (m) =>
				-(use[m] || 0) * 10000 + (own.has(m) ? 0 : 1000) + (order.includes(m) ? order.indexOf(m) : order.length);
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
				this.render_create(module);
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
					height: 180,
					options: KPI_WIDGET_OPTIONS,
				});
			}

			// The home is the at-a-glance layer; deeper analysis lives in the module's workspace,
			// its full Dashboard (every card and chart) and, when installed, Frappe Insights.
			const links = [];
			if (group.workspace) {
				links.push([`/desk/${frappe.router.slug(group.workspace)}`, __("Open {0}", [__(group.workspace)])]);
			}
			if (group.dashboard) {
				links.push([`/desk/dashboard-view/${encodeURIComponent(group.dashboard)}`, __("Full dashboard")]);
			}
			if (group.insights) links.push(["/insights", __("Analyse in Insights")]);
			if (links.length) {
				const $links = $(`<div class="trevo-home__kpi-links"></div>`).appendTo($panel);
				links.forEach(([href, text]) => {
					$(`<a class="trevo-home__kpi-more" href="${esc(href)}">
						<span>${esc(text)}</span>${icon("arrow-right", "xs")}
					</a>`).appendTo($links);
				});
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

		// Entries for an app: its dock, or, for an installed app that declares no apps-screen
		// entry (e.g. a client app such as SaathiMart), the module sidebars Frappe made for it.
		app_entries(app) {
			const sidebar = frappe.app.sidebar;
			if (app.on_apps_screen) return sidebar.collect_dock_entries(app);
			return Object.values(frappe.boot.module_sidebars || {})
				.filter((bar) => bar.app === app.app_name && (bar.items || []).length)
				.map((bar) => sidebar.dock_entry({ link_type: "Sidebar", link_to: bar.name }))
				.filter(Boolean);
		}

		render_modules($main, is_usable) {
			const sidebar = frappe.app?.sidebar;
			if (!sidebar?.collect_dock_entries || !sidebar.dock_entry_route || !sidebar.dock_entry) return false;
			// This app (the white label itself) has nothing to open.
			const apps = (frappe.boot.app_data || [])
				.filter((app) => app.app_name !== "trevo_whitelabel")
				.sort(
					(a, b) =>
						(b.on_apps_screen ? 1 : 0) - (a.on_apps_screen ? 1 : 0) ||
						(a.sequence_id ?? 100) - (b.sequence_id ?? 100)
				);
			let shown = false;

			apps.forEach((app) => {
				const entries = this.app_entries(app)
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
						<span class="trevo-module__icon">${icon(entry.icon || "package", "md")}</span>
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
