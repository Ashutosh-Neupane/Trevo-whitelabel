app_name = "trevo_whitelabel"
app_title = "Trevo"
app_publisher = "Ashutosh"
app_description = "Whitelabel app for Trevo Cloud"
app_email = "contact@dndts.net"
app_license = "mit"
app_home = "desk"

required_apps = ["erpnext"]

# Theme
# -----
# One bundle for desk and website. It sets Frappe's own design tokens and styles a
# handful of components; it never patches Frappe/ERPNext files or templates.
app_include_css = ["trevo_theme.bundle.css", "trevo_pages.bundle.css"]
web_include_css = ["trevo_theme.bundle.css"]
# Small desk behaviours (form side-panel toggle, title image, chart palette, sticky-header
# scroll state). Uses Frappe's public events and Page API only.
app_include_js = ["trevo_desk.bundle.js"]

app_logo_url = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
splash_image = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"

update_website_context = "trevo_whitelabel.branding.get_context"
extend_bootinfo = "trevo_whitelabel.branding.extend_bootinfo"

# About dialog: hide git branch names (see branding.get_versions).
override_whitelisted_methods = {
	"frappe.utils.change_log.get_versions": "trevo_whitelabel.branding.get_versions",
}

website_redirects = [
	# www/start.py sends desk users to /desk and customers/suppliers to their portal.
	{"source": "/", "target": "/start"},
	{"source": "/index", "target": "/start"},
	# Trevo sign-in is the front door. Frappe's own login page stays reachable at
	# /login-classic for two-factor, email-link and social login.
	{"source": "/login", "target": "/signin", "forward_query_parameters": True, "redirect_http_status": 302},
]

website_route_rules = [
	{"from_route": "/login-classic", "to_route": "login"},
]

# Install / migrate: database settings only (names, logo, /desk opening the Trevo home page, and
# reports and charts offered only to roles that can run them: desk/permissions.py).
after_install = [
	"trevo_whitelabel.scripts.rebrand_to_trevo.run",
	"trevo_whitelabel.desk.install.use_trevo_home",
	"trevo_whitelabel.desk.permissions.apply",
]

after_migrate = [
	"trevo_whitelabel.scripts.rebrand_to_trevo.run",
	"trevo_whitelabel.desk.install.use_trevo_home",
	"trevo_whitelabel.desk.permissions.apply",
]
