app_name = "trevo_whitelabel"
app_title = "Trevo Whitelabel"
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
# The v15-era overrides live in trevo_whitelabel/legacy_v15/ and are not loaded.
app_include_css = ["trevo_theme.bundle.css"]
web_include_css = ["trevo_theme.bundle.css"]

app_logo_url = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
splash_image = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"

update_website_context = "trevo_whitelabel.branding.get_context"
extend_bootinfo = "trevo_whitelabel.branding.extend_bootinfo"

website_redirects = [
	{"source": "/", "target": "/desk"},
	{"source": "/index", "target": "/desk"},
]

# Install / migrate: database settings only (names, logo, home page).
after_install = [
	"trevo_whitelabel.scripts.rebrand_to_trevo.run",
	"trevo_whitelabel.desk.install.set_home_page",
]

after_migrate = [
	"trevo_whitelabel.scripts.rebrand_to_trevo.run",
	"trevo_whitelabel.desk.install.set_home_page",
]
