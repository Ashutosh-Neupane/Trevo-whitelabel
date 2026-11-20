frappe.provide("frappe.dashboards.chart_sources");

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
