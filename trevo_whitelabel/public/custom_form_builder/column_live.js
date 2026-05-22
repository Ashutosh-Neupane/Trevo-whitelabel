// column_live.js — Trevo live-form column renderer
// Replaces frappe/frappe/public/js/frappe/form/column.js
// No ES module syntax. Frappe loads this as a plain script.

frappe.ui.form.Column = class Column {
	constructor(section, df) {
		if (!df) df = {};
		this.df = df;
		this.section = section;
		this.section.columns.push(this);
		this.make();
		this.resize_all_columns();
	}

	make() {
		this.wrapper = $(`<div class="form-column tv-column-break" data-fieldname="${this.df.fieldname || ""}"></div>`)
			.appendTo(this.section.body);

		// form is what layout.js calls .get(0) on — must be a jQuery object
		this.form = $("<form></form>")
			.appendTo(this.wrapper)
			.on("submit", () => false);

		if (this.df.description) {
			$(`<p class="col-sm-12 form-column-description">${__(this.df.description, null, this.df.parent)}</p>`)
				.prependTo(this.wrapper);
		}

		if (this.df.label) {
			$(`<label class="column-label tv-column-label">${__(this.df.label, null, this.df.parent)}</label>`)
				.prependTo(this.wrapper);
		}
	}

	resize_all_columns() {
		let columns = this.section.wrapper.find(".form-column").length;
		let colspan = cint(12 / columns);
		if (columns === 5) colspan = 20;

		this.section.wrapper
			.find(".form-column")
			.removeClass()
			.addClass("form-column tv-column-break")
			.addClass("col-sm-" + colspan);
	}

	add_field() { }

	refresh() {
		this.section.refresh();
	}
};
