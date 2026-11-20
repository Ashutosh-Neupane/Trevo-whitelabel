frappe.provide("frappe.dashboards.chart_sources");

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
