frappe.provide("frappe.dashboards.chart_sources");

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
