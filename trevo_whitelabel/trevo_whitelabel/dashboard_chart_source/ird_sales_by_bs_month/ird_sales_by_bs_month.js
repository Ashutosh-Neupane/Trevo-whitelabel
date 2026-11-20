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
