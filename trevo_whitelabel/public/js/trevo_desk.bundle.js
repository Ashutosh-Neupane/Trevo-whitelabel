// Trevo desk behaviours. Kept small on purpose: it listens to Frappe's own events and
// uses the public Page API; it never rewrites Frappe's markup.
//
// 1. Form side panel (image, assign, attachments, tags, share) is closed by default.
//    A button in the form header opens/closes it; the choice is remembered per DocType.
//    Site default: Trevo Settings > "Open the form side panel by default".
// 2. DocTypes with an image field show that image next to the form title.
// 3. Charts use Trevo's palette instead of Frappe's blue-first default.
// 4. Scroll state classes so sticky headers can show elevation once content passes under them.

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

	$(document).on("form-refresh", function (_e, frm) {
		if (!frm || !frm.page || frm.meta.istable) return;
		setup_toggle(frm);
		apply(frm);
		setup_title_image(frm);
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

	// 6. Desk home (app launcher): a greeting above the app tiles. Added next to Frappe's grid;
	//    the grid itself is untouched.
	function greeting() {
		const hour = new Date().getHours();
		if (hour < 12) return __("Good morning");
		if (hour < 17) return __("Good afternoon");
		return __("Good evening");
	}
	function setup_desktop_greeting() {
		const $container = $(".desktop-container .icons-container").first();
		if (!$container.length || $container.find(".trevo-greeting").length) return;
		const name = frappe.boot.user && (frappe.boot.user.first_name || frappe.session.user_fullname);
		$(`<div class="trevo-greeting">
			<h1 class="trevo-display"></h1>
			<p></p>
		</div>`)
			.find("h1").text(name ? `${greeting()}, ${name}` : greeting()).end()
			.find("p").text(__("Choose an app to get started.")).end()
			.prependTo($container);
	}
	$(document).on("page-change", () => requestAnimationFrame(setup_desktop_greeting));
	$(() => setTimeout(setup_desktop_greeting, 300));

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
