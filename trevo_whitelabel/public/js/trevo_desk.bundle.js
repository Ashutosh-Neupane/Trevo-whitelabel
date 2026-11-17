// Trevo desk behaviours. Kept small on purpose: it listens to Frappe's own events and
// uses the public Page API; it never rewrites Frappe's markup.
//
// 1. Form side panel (image, assign, attachments, tags, share) is closed by default.
//    A button in the form header opens/closes it; the choice is remembered per DocType.
//    Site default: Trevo Settings > "Open the form side panel by default".
// 2. DocTypes with an image field show that image next to the form title.

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
})();
