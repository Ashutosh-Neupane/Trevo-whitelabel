// Trevo desk behaviours. Kept small on purpose: it listens to Frappe's own events and
// uses the public Page API; it never rewrites Frappe's markup.
//
// 1. Form side panel (image, assign, attachments, tags, share) is closed by default.
//    A button in the form header opens/closes it; the choice is remembered per DocType.
//    Site default: Trevo Settings > "Open the form side panel by default".
//    Opened documents are remembered in localStorage for "Recent" on the Trevo home.
// 2. DocTypes with an image field show that image next to the form title.
// 3. Charts use Trevo's palette instead of Frappe's blue-first default.
// 4. Scroll state classes so sticky headers can show elevation once content passes under them.
// 5. Browser-tab titles end in "· Trevo".
// 7. Install identity: manifest, touch icon and theme-color.
// 8. "Not found" / "not permitted" pages keep the sidebar and offer Back and Home; refused
//    desk routes and reports show that page instead of a stale or blank screen.

(function () {
	const KEY = (doctype) => `trevo:form-side:${doctype}`;

	function is_open(doctype) {
		let saved = null;
		try {
			saved = localStorage.getItem(KEY(doctype));
		} catch (e) {
			// storage blocked: fall back to the site default
		}
		if (saved !== null) return saved === "1";
		return Boolean(frappe.boot.trevo && frappe.boot.trevo.show_form_sidebar);
	}

	function apply(frm) {
		const open = is_open(frm.doctype);
		$(frm.page.wrapper).toggleClass("trevo-side-closed", !open);
		if (frm.page.trevo_side_btn) {
			frm.page.trevo_side_btn
				.attr("aria-pressed", String(open))
				.toggleClass("trevo-side-btn--on", open);
		}
	}

	function setup_toggle(frm) {
		if (frm.page.trevo_side_btn || !frappe.boot.desk_settings.form_sidebar) return;
		const label = __("Side panel");
		frm.page.add_action_icon(
			"columns-2",
			() => {
				const next = !is_open(frm.doctype);
				try {
					localStorage.setItem(KEY(frm.doctype), next ? "1" : "0");
				} catch (e) {
					// ignore
				}
				apply(frm);
			},
			"trevo-side-btn",
			label
		);
		frm.page.trevo_side_btn = $(frm.page.wrapper).find(".trevo-side-btn").attr("aria-label", label);
	}

	function setup_title_image(frm) {
		const $title = frm.page.$title_area;
		if (!$title) return;
		$title.find(".trevo-title-image").remove();
		const field = frm.meta.image_field;
		if (!field || frm.is_new()) return;

		const src = frm.doc[field];
		const $el = $('<span class="trevo-title-image" aria-hidden="true"></span>');
		if (src) {
			$("<img>").attr({ src: src, alt: "" }).appendTo($el);
		} else {
			$el.text((frm.get_title() || frm.docname || "?").trim().charAt(0).toUpperCase());
		}
		$title.prepend($el);
	}

	// Documents opened, for "Recent" on the Trevo home. Frappe keeps no server record of form
	// visits (Route History skips forms), so remember the last few in this browser, per user.
	// Only doctype, name and time; the home re-checks each against permissions on the server.
	const OPENED_KEY = () => `trevo:opened:${frappe.session.user}`;
	const OPENED_MAX = 30;
	function record_opened(frm) {
		if (frm.is_new()) return;
		try {
			const list = JSON.parse(localStorage.getItem(OPENED_KEY()) || "[]").filter(
				(row) => !(row.doctype === frm.doctype && row.name === frm.docname)
			);
			list.unshift({ doctype: frm.doctype, name: frm.docname, when: frappe.datetime.now_datetime() });
			localStorage.setItem(OPENED_KEY(), JSON.stringify(list.slice(0, OPENED_MAX)));
		} catch (e) {
			// storage blocked or full: Recent simply shows edits and lists
		}
	}
	frappe.provide("trevo");
	trevo.get_opened = function () {
		try {
			return JSON.parse(localStorage.getItem(OPENED_KEY()) || "[]");
		} catch (e) {
			return [];
		}
	};

	$(document).on("form-refresh", function (_e, frm) {
		if (!frm || !frm.page || frm.meta.istable) return;
		setup_toggle(frm);
		apply(frm);
		setup_title_image(frm);
		record_opened(frm);
	});

	// 4. Scroll state for sticky headers. v16 scrolls .main-section (forms, workspaces,
	//    reports) and .result-container (list results), not the document. Frappe's sticky page
	//    head, form tabs and list header never know they are "stuck", so on a white page they
	//    look like the content under them. Mark state with classes only; CSS draws elevation:
	//    - body.trevo-scrolled             the page scroller (.main-section) or document moved
	//    - .trevo-scrolled on the scroller  any inner scroller moved (e.g. list results)
	const PAGE_SCROLLER = ".main-section";
	let ticking = false;
	function page_scrolled() {
		const main = document.querySelector(PAGE_SCROLLER);
		return window.scrollY > 4 || Boolean(main && main.scrollTop > 4);
	}
	function mark_scroll(target) {
		ticking = false;
		document.body.classList.toggle("trevo-scrolled", page_scrolled());
		if (target && target.classList && target !== document.documentElement) {
			target.classList.toggle("trevo-scrolled", target.scrollTop > 4);
		}
	}
	document.addEventListener(
		"scroll",
		(e) => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => mark_scroll(e.target));
		},
		{ capture: true, passive: true }
	);
	$(document).on("page-change", () =>
		requestAnimationFrame(() => {
			mark_scroll();
			document.querySelectorAll(".result-container.trevo-scrolled").forEach((el) => {
				el.classList.toggle("trevo-scrolled", el.scrollTop > 4);
			});
		})
	);

	// 5. Brand in the browser tab: "Sales Order · Trevo". Frappe's set_title only supports a
	//    prefix (used for the unread count), so append the brand after it runs.
	const BRAND = (frappe.boot.trevo && frappe.boot.trevo.brand_name) || "Trevo";
	const frappe_set_title = frappe.utils && frappe.utils.set_title;
	if (frappe_set_title) {
		frappe.utils.set_title = function (title) {
			frappe_set_title.apply(this, arguments);
			const suffix = ` · ${BRAND}`;
			if (document.title && !document.title.endsWith(suffix)) {
				document.title += suffix;
			}
		};
	}

	// 6. The desk home is its own Page (trevo_whitelabel/page/trevo_home), set as the
	//    "desktop:home_page" default. Frappe's apps screen (/desk/desktop) is left as Frappe
	//    renders it; the theme only styles its tiles.

	// 7. Install / home-screen identity. desk.html ships Frappe's blue theme-color (#0089FF) and
	//    no manifest or touch icon, so "Add to Home Screen" showed a screenshot icon and a blue
	//    browser bar. Add Trevo's manifest and icons, and keep theme-color on the page surface
	//    in both themes. Browsers read these when the user installs, after this has run.
	const ASSETS = "/assets/trevo_whitelabel";
	function head_tag(selector, tag, attrs) {
		let el = document.head.querySelector(selector);
		if (!el) {
			el = document.createElement(tag);
			document.head.appendChild(el);
		}
		Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
	}
	head_tag('link[rel="manifest"]', "link", { rel: "manifest", href: `${ASSETS}/manifest.json` });
	head_tag('link[rel="apple-touch-icon"]', "link", {
		rel: "apple-touch-icon",
		href: `${ASSETS}/images/apple-touch-icon.png`,
	});
	head_tag('meta[name="apple-mobile-web-app-title"]', "meta", {
		name: "apple-mobile-web-app-title",
		content: BRAND,
	});
	function sync_theme_color() {
		const surface = getComputedStyle(document.documentElement)
			.getPropertyValue("--trevo-surface")
			.trim();
		if (surface) head_tag('meta[name="theme-color"]', "meta", { name: "theme-color", content: surface });
	}
	sync_theme_color();
	new MutationObserver(sync_theme_color).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});

	// 8. "Not found" and "not permitted" pages.
	//    - Frappe's message page is bare markup, not a frappe.ui.Page, so the sidebar (which only
	//      shows for a page that allows it) disappears and the user is left with one "Home" link.
	//      Build the same message inside a real page frame, with Back and Home.
	//    - Two failures never reach that page at all: an unknown desk route (desk_page.getpage
	//      404) leaves a blank screen with no sidebar behind a "Not found" dialog; a report the
	//      role may not open (query_report.get_script 403) leaves an empty report titled
	//      "undefined". Show the message page for those, with the server's reason as detail,
	//      instead of the dialog.
	//    Reads only; permissions are untouched.
	const frappe_not_found = frappe.show_not_found;
	const frappe_not_permitted = frappe.show_not_permitted;

	function message_page(kind, page_name, detail) {
		const denied = kind === "denied";
		if (!frappe.ui.make_app_page || !frappe.container) {
			return (denied ? frappe_not_permitted : frappe_not_found)(page_name);
		}
		page_name = page_name || frappe.get_route_str();
		const wrapper = frappe.pages[page_name] || frappe.container.add_page(page_name);
		$(wrapper).empty();
		delete wrapper.page;

		const title = denied ? __("You don't have access to this page") : __("Page not found");
		const page = frappe.ui.make_app_page({ parent: wrapper, title: title, single_column: true });
		const $card = $(`<div class="trevo-message" role="status">
				<span class="trevo-message__icon" aria-hidden="true">${frappe.utils.icon(denied ? "lock" : "search", "md")}</span>
				<h2 class="trevo-message__title"></h2>
				<p class="trevo-message__text"></p>
				<div class="trevo-message__actions"></div>
			</div>`).appendTo(page.main);
		$card.find(".trevo-message__title").text(title);
		$card
			.find(".trevo-message__text")
			.text(
				denied
					? __("Your role doesn't include it. Ask your administrator if you need it.")
					: __("The link may be old, or the page was renamed or removed.")
			);
		if (detail) $('<p class="trevo-message__detail"></p>').text(detail).insertAfter($card.find(".trevo-message__text"));

		const $actions = $card.find(".trevo-message__actions");
		if (window.history.length > 1) {
			$(`<button type="button" class="btn btn-default btn-sm">${__("Go back")}</button>`)
				.on("click", () => window.history.back())
				.appendTo($actions);
		}
		$(`<a class="btn btn-primary btn-sm" href="/desk">${__("Home")}</a>`).appendTo($actions);

		frappe.container.change_to(page_name);
		frappe.utils.set_title(title);
	}
	if (frappe_not_found && frappe_not_permitted) {
		frappe.show_not_found = (page_name) => message_page("missing", page_name);
		frappe.show_not_permitted = (page_name) => message_page("denied", page_name);
	}

	function server_message(xhr) {
		const r = xhr.responseJSON || {};
		if (r._error_message) return $("<div>").html(r._error_message).text().trim();
		try {
			const messages = JSON.parse(r._server_messages || "[]");
			const first = messages.length ? JSON.parse(messages[0]) : {};
			return $("<div>").html(first.message || "").text().trim();
		} catch (e) {
			return "";
		}
	}
	// Which failures leave nothing on screen. A refused desk page (getpage 403) is left to Frappe:
	// its dialog sends the user back to the previous page when closed.
	const ROUTE_LOADERS = {
		"frappe.desk.desk_page.getpage": [404],
		"frappe.desk.query_report.get_script": [403, 404],
	};
	const loader_of = (settings) => Object.keys(ROUTE_LOADERS).find((m) => (settings.url || "").includes(m));
	const is_route_loader = (settings) => Boolean(loader_of(settings));

	// Close Frappe's error dialog for the same failure; the page now says it. A dialog that
	// re-routes on close (custom_onhide) is Frappe's own flow and stays.
	function dismiss_error_dialog() {
		const d = frappe.msg_dialog;
		if (!d || !d.$wrapper || d.custom_onhide) return;
		const modal = d.$wrapper.data("bs.modal");
		// Still fading in (display turns true only once shown): hide when it lands.
		if (modal && modal._isTransitioning) d.$wrapper.one("shown.bs.modal", () => d.hide());
		else if (d.display) d.hide();
	}
	// frappe.get_route() is null until the router has run (boot requests), so never join it raw.
	const route_now = () => (frappe.get_route && frappe.get_route() ? frappe.get_route_str() : null);
	const request_route = new WeakMap();
	$(document).ajaxSend((_e, xhr, settings) => {
		if (is_route_loader(settings)) request_route.set(xhr, route_now());
	});
	$(document).ajaxComplete((_e, xhr, settings) => {
		const loader = loader_of(settings);
		if (!loader || !ROUTE_LOADERS[loader].includes(xhr.status)) return;
		const route = request_route.get(xhr);
		if (!route || route !== route_now()) return; // user moved on
		// After Frappe's own handlers, which show the server message in a dialog.
		setTimeout(() => {
			if (route !== route_now()) return;
			dismiss_error_dialog();
			message_page(xhr.status === 404 ? "missing" : "denied", route, server_message(xhr));
		}, 0);
	});

	// 3. Chart colours. Frappe builds its default chart palette from --blue-600, --blue-400, ...
	//    (frappe.utils.get_chart_palette). Recolouring those tokens would also change every
	//    "info" blue, so read Trevo's own --trevo-chart-1..10 instead. Charts whose DocType
	//    record names explicit colours keep them; only the default palette changes.
	const TREVO_CHART_TOKENS = Array.from({ length: 10 }, (_, i) => `--trevo-chart-${i + 1}`);
	const frappe_palette = frappe.utils && frappe.utils.get_chart_palette;
	if (frappe_palette) {
		frappe.utils.get_chart_palette = function () {
			const style = getComputedStyle(document.documentElement);
			const trevo = TREVO_CHART_TOKENS.map((t) => style.getPropertyValue(t).trim());
			return trevo.every(Boolean) ? trevo : frappe_palette.apply(this, arguments);
		};
	}
})();
