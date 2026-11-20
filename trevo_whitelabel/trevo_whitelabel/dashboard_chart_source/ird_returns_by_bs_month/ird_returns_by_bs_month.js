frappe.provide("frappe.dashboards.chart_sources");

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
