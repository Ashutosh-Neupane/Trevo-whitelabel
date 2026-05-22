// section_live.js — Trevo live-form section renderer
// Replaces frappe/frappe/public/js/frappe/form/section.js
// No ES module syntax. Frappe loads this as a plain script.

frappe.ui.form.Section = class Section {
	constructor(parent, df, card_layout, layout) {
		this.layout = layout;
		this.card_layout = card_layout;
		this.parent = parent;
		this.df = df || {};
		this.columns = [];
		this.fields_list = [];
		this.fields_dict = {};

		this.make();

		if (
			this.df.label &&
			this.df.collapsible &&
			localStorage.getItem(this.df.css_class + "-closed")
		) {
			this.collapse();
		}

		// row.wrapper is used by layout.js
		this.row = { wrapper: this.wrapper };

		this.refresh();
	}

	make() {
		this.wrapper = $(
			`<div class="${this.df.is_dashboard_section ? "form-dashboard-section" : "form-section tv-section-card"}${this.card_layout ? " card-section" : ""}" data-fieldname="${this.df.fieldname || ""}"></div>`
		).appendTo(this.parent);

		if (this.df.label && !this.df.hide_label) {
			this.make_head();
		}

		if (this.df.description) {
			this.wrapper.append(
				`<div class="col-sm-12 form-section-description">${__(this.df.description)}</div>`
			);
		}

		if (this.df.css_class) {
			this.wrapper.addClass(this.df.css_class);
		}

		if (this.df.hide_border) {
			this.wrapper.toggleClass("hide-border", true);
		}

		// body is what Column appends into — must be named .body
		this.body = $('<div class="section-body tv-section-body">').appendTo(this.wrapper);

		if (this.df.body_html) {
			this.body.append(this.df.body_html);
		}
	}

	make_head() {
		this.head = $(`
			<div class="section-head tv-section-head">
				<span class="tv-section-head-label tv-section-title">${__(this.df.label, null, this.df.parent)}</span>
				<span class="collapse-indicator tv-collapse-indicator"></span>
			</div>
		`).appendTo(this.wrapper);

		this.indicator = this.head.find(".collapse-indicator");
		this.indicator.hide();

		if (this.df.collapsible) {
			this.head.addClass("collapsible");
			this.head.on("click", () => this.collapse());
			this.head.enterKey && this.head.enterKey(() => this.collapse());
			this.set_icon();
			this.indicator.show();
			this.head.attr("tabindex", 0);
		}
	}

	set_icon() {
		const icon = this.is_collapsed()
			? frappe.utils.icon("es-line-right", "sm")
			: frappe.utils.icon("es-line-down", "sm");
		this.indicator && this.indicator.html(icon);
	}

	collapse(hide) {
		if (hide === undefined) {
			hide = !this.is_collapsed();
		}
		this.body.toggleClass("hide", hide);
		this.head && this.head.toggleClass("collapsed", hide);
		this.set_icon();

		if (this.df.css_class) {
			hide
				? localStorage.setItem(this.df.css_class + "-closed", true)
				: localStorage.removeItem(this.df.css_class + "-closed");
		}
	}

	is_collapsed() {
		return this.body.hasClass("hide");
	}

	replace_field(fieldname, fieldobj) {
		if (this.fields_dict[fieldname]?.df) {
			const old = this.fields_dict[fieldname];
			const idx = this.fields_list.findIndex((e) => e === old);
			this.fields_list.splice(idx, 1, fieldobj);
			this.fields_dict[fieldname] = fieldobj;
			fieldobj.section = this;
		}
	}

	refresh(hide) {
		if (!this.df) return;
		hide = hide || this.df.hidden || this.df.hidden_due_to_dependency;
		this.wrapper.toggleClass("hide-control", !!hide);
	}

	add_field(fieldobj) {
		this.fields_list.push(fieldobj);
		this.fields_dict[fieldobj.df.fieldname] = fieldobj;
		fieldobj.section = this;
	}

	has_missing_mandatory() {
		let missing = false;
		for (let j = 0; j < this.fields_list.length; j++) {
			const df = this.fields_list[j].df;
			if (df.reqd && this.layout && this.layout.doc && this.layout.doc[df.fieldname] == null) {
				missing = true;
				break;
			}
		}
		return missing;
	}

	hide() { this.on_section_toggle(false); }
	show() { this.on_section_toggle(true); }
	on_section_toggle(show) {
		this.wrapper.toggleClass("hide-control", !show);
	}
};
