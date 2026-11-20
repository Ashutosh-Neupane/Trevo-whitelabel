// IRD chart sources (Trevo's dashboard for Trevo Compliance, integrations/trevo_compliance).
// Registered up front so the charts draw for users who may not read Dashboard Chart Source,
// which Frappe otherwise reads each source's config through. Unused on sites without the app.
frappe.provide("frappe.dashboards.chart_sources");

// Gross sales and output VAT per Nepali month of the fiscal year.
frappe.dashboards.chart_sources["IRD Sales by BS Month"] = {
	method: "trevo_whitelabel.integrations.trevo_compliance.dashboard.sales_by_bs_month",
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
		},
	],
};

// Output VAT, input VAT and net VAT per Nepali month (VAT Return Register boxes 5, 9, 12).
frappe.dashboards.chart_sources["IRD VAT by BS Month"] = {
	method: "trevo_whitelabel.integrations.trevo_compliance.dashboard.vat_by_bs_month",
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
		},
	],
};

// Submitted invoices of the fiscal year by CBMS status: sent, failed, not sent.
frappe.dashboards.chart_sources["IRD CBMS Status"] = {
	method: "trevo_whitelabel.integrations.trevo_compliance.dashboard.cbms_status",
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
		},
	],
};

// Taxable, exempt and export sales per Nepali month.
frappe.dashboards.chart_sources["IRD Sales Mix by BS Month"] = {
	method: "trevo_whitelabel.integrations.trevo_compliance.dashboard.sales_mix_by_bs_month",
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
		},
	],
};

// Credit notes and cancelled invoices per Nepali month.
frappe.dashboards.chart_sources["IRD Returns by BS Month"] = {
	method: "trevo_whitelabel.integrations.trevo_compliance.dashboard.returns_by_bs_month",
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
		},
	],
};

// The ten customers charged the most output VAT this fiscal year.
frappe.dashboards.chart_sources["IRD Top Customers by VAT"] = {
	method: "trevo_whitelabel.integrations.trevo_compliance.dashboard.top_customers_by_vat",
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
		},
	],
};
