import frappe

def run():
    print("Starting Trevo rebranding script...")

    # 1. Update System Settings
    try:
        if frappe.db.exists("DocType", "System Settings"):
            frappe.db.set_single_value('System Settings', 'app_name', 'Trevo')
            frappe.db.set_single_value('System Settings', 'brand_color', '#6ba44b')
            print("Set 'app_name' to 'Trevo' and 'brand_color' to '#6ba44b' in System Settings.")
            
        if frappe.db.exists("DocType", "Website Settings"):
            frappe.db.set_single_value('Website Settings', 'app_name', 'Trevo')
            frappe.db.set_single_value('Website Settings', 'brand_color', '#6ba44b')
            frappe.db.set_single_value('Website Settings', 'banner_image', '/assets/trevo_whitelabel/images/TrevoCloudLogo.svg')
            frappe.db.set_single_value('Website Settings', 'splash_image', '/assets/trevo_whitelabel/images/TrevoCloudLogo.svg')
            print("Updated Website Settings with Trevo branding and splash image.")
    except Exception as e:
        print(f"Error updating System Settings: {e}")

    # 2. Add Custom Translations for common "Frappe" occurrences
    translations = {
        "Frappe": "Trevo",
        "Frappe Framework": "Trevo Framework",
        "Frappe Cloud": "Trevo Cloud",
        "Powered by Frappe": "Powered by Trevo",
        "Frappe Technologies": "Dots and Dashes Technologies",
        "ERPNext": "TrevoERP",
        "About ERPNext": "About TrevoERP",
        "ERPNext Settings": "TrevoERP Settings"
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
