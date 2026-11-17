// Trevo command center, rendered inside Frappe desk (replaces the old www/desk.html override).
// Home route: set via the "desktop:home_page" default in trevo_whitelabel.desk.install.

frappe.pages["trevo-dashboard"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Dashboard"),
		single_column: true,
	});
	$(wrapper).addClass("trevo-dashboard-page");
	page.trevo_root = $('<div class="trevo-dashboard-root"></div>').appendTo(page.main).get(0);
	wrapper.trevo_page = page;
};

frappe.pages["trevo-dashboard"].on_page_show = function (wrapper) {
	const page = wrapper.trevo_page;

	frappe
		.require([
			"/assets/trevo_whitelabel/css/trevo_dashboard.css",
			"/assets/trevo_whitelabel/js/trevo_dashboard.js",
		])
		.then(() => frappe.xcall("trevo_whitelabel.desk_dashboard.get_desk_dashboard_data"))
		.then((data) => window.trevo_dashboard.mount(page.trevo_root, data))
		.catch((e) => {
			console.error(e);
			page.trevo_root.innerHTML = `<div class="text-muted p-4">${__("Could not load the dashboard.")}</div>`;
		});
};
