import frappe


TREVO_LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"


def _set_if_field(doctype, fieldname, value):
    if frappe.db.exists("DocType", doctype):
        meta = frappe.get_meta(doctype)
        if meta.has_field(fieldname):
            frappe.db.set_single_value(doctype, fieldname, value)


def run():
    print("Injecting Trevo branding...")

    website_fields = {
        "head_html": "",
        "app_name": "Trevo",
        "brand_color": "#6ba44b",
        "app_logo": TREVO_LOGO,
        "banner_image": TREVO_LOGO,
        "splash_image": TREVO_LOGO,
        "favicon": TREVO_LOGO,
    }

    for fieldname, value in website_fields.items():
        _set_if_field("Website Settings", fieldname, value)

    _set_if_field("Navbar Settings", "app_logo", TREVO_LOGO)

    frappe.db.commit()
    print("Trevo branding injected successfully.")

if __name__ == "__main__":
    run()
