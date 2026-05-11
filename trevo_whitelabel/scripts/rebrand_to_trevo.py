import frappe


TREVO_LOGO = "/assets/trevo_whitelabel/images/TrevoCloudLogo.svg"
TREVO_BRAND = "#6ba44b"


def _set_single_values(doctype, values):
    if not frappe.db.exists("DocType", doctype):
        return

    meta = frappe.get_meta(doctype)
    for fieldname, value in values.items():
        if meta.has_field(fieldname):
            frappe.db.set_single_value(doctype, fieldname, value)


def run():
    print("Starting Trevo rebranding script...")

    # 1. Update System Settings
    try:
        _set_single_values("System Settings", {
            "app_name": "Trevo",
            "brand_color": TREVO_BRAND,
        })
        print("Updated System Settings with Trevo naming and color.")

        _set_single_values("Website Settings", {
            "app_name": "Trevo",
            "brand_color": TREVO_BRAND,
            "app_logo": TREVO_LOGO,
            "banner_image": TREVO_LOGO,
            "splash_image": TREVO_LOGO,
            "favicon": TREVO_LOGO,
        })
        print("Updated Website Settings with Trevo branding assets.")

        _set_single_values("Navbar Settings", {
            "app_logo": TREVO_LOGO,
        })
        print("Updated Navbar Settings with Trevo logo.")
    except Exception as e:
        print(f"Error updating System Settings: {e}")

    # 2. Add Custom Translations for common "Frappe" occurrences
    translations = {
        "Frappe": "Trevo",
        "Frappe Framework": "Trevo Framework",
        "Frappe Cloud": "Trevo Cloud",
        "Powered by Frappe": "Powered by Trevo",
        "Frappe Technologies": "Dots and Dashes Technology Limited",
        "Frappe Technologies Pvt. Ltd. and contributors": "Dots and Dashes Technology Limited",
        "ERPNext": "Trevo Next",
        "About ERPNext": "About Trevo Next",
        "ERPNext Settings": "Trevo Next Settings",
        "Login with Frappe Cloud": "Login with Trevo Cloud",
        "Welcome to Frappe": "Welcome to Trevo",
        "Built on Frappe": "Built for Trevo",
        "Frappe Support": "Trevo Support",
    }

    for source_text, translated_text in translations.items():
        try:
            # Check if this exact translation already exists
            if not frappe.db.exists("Translation", {"source_text": source_text, "language": "en"}):
                doc = frappe.new_doc("Translation")
                doc.language = "en"
                doc.source_text = source_text
                doc.translated_text = translated_text
                doc.insert(ignore_permissions=True)
                print(f"Added translation: '{source_text}' -> '{translated_text}'")
            else:
                # Update existing if needed
                translation_name = frappe.db.get_value("Translation", {"source_text": source_text, "language": "en"}, "name")
                doc = frappe.get_doc("Translation", translation_name)
                if doc.translated_text != translated_text:
                    doc.translated_text = translated_text
                    doc.save(ignore_permissions=True)
                    print(f"Updated translation: '{source_text}' -> '{translated_text}'")
        except Exception as e:
            print(f"Failed to set translation for '{source_text}': {e}")

    frappe.db.commit()
    print("Rebranding to Trevo completed successfully.")

if __name__ == "__main__":
    run()
