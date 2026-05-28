app_name = "trevo_whitelabel"
app_title = "Trevo Whitelabel"
app_publisher = "Ashutosh"
app_description = "Whitelabel app for Trevo Cloud"
app_email = "contact@dndts.net"
app_license = "mit"
app_home = "desk"


# Required Apps
required_apps = ["erpnext"]

# Includes in <head>
# ------------------
# include js, css files in header of desk.html
app_include_css = [
	"trevo_v1.bundle.css",
	"/assets/trevo_whitelabel/css/trevo_desk.css?v=20260526-formfix1",
]
app_include_js = [
	"trevo_v1.bundle.js",
	"/assets/trevo_whitelabel/js/trevo_desk.js?v=20260526-formfix1",
    
]

# include js, css files in header of web template
web_include_css = "trevo_v1.bundle.css"
web_include_js = "trevo_v1.bundle.js"

app_logo_url = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
splash_image = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"

update_website_context = "trevo_whitelabel.branding.get_context"

website_redirects = [
	{"source": "/", "target": "/desk"},
	{"source": "/index", "target": "/desk"},
]

after_install = [
	"trevo_whitelabel.scripts.repaint_svgs.run",
	"trevo_whitelabel.scripts.rebrand_to_trevo.run",
	"trevo_whitelabel.scripts.rebrand_form_builder.run",
]

after_migrate = [
	"trevo_whitelabel.scripts.repaint_svgs.run",
	"trevo_whitelabel.scripts.rebrand_to_trevo.run",
	"trevo_whitelabel.inject_branding.run",
	"trevo_whitelabel.scripts.rebrand_form_builder.run",
]
