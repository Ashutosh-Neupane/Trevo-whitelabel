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
		let columns = this.section.columns || [];
		if (!columns.length) return;

		let total_colspan = 0;
		let auto_colspan_count = 0;

		columns.forEach(c => {
			if (c.df && c.df.columns) {
				total_colspan += cint(c.df.columns);
			} else {
				auto_colspan_count++;
			}
		});

		let remaining_colspan = 12 - total_colspan;
		let auto_colspan = auto_colspan_count ? Math.max(1, Math.floor(remaining_colspan / auto_colspan_count)) : 1;

		columns.forEach(c => {
			let colspan = (c.df && c.df.columns) ? cint(c.df.columns) : auto_colspan;
			if (c.wrapper) {
				c.wrapper
					.removeClass((index, className) => {
						return (className.match(/(^|\s)col-sm-\S+/g) || []).join(" ");
					})
					.addClass("col-sm-" + colspan);
			}
		});
	}

	add_field() { }

	refresh() {
		this.section.refresh();
	}
};
