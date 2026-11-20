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
	const ATTENTION_REFRESH_MS = 5 * 60 * 1000;
	// From this width the apps move into a left column (keep in step with the SCSS).
	const WIDE_LAYOUT = "80rem";
	const CUE_GROUPS_SHOWN = 3; // module groups open at first; the rest behind "Show more"
	// Documents ERPNext makes itself from another document; nobody starts one from a Create button.
	const MADE_BY_SYSTEM = new Set(["Serial and Batch Bundle", "Stock Ledger Entry", "GL Entry", "Repost Item Valuation", "Bin"]);
	// KPI cards where more is worse (work waiting, late, owed): their change is coloured the other way.
	const INVERSE_KPI = /overdue|late|pending|outstanding|unpaid|to deliver|to bill|to receive|open issues|open quality|backlog|expense|defect|reject/i;
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
			this.keep_fresh();
			this.fit_site_banners();
		}

		// Frappe puts site banners (impersonation, read-only) above the page, in the same scroll
		// column. The desktop home is exactly the window's height, so without this the page
		// scrolled by the banner's height. The CSS subtracts --trevo-banners from that height.
		fit_site_banners() {
			const fit = () => {
				const px = $(".site-banners").outerHeight() || 0;
				const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
				this.$root[0].style.setProperty("--trevo-banners", `${px / root}rem`);
			};
			fit();
			$(window).on("resize", frappe.utils.debounce(fit, 200));
		}

		// Work waiting changes during the day (someone submits a PO for approval, an invoice
		// falls overdue). Re-read it every few minutes while the home is open and visible, and
		// when the user comes back to the tab, without redrawing the KPIs and modules.
		keep_fresh() {
			const stale = () =>
				frappe.get_route_str() === "trevo-home" &&
				document.visibilityState === "visible" &&
				this.$aside?.[0]?.isConnected &&
				Date.now() - (this.attention_at || 0) > ATTENTION_REFRESH_MS / 5;
			document.addEventListener("visibilitychange", () => stale() && this.refresh_attention());
			setInterval(() => stale() && Date.now() - this.attention_at >= ATTENTION_REFRESH_MS && this.refresh_attention(), 30 * 1000);
		}

		refresh_attention() {
			this.attention_at = Date.now();
			frappe.xcall("trevo_whitelabel.desk.home.get_attention").then((data) => {
				if (!data || !this.$aside?.[0]?.isConnected) return;
				Object.assign(this.data, data);
				this.$aside.find(".trevo-attention, .trevo-events").remove();
				// Same order as the first draw: attention, then coming up, then Recent.
				const $events = this.render_events(this.$aside, data.events || []);
				if ($events) $events.prependTo(this.$aside);
				this.render_attention(this.$aside, data.approvals, data.assigned, data.cues).prependTo(this.$aside);
				this.set_headline(this.data);
			});
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
			this._rank = null;
			// Three regions. On a desktop each scrolls on its own inside the window (the greeting
			// stays on top), so the end of every column can be reached:
			//   left   apps and modules (navigation)  — wide screens only, see place_apps()
			//   centre the numbers (At a glance)
			//   right  work waiting, coming up, recent
			const $layout = $(`<div class="trevo-home__layout">
				<nav class="trevo-home__nav" aria-label="${esc(__("Apps"))}"></nav>
				<div class="trevo-home__main"></div>
				<aside class="trevo-home__aside"></aside>
			</div>`).appendTo(this.$home);
			const $main = $layout.find(".trevo-home__main");
			const $aside = $layout.find(".trevo-home__aside");
			const $apps = $(`<div class="trevo-home__apps"></div>`);
			// Kept for the periodic refresh of the work queue (refresh_attention).
			this.data = data;
			this.$aside = $aside;
			this.attention_at = Date.now();

			this.set_headline(data);
			this.render_attention($aside, data.approvals, data.assigned, data.cues);
			this.render_events($aside, data.events || []);
			// The numbers lead; Create follows them.
			// Create sits beside the greeting and follows the selected KPI tab (Stock → Stock
			// documents); without KPIs it shows the general list.
			const has_create = this.render_create(null);
			const $kpis = $(`<section class="trevo-home__kpis"></section>`).appendTo($main);
			const has_kpis = this.render_kpis($kpis, data.kpis || []);
			const has_modules = this.render_modules($apps, this.module_filter(data));
			const has_custom = this.render_custom($apps, custom);
			// The framework's System group stays last, after the site's own modules.
			$apps.find(".trevo-home__group--secondary").appendTo($apps);
			this.render_recent(this.make_recent_section($aside), data.recent || []);
			this.place_apps($layout, $apps);

			// No module of their own yet (a new hire whose roles are still to come): say so in the
			// centre, with what every desk user can already use. Create (ToDo, Event) doesn't count.
			if (!has_kpis && !has_modules && !has_custom) {
				this.render_no_access().prependTo($main);
			}
		}

		// Apps and modules go in the left column on wide screens and below the numbers
		// otherwise; moved (not redrawn) when the window crosses the breakpoint.
		place_apps($layout, $apps) {
			const wide = window.matchMedia(`(min-width: ${WIDE_LAYOUT})`);
			const place = () => {
				if (!$layout[0].isConnected) return wide.removeEventListener("change", place);
				const three = wide.matches && $apps.children().length > 0;
				$apps.appendTo(three ? $layout.find(".trevo-home__nav") : $layout.find(".trevo-home__main"));
				// Three columns: Recent sits under the numbers in the centre, so the right column
				// is only what needs action; two columns: it closes the right column.
				$layout.find(".trevo-home__recent").appendTo(three ? $layout.find(".trevo-home__main") : $layout.find(".trevo-home__aside"));
				$layout.toggleClass("has-nav", three);
			};
			this.apps_media && this.apps_media.mq.removeEventListener("change", this.apps_media.fn);
			this.apps_media = { mq: wide, fn: place };
			wide.addEventListener("change", place);
			place();
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
				return $section;
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
			if (cues.items.length) this.render_cues($grid, cues);
			if (assigned.total) {
				const $card = this.attention_card($grid, "user-check", __("Assigned to you"), assigned.total);
				assigned.items.forEach((item) => this.assigned_row(item).appendTo($card.find(".trevo-attention__list")));
				this.more_note($card, assigned.total - assigned.items.length, "/desk/todo?status=Open");
			}
			return $section;
		}

		// ── In your modules ──
		// Work waiting in the modules the user's roles cover, one group per module (Accounts,
		// Selling, Stock, ...), found from ERPNext document statuses rather than a workflow
		// (desk/home.py: get_cues). Groups follow the same order as the KPI tabs, and selecting
		// a tab brings that module's group to the top. A short explanation sits in the card.
		render_cues($grid, cues) {
			const groups = {};
			cues.items.forEach((cue) => (groups[cue.module] = groups[cue.module] || []).push(cue));
			const order = Object.keys(groups)
				.filter((m) => m !== "_drafts")
				.sort((a, b) => this.module_rank(a) - this.module_rank(b));
			if (groups._drafts) order.push("_drafts");

			const areas = cues.modules
				? cues.modules.map((m) => this.module_label(m)).join(", ")
				: __("every module you can open");
			const $card = $(`<div class="trevo-attention__card trevo-cues-card">
				<div class="trevo-attention__head">
					<span class="trevo-attention__icon">${icon("list-checks", "sm")}</span>
					<span class="trevo-attention__title">${esc(__("In your modules"))}</span>
					<button type="button" class="btn-reset trevo-cues__help-btn" aria-expanded="false"
						aria-label="${esc(__("How this works"))}" title="${esc(__("How this works"))}">${icon("info", "sm")}</button>
				</div>
				<p class="trevo-cues__summary">${esc(__("Documents that need action in {0}, from their ERPNext status.", [areas]))}</p>
				<div class="trevo-cues__help hidden">
					<p>${esc(__("Each line counts documents whose status says something is waiting: overdue, late, due this week, or delivered but not yet invoiced. It doesn't depend on approval workflows, so every role sees its own work."))}</p>
					<ul>
						<li>${esc(__("Modules come from your roles (a Stock User sees Stock) and from what you use most."))}</li>
						<li>${__("{0} lines count only documents you created or are assigned to; the others count your team's.", [`<span class="trevo-cue__scope">${esc(__("Yours"))}</span>`])}</li>
						<li>${esc(__("Counts follow your permissions. Click a line to open exactly those documents."))}</li>
						<li>${esc(__("Picking a module under At a glance moves its group to the top."))}</li>
						<li>${esc(__("Administrators can add lines from any Number Card in Trevo Settings > Home."))}</li>
					</ul>
				</div>
				<div class="trevo-cues"></div>
			</div>`).appendTo($grid);
			$card.find(".trevo-cues__help-btn").on("click", (e) => {
				const open = $card.find(".trevo-cues__help").toggleClass("hidden").is(":visible");
				e.currentTarget.setAttribute("aria-expanded", String(open));
			});

			const $list = $card.find(".trevo-cues");
			order.forEach((module) => {
				const label = module === "_drafts" ? __("Your drafts") : this.module_label(module);
				const $group = $(`<div class="trevo-cues__group" data-module="${esc(module)}">
					<div class="trevo-cues__group-head">${esc(label)}</div>
				</div>`).appendTo($list);
				groups[module].forEach((cue) => this.cue_row(cue, cues.currency, module === "_drafts").appendTo($group));
			});
			this.$cues = $list;
			const extra = order.length - CUE_GROUPS_SHOWN;
			if (extra > 0) {
				$(`<button type="button" class="btn-reset trevo-cues__more"></button>`)
					.on("click", () => {
						this.cues_expanded = !this.cues_expanded;
						this.collapse_cue_groups();
					})
					.appendTo($card);
			}
			this.collapse_cue_groups();
			if (this.kpi_selected) this.focus_cue_group(this.kpi_selected, false);
		}

		collapse_cue_groups() {
			if (!this.$cues) return;
			const $groups = this.$cues.children(".trevo-cues__group");
			// Block body: a jQuery .each callback that returns false stops the loop.
			$groups.each((i, el) => {
				el.classList.toggle("hidden", !this.cues_expanded && i >= CUE_GROUPS_SHOWN);
			});
			const hidden = Math.max(0, $groups.length - CUE_GROUPS_SHOWN);
			this.$cues
				.siblings(".trevo-cues__more")
				.text(this.cues_expanded ? __("Show fewer modules") : __("Show {0} more modules", [hidden]));
		}

		// Selecting a KPI tab: that module's group first and marked, so the numbers and the
		// work waiting in the module read together.
		focus_cue_group(module, flash = true) {
			if (!this.$cues) return;
			this.$cues.children(".trevo-cues__group").removeClass("is-active");
			const $group = this.$cues.children(`.trevo-cues__group[data-module="${CSS.escape(module)}"]`);
			if (!$group.length) return this.collapse_cue_groups();
			$group.prependTo(this.$cues).addClass("is-active");
			this.collapse_cue_groups();
			if (flash) {
				$group.removeClass("is-flash");
				void $group[0].offsetWidth;
				$group.addClass("is-flash");
			}
		}

		// One cue: "Overdue customer invoices · ₨ 31.51 L ……… 44". Opens the list with the
		// same filters the count used (applied by the list view from route_options).
		cue_row(cue, currency, is_draft) {
			const count = cue.more ? `${cue.count}+` : String(cue.count);
			const amount = cue.amount ? this.short_amount(cue.amount, currency) : "";
			const scope = !is_draft && cue.scope === "yours" ? `<span class="trevo-cue__scope">${esc(__("Yours"))}</span>` : "";
			const meta = [amount ? esc(amount) : "", scope].filter(Boolean).join(" ");
			return $(`<button type="button" class="trevo-cue is-${esc(cue.tone)}">
				<span class="trevo-cue__icon">${icon(cue.icon || "circle-dot", "sm")}</span>
				<span class="trevo-cue__text">
					<span class="trevo-cue__label">${esc(cue.label)}</span>
					${meta ? `<span class="trevo-cue__amount">${meta}</span>` : ""}
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
			if (!events.length) return null;
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
			return $section;
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
				<div class="trevo-home__notice-links"></div>
			</section>`);
			// Lists every desk user has, whatever their roles.
			const links = [
				["List", "ToDo", "list-todo", __("My to-dos")],
				["List", "Event", "calendar", __("Calendar"), "/desk/event/view/calendar"],
				["List", "Note", "notebook-pen", __("Notes")],
			]
				.filter(([, doctype]) => frappe.model.can_read(doctype))
				.map(([, doctype, ic, label, href]) => [href || `/desk/${frappe.router.slug(doctype)}`, ic, label]);
			links.push([`/desk/user/${encodeURIComponent(frappe.session.user)}`, "user", __("My Profile")]);
			const $links = $notice.find(".trevo-home__notice-links");
			links.forEach(([href, ic, label]) => {
				$(`<a class="trevo-chip" href="${esc(href)}">${icon(ic, "xs")}<span>${esc(label)}</span></a>`).appendTo($links);
			});
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
				.filter((dt, i, all) => dt && all.indexOf(dt) === i && can.has(dt) && !singles.has(dt) && !MADE_BY_SYSTEM.has(dt))
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

		// Module order shared by the KPI tabs and the cue groups: most used first (the user's
		// own edits and visits), then the modules their roles name, then dock order.
		module_rank(module) {
			if (!this._rank) {
				const order = this.dock_modules();
				const own = this.role_modules();
				const use = this.usage?.modules || {};
				this._rank = (m) =>
					-(use[m] || 0) * 10000 + (own.has(m) ? 0 : 1000) + (order.includes(m) ? order.indexOf(m) : order.length);
			}
			return this._rank(module);
		}

		render_kpis($section, groups) {
			if (!groups.length || !frappe.widget?.make_widget) {
				$section.remove();
				return false;
			}
			groups = groups.slice().sort((a, b) => this.module_rank(a.module) - this.module_rank(b.module));

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
			// A soft edge on the side of the tab strip that has more tabs out of view.
			const update_fade = () => {
				const el = $tabs.get(0);
				if (!el) return;
				const max = el.scrollWidth - el.clientWidth;
				el.classList.toggle("fade-start", el.scrollLeft > 2);
				el.classList.toggle("fade-end", max > 2 && el.scrollLeft < max - 2);
			};
			$tabs.on("scroll", frappe.utils.throttle(update_fade, 50));
			$(window).off("resize.trevo-tabs").on("resize.trevo-tabs", frappe.utils.debounce(update_fade, 150));

			let first = true;
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
				this.kpi_selected = module;
				// Keep the chosen tab in view when the strip scrolls sideways (horizontal only,
				// so the page or pane never jumps).
				const strip = $tabs.get(0);
				const tab = $tabs.find(".trevo-tab.active").get(0);
				if (strip && tab && strip.scrollWidth > strip.clientWidth) {
					const left = tab.offsetLeft - strip.offsetLeft;
					if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
						strip.scrollLeft = left - (strip.clientWidth - tab.offsetWidth) / 2;
					}
				}
				update_fade();
				this.render_create(module);
				this.focus_cue_group(module, !first);
				first = false;
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
				// Frappe colours a rise green and a fall red. For work piling up ("Overdue Issues",
				// "Orders to Deliver", "Pending ...") a rise is bad news, so those cards swap the
				// colours (CSS on .is-inverse); the numbers and arrows stay Frappe's.
				const inverse = INVERSE_KPI.test(`${card.label} ${card.name}`);
				frappe.widget.make_widget({
					widget_type: "number_card",
					container: $(`<div class="trevo-kpi${inverse ? " is-inverse" : ""}"></div>`).appendTo($grid),
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

			if (!group.cards.length && !group.chart) {
				$grid.replaceWith(`<p class="trevo-home__kpi-empty">${esc(
					__("{0} has no numbers for you yet. Its lists and reports are below.", [label])
				)}</p>`);
			}

			// Quick links: the way on from the numbers, so the panel never ends in a dead end.
			const links = this.quick_links(group);
			if (links.length) {
				const $links = $(`<nav class="trevo-quicklinks" aria-label="${esc(__("{0} shortcuts", [label]))}"></nav>`).appendTo($panel);
				links.forEach((l) => {
					const chip = l.count
						? `<span class="trevo-quicklink__count is-${esc(l.tone || "info")}" title="${esc(l.count_title)}">${esc(String(l.count))}</span>`
						: "";
					$(`<a class="trevo-quicklink${l.primary ? " is-primary" : ""}" href="${esc(l.href)}">
						<span class="trevo-quicklink__icon">${icon(l.icon || "file-text", "sm")}</span>
						<span class="trevo-quicklink__text">
							<span class="trevo-quicklink__label">${esc(l.label)}</span>
							<span class="trevo-quicklink__sub">${esc(l.sub)}</span>
						</span>
						${chip}
					</a>`).appendTo($links);
				});
			}
			return $panel;
		}

		// The module's entry points (workspace, full dashboard, Insights), then the lists and
		// reports of its sidebar this user may open, most used first. A list that has waiting
		// work in the cues carries its count.
		quick_links(group, limit = 8) {
			const out = [];
			if (group.workspace) {
				out.push({
					href: `/desk/${frappe.router.slug(group.workspace)}`,
					// Setup's workspace is called "Home"; "Open Home" on the home page reads oddly.
					label: __("Open {0}", [group.workspace === "Home" ? this.module_label(group.module) : __(group.workspace)]),
					sub: __("Workspace"),
					icon: "layout-grid",
					primary: true,
				});
			}
			if (group.dashboard) {
				out.push({
					href: `/desk/dashboard-view/${encodeURIComponent(group.dashboard)}`,
					label: __("Full dashboard"),
					sub: __("Every card and chart"),
					icon: "chart-column",
					primary: true,
				});
			}
			if (group.insights) {
				out.push({ href: "/insights", label: __("Insights"), sub: __("Analyse"), icon: "chart-pie", primary: true });
			}

			const can_read = new Set(frappe.boot.user.can_read || []);
			const reports = frappe.boot.user.all_reports || {};
			const used = this.usage?.doctypes || {};
			const cues = this.data?.cues?.items || [];
			const seen = new Set();
			const items = Object.values(frappe.boot.module_sidebars || {})
				.filter((bar) => bar.module === group.module)
				.flatMap((bar) => bar.items || [])
				.filter((it) => it.type === "Link" && ["DocType", "Report"].includes(it.link_type) && it.link_to);

			const rows = [];
			items.forEach((it, i) => {
				const key = `${it.link_type}|${it.link_to}`;
				if (seen.has(key)) return;
				seen.add(key);
				let href, sub, weight;
				if (it.link_type === "DocType") {
					if (!can_read.has(it.link_to) || MADE_BY_SYSTEM.has(it.link_to)) return;
					let opts = it.route_options;
					try {
						opts = typeof opts === "string" ? JSON.parse(opts) : opts;
					} catch (e) {
						opts = null;
					}
					href = frappe.utils.generate_route({ type: "doctype", name: it.link_to, route_options: opts || undefined });
					sub = __("List");
					weight = used[it.link_to] || 0;
				} else {
					const r = reports[it.link_to];
					// The report must be in the user's report list and its source DocType readable
					// for reports, else Frappe answers with "You don't have permission to get a report on".
					if (!r || (r.ref_doctype && !frappe.model.can_get_report(r.ref_doctype))) return;
					href = frappe.utils.generate_route({
						type: "report",
						name: it.link_to,
						is_query_report: r.report_type !== "Report Builder",
						report_ref_doctype: r.ref_doctype,
					});
					sub = __("Report");
					weight = (used[r.ref_doctype] || 0) / 2;
				}
				const cue = it.link_type === "DocType" && cues.find((c) => c.doctype === it.link_to && c.count);
				rows.push({
					href,
					sub,
					label: __(it.label || it.link_to),
					icon: it.icon || (it.link_type === "Report" ? "file-chart-column" : "file-text"),
					count: cue ? cue.count : 0,
					tone: cue?.tone,
					count_title: cue ? __(cue.label) : "",
					// Lists with waiting work first, then most used, then sidebar order.
					rank: (cue ? -1e6 : 0) - weight * 100 + i,
				});
			});
			// A list with work waiting that the module's sidebar doesn't carry (Delivery Trip is
			// not in ERPNext's Stock sidebar) still gets its box: it is where the driver works.
			cues.filter((c) => c.module === group.module && c.count && can_read.has(c.doctype)).forEach((c) => {
				const key = `DocType|${c.doctype}`;
				if (seen.has(key)) return;
				seen.add(key);
				rows.push({
					href: frappe.utils.generate_route({ type: "doctype", name: c.doctype }),
					sub: __("List"),
					label: __(c.doctype),
					icon: c.icon || "file-text",
					count: c.count,
					tone: c.tone,
					count_title: __(c.label),
					rank: -1e6,
				});
			});
			rows.sort((a, b) => a.rank - b.rank);
			return out.concat(rows.slice(0, Math.max(limit - out.length, 4)));
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
			// DocTypes every desk user reads (lookups, the framework's admin lists) don't make
			// a module theirs: a new hire got Build, Data, Users and Website tiles from them.
			const base = new Set(data.base_only || []);
			const can_read = new Set((frappe.boot.user.can_read || []).filter((d) => !base.has(d)));
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
		// ERPNext's standard dock hides some modules (Support ships `hidden: 1`), so a support
		// agent got no Support tile although Support is their work. A module the user works in
		// (their cue modules, from their roles) gets its sidebar as a tile when the dock omits it.
		app_entries(app) {
			const sidebar = frappe.app.sidebar;
			const bars = Object.values(frappe.boot.module_sidebars || {}).filter(
				(bar) => bar.app === app.app_name && (bar.items || []).length
			);
			const as_entry = (bar) => sidebar.dock_entry({ link_type: "Sidebar", link_to: bar.name });
			if (!app.on_apps_screen) return bars.map(as_entry).filter(Boolean);

			const entries = sidebar.collect_dock_entries(app);
			const work = new Set(this.data?.cues?.modules || []);
			if (!work.size) return entries;
			const covered = new Set(entries.flatMap((e) => [e.link_to, e.label, e.module]));
			const extra = bars
				.filter((bar) => work.has(bar.module) && !covered.has(bar.name) && !covered.has(bar.module))
				.map(as_entry)
				.filter(Boolean);
			return entries.concat(extra);
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
