frappe.provide("frappe.dashboards.chart_sources");

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
